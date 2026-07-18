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

	_ "github.com/mattn/go-sqlite3"
)

// Bridge ties the whatsmeow client, the WebSocket hub, and config together.
type Bridge struct {
	cfg       Config
	hub       *Hub
	client    *whatsmeow.Client
	log       waLog.Logger
	nameCache sync.Map
}

func main() {
	cfg := loadConfig()
	logger := waLog.Stdout("Bridge", "INFO", true)
	ctx := context.Background()

	// Persistent device store (WhatsApp session keys) — survives restarts, so no re-scan.
	container, err := sqlstore.New(ctx, "sqlite3", cfg.StoreDSN, waLog.Stdout("DB", "WARN", true))
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
	if b.client.IsConnected() {
		return
	}

	if b.client.Store.ID == nil {
		// Fresh device — pair via QR. Must obtain the channel BEFORE Connect().
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
			switch evt.Event {
			case "code":
				b.log.Infof("QR code generated")
				b.hub.broadcast(Event{Type: "qr", Code: evt.Code})
			case "success":
				b.log.Infof("QR pairing success")
			case "timeout":
				b.log.Warnf("QR timed out — call /connect to retry")
			}
		}
		return
	}

	// Existing session — reconnect without QR.
	if err := b.client.Connect(); err != nil {
		b.log.Errorf("reconnect error: %v", err)
	}
}
