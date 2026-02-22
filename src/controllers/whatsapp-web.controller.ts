// src/controllers/whatsapp-web.controller.ts
// WhatsApp Web QR code and session management

import { Request, Response } from 'express';
import { whatsappWebService } from '@services/whatsapp-web.service';
import { asyncHandler } from '@middleware/error.middleware';
import logger from '@utils/logger';

export class WhatsAppWebController {
  private getPreferredSession(userId: string) {
    const sessions = whatsappWebService.getUserSessions(userId);

    if (!sessions.length) return undefined;

    const activeSession = sessions.find((s) => s.status !== 'DISCONNECTED');
    return activeSession || sessions[sessions.length - 1];
  }

  /**
   * Initialize or return the current session for the user
   */
  initializeDefaultSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      logger.error({ user: req.user }, 'userId is undefined in initializeDefaultSession');
      return res.status(401).json({
        success: false,
        message: 'Authentication required - userId not found',
      });
    }

    let session = this.getPreferredSession(userId);

    // Use deterministic sessionId per user so sessions persist across PM2 restarts
    const sessionId = `session_${userId}`;
    
    // Check if session is already being initialized (prevent duplicate calls)
    const existingSession = whatsappWebService.getSession(sessionId);
    if (existingSession) {
      // If session is READY or AUTHENTICATED, return immediately - DO NOT initialize again
      if (existingSession.status === 'READY' || existingSession.status === 'AUTHENTICATED') {
        return res.status(200).json({
          success: true,
          sessionId: existingSession.id,
          status: existingSession.status,
          message: 'Session is already connected',
          ...(existingSession.phoneNumber && { phoneNumber: existingSession.phoneNumber }),
        });
      }
      
      // If session is INITIALIZING, return current status without initializing again
      if (existingSession.status === 'INITIALIZING') {
        return res.status(200).json({
          success: true,
          sessionId: existingSession.id,
          status: existingSession.status,
          message: 'Session is already initializing. Please wait...',
          ...(existingSession.qrCode && { qr: existingSession.qrCode }),
        });
      }
      
      // If QR_READY, return it without initializing again
      if (existingSession.status === 'QR_READY') {
        return res.status(200).json({
          success: true,
          sessionId: existingSession.id,
          status: existingSession.status,
          message: 'QR code is ready. Please scan it.',
          ...(existingSession.qrCode && { qr: existingSession.qrCode }),
        });
      }
      
      // If session exists and is not disconnected, return it immediately
      if (existingSession.status !== 'DISCONNECTED') {
        return res.status(200).json({
          success: true,
          sessionId: existingSession.id,
          status: existingSession.status,
          ...(existingSession.qrCode && { qr: existingSession.qrCode }),
          ...(existingSession.phoneNumber && { phoneNumber: existingSession.phoneNumber }),
        });
      }
    }

    // Check if session is in the initializing set (even if not in sessions map yet)
    if (whatsappWebService.isInitializing(sessionId)) {
      return res.status(200).json({
        success: true,
        sessionId,
        status: 'INITIALIZING',
        message: 'Session is already initializing. Please wait...',
      });
    }

    // Only initialize if no session exists or session is disconnected
    if (!session || session.status === 'DISCONNECTED') {
      // Initialize new session
      session = await whatsappWebService.initializeSession(userId, sessionId);
    }

    res.status(200).json({
      success: true,
      sessionId: session.id,
      status: session.status,
      ...(session.status === 'QR_READY' && session.qrCode && { qr: session.qrCode }),
      ...(session.status === 'READY' && session.phoneNumber && { phoneNumber: session.phoneNumber }),
    });
  });

  /**
   * Get status for the user's primary session
   */
  getDefaultStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      logger.error({ user: req.user }, 'userId is undefined in getDefaultStatus');
      return res.status(401).json({
        success: false,
        message: 'Authentication required - userId not found',
      });
    }

    const session = this.getPreferredSession(userId);

    if (!session) {
      return res.status(200).json({
        success: true,
        isConnected: false,
        message: 'No active session. Initialize to start.',
      });
    }

    const payload: Record<string, unknown> = {
      success: true,
      sessionId: session.id,
      status: session.status,
      phoneNumber: session.phoneNumber,
    };

    if (session.status === 'READY') {
      return res.status(200).json({
        ...payload,
        isConnected: true,
      });
    }

    if (session.status === 'QR_READY' && session.qrCode) {
      return res.status(200).json({
        ...payload,
        isConnected: false,
        qr: session.qrCode,
      });
    }

    return res.status(200).json({
      ...payload,
      isConnected: false,
      message: 'Session initializing. Please wait...',
    });
  });

  /**
   * Disconnect the user's primary session
   */
  disconnectDefaultSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const session = this.getPreferredSession(userId);

    if (session) {
      await whatsappWebService.destroySession(session.id);
    }

    res.status(200).json({
      success: true,
      message: 'Session disconnected',
    });
  });

  /**
   * Initialize a new WhatsApp Web session
   */
  initSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    // Use deterministic sessionId per user so sessions persist across PM2 restarts
    const sessionId = `session_${userId}`;

    const session = await whatsappWebService.initializeSession(userId, sessionId);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        message: 'Session initialized. Wait for QR code.',
      },
    });
  });

  /**
   * Get QR code for session
   */
  getQRCode = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const session = whatsappWebService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    if (session.status === 'READY') {
      return res.status(200).json({
        success: true,
        data: {
          status: 'READY',
          phoneNumber: session.phoneNumber,
          message: 'Session is already authenticated',
        },
      });
    }

    if (!session.qrCode) {
      return res.status(200).json({
        success: true,
        data: {
          status: session.status,
          message: 'QR code not yet available. Please wait...',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        qrCode: session.qrCode,
        status: session.status,
      },
    });
  });

  /**
   * Get session status
   */
  getStatus = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const session = whatsappWebService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        phoneNumber: session.phoneNumber,
      },
    });
  });

  /**
   * List all sessions for current user
   */
  listSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessions = whatsappWebService.getUserSessions(userId);

    res.status(200).json({
      success: true,
      data: sessions.map((s) => ({
        id: s.id,
        sessionId: s.id,
        status: s.status,
        phoneNumber: s.phoneNumber,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  });

  /**
   * Send message via WhatsApp Web
   */
  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { to, message, mediaUrl } = req.body;

    const result = mediaUrl
      ? await whatsappWebService.sendMediaMessage(sessionId, to, mediaUrl, message)
      : await whatsappWebService.sendMessage(sessionId, to, message);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to send message',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        messageId: result.messageId,
      },
    });
  });

  /**
   * Logout and destroy session
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    await whatsappWebService.destroySession(sessionId);

    res.status(200).json({
      success: true,
      message: 'Session logged out',
    });
  });

  /**
   * Restart session
   */
  restart = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = await whatsappWebService.restartSession(sessionId);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
      },
    });
  });

  /**
   * Stream QR code updates via SSE
   */
  streamQR = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial session status
    const session = whatsappWebService.getSession(sessionId);
    if (session) {
      sendEvent('status', {
        status: session.status,
        phoneNumber: session.phoneNumber,
      });

      if (session.qrCode) {
        sendEvent('qr', { qrCode: session.qrCode });
      }
    }

    // Listen for session events
    const onQR = (data: any) => {
      if (data.sessionId === sessionId) {
        sendEvent('qr', { qrCode: data.qrCode });
      }
    };

    const onReady = (data: any) => {
      if (data.sessionId === sessionId) {
        sendEvent('ready', { phoneNumber: data.phoneNumber });
      }
    };

    const onDisconnected = (data: any) => {
      if (data.sessionId === sessionId) {
        sendEvent('disconnected', { reason: data.reason });
      }
    };

    whatsappWebService.on('qr', onQR);
    whatsappWebService.on('ready', onReady);
    whatsappWebService.on('disconnected', onDisconnected);

    // Cleanup on close
    req.on('close', () => {
      whatsappWebService.off('qr', onQR);
      whatsappWebService.off('ready', onReady);
      whatsappWebService.off('disconnected', onDisconnected);
    });
  });
}
