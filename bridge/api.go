package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // local trusted bind
}

// routes wires the HTTP + WebSocket endpoints.
func (b *Bridge) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", b.auth(b.handleWS))
	mux.HandleFunc("/status", b.auth(b.handleStatus))
	mux.HandleFunc("/qr", b.auth(b.handleQR))
	mux.HandleFunc("/connect", b.auth(b.handleConnect))
	mux.HandleFunc("/logout", b.auth(b.handleLogout))
	mux.HandleFunc("/send", b.auth(b.handleSend))
	mux.HandleFunc("/send-media", b.auth(b.handleSendMedia))
	mux.HandleFunc("/react", b.auth(b.handleReact))
	mux.HandleFunc("/read", b.auth(b.handleRead))
	mux.HandleFunc("/group", b.auth(b.handleGroup))
	return mux
}

// auth enforces the shared token (query ?token= or Authorization: Bearer), if configured.
func (b *Bridge) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if b.cfg.Token != "" {
			tok := r.URL.Query().Get("token")
			if tok == "" {
				tok = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			}
			if tok != b.cfg.Token {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}
		next(w, r)
	}
}

func (b *Bridge) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	b.hub.add(conn)
	// Replay current state so a reconnecting Node knows where things stand.
	if b.hub.isConnected() {
		_ = conn.WriteJSON(Event{Type: "connected"})
	} else if qr := b.hub.getQR(); qr != "" {
		_ = conn.WriteJSON(Event{Type: "qr", Code: qr})
	}
	// Drain client reads (and detect close) so we can clean up.
	go func() {
		defer b.hub.remove(conn)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
}

func (b *Bridge) handleStatus(w http.ResponseWriter, r *http.Request) {
	jid := ""
	loggedIn := b.client.Store.ID != nil
	if loggedIn {
		jid = b.client.Store.ID.String()
	}
	writeJSON(w, map[string]interface{}{
		"connected": b.client.IsConnected(),
		"loggedIn":  loggedIn,
		"jid":       jid,
	})
}

func (b *Bridge) handleQR(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"code": b.hub.getQR()})
}

// handleConnect triggers (re)connection / pairing. Safe to call repeatedly.
func (b *Bridge) handleConnect(w http.ResponseWriter, r *http.Request) {
	go b.connect()
	writeJSON(w, map[string]bool{"ok": true})
}

func (b *Bridge) handleLogout(w http.ResponseWriter, r *http.Request) {
	if err := b.client.Logout(context.Background()); err != nil {
		httpErr(w, err)
		return
	}
	writeJSON(w, map[string]bool{"ok": true})
}

type sendReq struct {
	ChatJID string `json:"chatJid"`
	Text    string `json:"text"`
}

func (b *Bridge) handleSend(w http.ResponseWriter, r *http.Request) {
	var req sendReq
	if !decode(w, r, &req) {
		return
	}
	jid, err := types.ParseJID(req.ChatJID)
	if err != nil {
		httpErr(w, err)
		return
	}
	msg := &waE2E.Message{Conversation: proto.String(req.Text)}
	resp, err := b.client.SendMessage(context.Background(), jid, msg)
	if err != nil {
		httpErr(w, err)
		return
	}
	writeJSON(w, map[string]string{"id": resp.ID})
}

type sendMediaReq struct {
	ChatJID     string `json:"chatJid"`
	Caption     string `json:"caption"`
	Type        string `json:"type"` // IMAGE | VIDEO | AUDIO | DOCUMENT
	Mimetype    string `json:"mimetype"`
	FileName    string `json:"fileName"`
	MediaBase64 string `json:"mediaBase64"`
}

func (b *Bridge) handleSendMedia(w http.ResponseWriter, r *http.Request) {
	var req sendMediaReq
	if !decode(w, r, &req) {
		return
	}
	jid, err := types.ParseJID(req.ChatJID)
	if err != nil {
		httpErr(w, err)
		return
	}
	data, err := base64.StdEncoding.DecodeString(req.MediaBase64)
	if err != nil {
		httpErr(w, err)
		return
	}

	mediaType := map[string]whatsmeow.MediaType{
		"IMAGE": whatsmeow.MediaImage, "VIDEO": whatsmeow.MediaVideo,
		"AUDIO": whatsmeow.MediaAudio, "DOCUMENT": whatsmeow.MediaDocument,
	}[strings.ToUpper(req.Type)]

	ctx := context.Background()
	up, err := b.client.Upload(ctx, data, mediaType)
	if err != nil {
		httpErr(w, err)
		return
	}
	length := uint64(len(data))

	var msg *waE2E.Message
	switch strings.ToUpper(req.Type) {
	case "IMAGE":
		msg = &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
			Caption: proto.String(req.Caption), Mimetype: proto.String(req.Mimetype),
			URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey,
			FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: &length,
		}}
	case "VIDEO":
		msg = &waE2E.Message{VideoMessage: &waE2E.VideoMessage{
			Caption: proto.String(req.Caption), Mimetype: proto.String(req.Mimetype),
			URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey,
			FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: &length,
		}}
	case "AUDIO":
		msg = &waE2E.Message{AudioMessage: &waE2E.AudioMessage{
			Mimetype: proto.String(req.Mimetype),
			URL:      &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey,
			FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: &length,
		}}
	default:
		msg = &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{
			Caption: proto.String(req.Caption), Mimetype: proto.String(req.Mimetype),
			FileName: proto.String(req.FileName),
			URL:      &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey,
			FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: &length,
		}}
	}

	resp, err := b.client.SendMessage(ctx, jid, msg)
	if err != nil {
		httpErr(w, err)
		return
	}
	writeJSON(w, map[string]string{"id": resp.ID})
}

type reactReq struct {
	ChatJID   string `json:"chatJid"`
	MessageID string `json:"messageId"`
	SenderJID string `json:"senderJid"`
	FromMe    bool   `json:"fromMe"`
	Emoji     string `json:"emoji"` // empty string removes the reaction
}

func (b *Bridge) handleReact(w http.ResponseWriter, r *http.Request) {
	var req reactReq
	if !decode(w, r, &req) {
		return
	}
	chat, err := types.ParseJID(req.ChatJID)
	if err != nil {
		httpErr(w, err)
		return
	}
	sender := chat
	if req.SenderJID != "" {
		if s, err := types.ParseJID(req.SenderJID); err == nil {
			sender = s
		}
	}
	react := b.client.BuildReaction(chat, sender, req.MessageID, req.Emoji)
	if _, err := b.client.SendMessage(context.Background(), chat, react); err != nil {
		httpErr(w, err)
		return
	}
	writeJSON(w, map[string]bool{"ok": true})
}

type readReq struct {
	ChatJID    string   `json:"chatJid"`
	SenderJID  string   `json:"senderJid"`
	MessageIDs []string `json:"messageIds"`
}

func (b *Bridge) handleRead(w http.ResponseWriter, r *http.Request) {
	var req readReq
	if !decode(w, r, &req) {
		return
	}
	chat, err := types.ParseJID(req.ChatJID)
	if err != nil {
		httpErr(w, err)
		return
	}
	sender := chat
	if req.SenderJID != "" {
		if s, err := types.ParseJID(req.SenderJID); err == nil {
			sender = s
		}
	}
	ids := make([]types.MessageID, len(req.MessageIDs))
	for i, id := range req.MessageIDs {
		ids[i] = id
	}
	if err := b.client.MarkRead(context.Background(), ids, time.Now(), chat, sender); err != nil {
		httpErr(w, err)
		return
	}
	writeJSON(w, map[string]bool{"ok": true})
}

func (b *Bridge) handleGroup(w http.ResponseWriter, r *http.Request) {
	jid, err := types.ParseJID(r.URL.Query().Get("jid"))
	if err != nil {
		httpErr(w, err)
		return
	}
	gi, err := b.client.GetGroupInfo(context.Background(), jid)
	if err != nil {
		httpErr(w, err)
		return
	}
	parts := make([]string, len(gi.Participants))
	for i, p := range gi.Participants {
		parts[i] = p.JID.String()
	}
	writeJSON(w, map[string]interface{}{
		"jid": gi.JID.String(), "name": gi.Name, "topic": gi.Topic, "participants": parts,
	})
}

// --- helpers ---

func decode(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		http.Error(w, "bad json: "+err.Error(), http.StatusBadRequest)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func httpErr(w http.ResponseWriter, err error) {
	writeJSONStatus(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
}

func writeJSONStatus(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
