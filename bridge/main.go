package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"

	// Pure-Go SQLite driver (registers as "sqlite") so the bridge cross-compiles to a
	// static Linux binary with CGO_ENABLED=0 — no C toolchain, no building on the server.
	_ "modernc.org/sqlite"
)

// Bridge ties the whatsmeow client, the WebSocket hub, and config together.
type Bridge struct {
	cfg       Config
	hub       *Hub
	client    *whatsmeow.Client
	log       waLog.Logger
	nameCache sync.Map
	connectMu sync.Mutex // single-flight guard so connect() never runs concurrently
}

func main() {
	cfg := loadConfig()
	logger := waLog.Stdout("Bridge", "INFO", true)
	ctx := context.Background()

	// Persistent device store (WhatsApp session keys) — survives restarts, so no re-scan.
	container, err := sqlstore.New(ctx, "sqlite", cfg.StoreDSN, waLog.Stdout("DB", "WARN", true))
	if err != nil {
		logger.Errorf("failed to open store: %v", err)
		os.Exit(1)
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		logger.Errorf("failed to get device: %v", err)
		os.Exit(1)
	}

	client := whatsmeow.NewClient(device, waLog.Stdout("WA", "INFO", true))
	client.EnableAutoReconnect = true

	b := &Bridge{cfg: cfg, hub: newHub(), client: client, log: logger}
	client.AddEventHandler(b.handleEvent)

	// HTTP + WebSocket server for the Node app.
	srv := &http.Server{Addr: cfg.Addr, Handler: b.routes()}
	go func() {
		logger.Infof("bridge listening on %s (media -> %s)", cfg.Addr, cfg.MediaDir)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Errorf("http server error: %v", err)
		}
	}()

	// Connect (restores session, or starts QR pairing if this is a fresh device).
	go b.connect()

	// Graceful shutdown.
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	logger.Infof("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	client.Disconnect()
}

// connect restores an existing session, or drives QR pairing for a new one.
// whatsmeow reconnects automatically after transient drops (EnableAutoReconnect),
// so this only needs to run for the initial connect / fresh pairing.
func (b *Bridge) connect() {
	// Single-flight: multiple callers (startup + /connect) must not create competing
	// QR channels / connect attempts — that caused the fast timeouts and churn.
	if !b.connectMu.TryLock() {
		b.log.Infof("connect already in progress, skipping")
		return
	}
	defer b.connectMu.Unlock()

	if b.client.IsConnected() {
		return
	}

	if b.client.Store.ID != nil {
		// Existing session — reconnect without QR.
		if err := b.client.Connect(); err != nil {
			b.log.Errorf("reconnect error: %v", err)
		}
		return
	}

	// Fresh device — pair via QR. Re-arm a fresh QR channel until paired so the portal
	// always has a current, scannable code.
	for b.client.Store.ID == nil {
		qrChan, err := b.client.GetQRChannel(context.Background())
		if err != nil {
			b.log.Errorf("qr channel error: %v", err)
			return
		}
		if err := b.client.Connect(); err != nil {
			b.log.Errorf("connect error: %v", err)
			return
		}
		for evt := range qrChan {
			if evt.Event == "code" {
				b.log.Infof("QR code generated")
				b.hub.broadcast(Event{Type: "qr", Code: evt.Code})
			} else {
				b.log.Infof("QR channel event: %s", evt.Event)
			}
		}
		if b.client.Store.ID != nil {
			return // paired
		}
		// Channel closed without pairing — disconnect and re-arm a fresh QR.
		b.log.Warnf("QR sequence ended — re-arming")
		b.client.Disconnect()
		time.Sleep(2 * time.Second)
	}
}
