package main

import "os"

// Config holds runtime configuration, all overridable via environment variables.
type Config struct {
	// HTTP/WS listen address for this bridge (Node connects here).
	Addr string
	// Shared secret required on the HTTP API + WS (via ?token= or Authorization: Bearer).
	// Empty = no auth (only do this on a trusted localhost bind).
	Token string
	// SQLite file where whatsmeow persists the WhatsApp session (device keys).
	StoreDSN string
	// Directory where downloaded media is written. Share this with the Node app's
	// uploads/media dir so the Node side can serve the files it already knows how to serve.
	MediaDir string
	// URL prefix the Node app serves MediaDir under, used to build mediaUrl in events.
	MediaURLPrefix string
}

func loadConfig() Config {
	return Config{
		Addr:           env("BRIDGE_ADDR", "127.0.0.1:8088"),
		Token:          env("BRIDGE_TOKEN", ""),
		StoreDSN:       env("BRIDGE_STORE_DSN", "file:whatsmeow-store.db?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)"),
		MediaDir:       env("BRIDGE_MEDIA_DIR", "../uploads/media"),
		MediaURLPrefix: env("BRIDGE_MEDIA_URL_PREFIX", "/uploads/media/"),
	}
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
