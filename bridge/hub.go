package main

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

// Event is the JSON envelope pushed from the bridge to the Node app over the WebSocket.
type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data,omitempty"`
	// Convenience fields used by simple events (qr / disconnected / etc.)
	Code   string `json:"code,omitempty"`
	Reason string `json:"reason,omitempty"`
	JID    string `json:"jid,omitempty"`
}

// Hub fans out bridge events to every connected Node WebSocket client and
// remembers the last QR + status so a freshly-connecting Node gets current state.
type Hub struct {
	mu       sync.RWMutex
	clients  map[*websocket.Conn]bool
	lastQR   string
	lastConn bool
}

func newHub() *Hub {
	return &Hub{clients: make(map[*websocket.Conn]bool)}
}

func (h *Hub) add(c *websocket.Conn) {
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
}

func (h *Hub) remove(c *websocket.Conn) {
	h.mu.Lock()
	if h.clients[c] {
		delete(h.clients, c)
		_ = c.Close()
	}
	h.mu.Unlock()
}

// broadcast marshals and sends an event to all connected clients.
func (h *Hub) broadcast(e Event) {
	// Track state so /status and reconnecting clients can be answered without WhatsApp round-trips.
	switch e.Type {
	case "qr":
		h.setQR(e.Code)
	case "connected":
		h.setConnected(true)
	case "disconnected", "logged_out":
		h.setConnected(false)
	case "pair_success", "message":
		h.setQR("") // QR consumed once paired / receiving
	}

	payload, err := json.Marshal(e)
	if err != nil {
		return
	}
	h.mu.RLock()
	conns := make([]*websocket.Conn, 0, len(h.clients))
	for c := range h.clients {
		conns = append(conns, c)
	}
	h.mu.RUnlock()

	for _, c := range conns {
		if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
			h.remove(c)
		}
	}
}

func (h *Hub) setQR(code string) {
	h.mu.Lock()
	h.lastQR = code
	h.mu.Unlock()
}

func (h *Hub) getQR() string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.lastQR
}

func (h *Hub) setConnected(v bool) {
	h.mu.Lock()
	h.lastConn = v
	h.mu.Unlock()
}

func (h *Hub) isConnected() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.lastConn
}
