package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// MessageData is the normalized message shape the Node app consumes.
type MessageData struct {
	ID         string `json:"id"`
	ChatJID    string `json:"chatJid"`
	SenderJID  string `json:"senderJid"`
	SenderName string `json:"senderName"`
	FromMe     bool   `json:"fromMe"`
	Timestamp  int64  `json:"timestamp"`
	Type       string `json:"type"`
	Text       string `json:"text"`
	MediaURL   string `json:"mediaUrl,omitempty"`
	Mimetype   string `json:"mimetype,omitempty"`
	IsGroup    bool   `json:"isGroup"`
	IsChannel  bool   `json:"isChannel"`
	ChatName   string `json:"chatName,omitempty"`
}

// ReactionData mirrors WhatsApp reactions ("who reacted with what to which message").
type ReactionData struct {
	MessageID string `json:"messageId"`
	ChatJID   string `json:"chatJid"`
	SenderJID string `json:"senderJid"`
	Emoji     string `json:"emoji"`
	FromMe    bool   `json:"fromMe"`
}

// handleEvent is registered with whatsmeow and routes every event to the Node app.
func (b *Bridge) handleEvent(evt interface{}) {
	b.touch() // any event = the session is alive (watchdog liveness signal)
	switch v := evt.(type) {
	case *events.Connected:
		b.log.Infof("WhatsApp connected")
		b.touch()
		b.hub.broadcast(Event{Type: "connected"})

	case *events.Disconnected:
		b.log.Warnf("WhatsApp disconnected")
		b.hub.broadcast(Event{Type: "disconnected", Reason: "stream_closed"})

	case *events.LoggedOut:
		b.log.Warnf("WhatsApp logged out (reason=%v)", v.Reason)
		b.hub.broadcast(Event{Type: "logged_out", Reason: v.Reason.String()})

	case *events.PairSuccess:
		b.log.Infof("Paired as %s", v.ID.String())
		b.hub.broadcast(Event{Type: "pair_success", JID: v.ID.String()})

	case *events.Message:
		b.handleMessage(v)

	case *events.Receipt:
		if v.Type == types.ReceiptTypeRead || v.Type == types.ReceiptTypeReadSelf {
			b.hub.broadcast(Event{Type: "receipt", Data: map[string]interface{}{
				"chatJid":    v.Chat.String(),
				"senderJid":  v.Sender.String(),
				"messageIds": v.MessageIDs,
				"kind":       "read",
			}})
		}
	}
}

func (b *Bridge) handleMessage(evt *events.Message) {
	info := evt.Info
	chat := info.Chat
	isGroup := chat.Server == types.GroupServer
	isChannel := chat.Server == types.NewsletterServer

	md := MessageData{
		ID:         info.ID,
		ChatJID:    chat.String(),
		SenderJID:  info.Sender.String(),
		SenderName: info.PushName,
		FromMe:     info.IsFromMe,
		Timestamp:  info.Timestamp.Unix(),
		IsGroup:    isGroup,
		IsChannel:  isChannel,
		Type:       "TEXT",
	}

	// Resolve a friendly chat name for groups/channels so the UI doesn't show a raw JID.
	if isGroup || isChannel {
		md.ChatName = b.resolveChatName(chat)
	}

	b.log.Debugf("message %s from %s (group=%v channel=%v)", md.ID, md.SenderJID, isGroup, isChannel)

	msg := evt.Message
	switch {
	case msg.GetConversation() != "":
		md.Text = msg.GetConversation()

	case msg.GetExtendedTextMessage() != nil:
		md.Text = msg.GetExtendedTextMessage().GetText()

	case msg.GetImageMessage() != nil:
		m := msg.GetImageMessage()
		md.Type = "IMAGE"
		md.Text = m.GetCaption()
		md.Mimetype = m.GetMimetype()
		md.MediaURL = b.downloadMedia(m, md.ID, m.GetMimetype())

	case msg.GetVideoMessage() != nil:
		m := msg.GetVideoMessage()
		md.Type = "VIDEO"
		md.Text = m.GetCaption()
		md.Mimetype = m.GetMimetype()
		md.MediaURL = b.downloadMedia(m, md.ID, m.GetMimetype())

	case msg.GetAudioMessage() != nil:
		m := msg.GetAudioMessage()
		md.Type = "AUDIO"
		if m.GetPTT() {
			md.Type = "PTT"
		}
		md.Mimetype = m.GetMimetype()
		md.MediaURL = b.downloadMedia(m, md.ID, m.GetMimetype())

	case msg.GetDocumentMessage() != nil:
		m := msg.GetDocumentMessage()
		md.Type = "DOCUMENT"
		md.Text = m.GetFileName()
		md.Mimetype = m.GetMimetype()
		md.MediaURL = b.downloadMedia(m, md.ID, m.GetMimetype())

	case msg.GetStickerMessage() != nil:
		m := msg.GetStickerMessage()
		md.Type = "STICKER"
		md.Mimetype = m.GetMimetype()
		md.MediaURL = b.downloadMedia(m, md.ID, m.GetMimetype())

	case msg.GetReactionMessage() != nil:
		r := msg.GetReactionMessage()
		b.hub.broadcast(Event{Type: "reaction", Data: ReactionData{
			MessageID: r.GetKey().GetID(),
			ChatJID:   chat.String(),
			SenderJID: info.Sender.String(),
			Emoji:     r.GetText(),
			FromMe:    r.GetKey().GetFromMe(),
		}})
		return

	default:
		// Location, contact cards, polls, etc. — forward as a typed placeholder.
		if msg.GetLocationMessage() != nil {
			md.Type = "LOCATION"
		} else if msg.GetContactMessage() != nil {
			md.Type = "CONTACT"
			md.Text = msg.GetContactMessage().GetDisplayName()
		} else {
			// Nothing we render — skip silently.
			return
		}
	}

	b.hub.broadcast(Event{Type: "message", Data: md})
}

// downloadMedia fetches + decrypts media natively (no browser) and writes it to the
// shared media directory, returning the URL the Node app should store. Empty on failure.
func (b *Bridge) downloadMedia(msg whatsmeow.DownloadableMessage, msgID, mimetype string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	data, err := b.client.Download(ctx, msg)
	if err != nil {
		b.log.Warnf("media download failed for %s: %v", msgID, err)
		return ""
	}

	ext := extFromMime(mimetype)
	name := fmt.Sprintf("%d-%s%s", time.Now().UnixNano(), sanitize(msgID), ext)
	if err := os.MkdirAll(b.cfg.MediaDir, 0o755); err != nil {
		b.log.Warnf("cannot create media dir: %v", err)
		return ""
	}
	full := filepath.Join(b.cfg.MediaDir, name)
	if err := os.WriteFile(full, data, 0o644); err != nil {
		b.log.Warnf("cannot write media file: %v", err)
		return ""
	}
	return b.cfg.MediaURLPrefix + name
}

// resolveChatName returns a group/channel display name, cached to avoid repeat lookups.
func (b *Bridge) resolveChatName(jid types.JID) string {
	if name, ok := b.nameCache.Load(jid.String()); ok {
		return name.(string)
	}
	name := ""
	ctx := context.Background()
	if jid.Server == types.GroupServer {
		if gi, err := b.client.GetGroupInfo(ctx, jid); err == nil {
			name = gi.Name
		}
	} else if jid.Server == types.NewsletterServer {
		if ni, err := b.client.GetNewsletterInfo(ctx, jid); err == nil && ni != nil {
			name = ni.ThreadMeta.Name.Text
		}
	}
	if name != "" {
		b.nameCache.Store(jid.String(), name)
	}
	return name
}

func extFromMime(mime string) string {
	mime = strings.ToLower(strings.SplitN(mime, ";", 2)[0])
	switch mime {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "video/mp4":
		return ".mp4"
	case "audio/ogg", "audio/ogg; codecs=opus":
		return ".ogg"
	case "audio/mpeg":
		return ".mp3"
	case "application/pdf":
		return ".pdf"
	}
	if i := strings.LastIndex(mime, "/"); i >= 0 && i < len(mime)-1 {
		return "." + mime[i+1:]
	}
	return ".bin"
}

func sanitize(s string) string {
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		return '-'
	}, s)
	if len(s) > 24 {
		s = s[:24]
	}
	return s
}
