import path from 'path';
import fs from 'fs';
import { Boom } from '@hapi/boom';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';

interface SessionState {
  sessionId: string;
  phoneNumber: string;
  isConnected: boolean;
  qrCode: string | null;
  createdAt: Date;
  lastActivity: Date;
}

class WhatsAppSessionManager {
  private static instance: WhatsAppSessionManager;
  private sockets: Map<string, WASocket> = new Map();
  private sessions: Map<string, SessionState> = new Map();
  private sessionsDir: string;

  private constructor() {
    this.sessionsDir = process.env.WHATSAPP_SESSION_DIR || './sessions';
    this.ensureSessionsDir();
  }

  public static getInstance(): WhatsAppSessionManager {
    if (!WhatsAppSessionManager.instance) {
      WhatsAppSessionManager.instance = new WhatsAppSessionManager();
    }
    return WhatsAppSessionManager.instance;
  }

  private ensureSessionsDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  public async initializeSession(
    userId: string,
    companyId: string
  ): Promise<{ qrCode: string; sessionId: string }> {
    const sessionId = `${companyId}_${userId}`;
    const authDir = path.join(this.sessionsDir, sessionId);

    if (fs.existsSync(authDir)) {
      const socket = this.sockets.get(sessionId);
      if (socket && socket.ws && socket.ws.readyState === 1) {
        return { qrCode: 'connected', sessionId };
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: process.env.WHATSAPP_BAILEYS_LOG_LEVEL || 'fatal' }),
      browser: ['AURA CRM', 'Chrome', '120.0.0.0'],
      syncFullHistory: false,
      qrTimeout: 60000,
      retryRequestDelayMs: 100,
      maxMsgsInMemory: 100,
    });

    let qrCodeData = '';

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = qr;
        this.sessions.set(sessionId, {
          sessionId,
          phoneNumber: '',
          isConnected: false,
          qrCode: qr,
          createdAt: new Date(),
          lastActivity: new Date(),
        });
      }

      if (connection === 'open') {
        const phoneNumber = sock.user?.id.split(':')[0];
        this.sessions.set(sessionId, {
          sessionId,
          phoneNumber: phoneNumber || '',
          isConnected: true,
          qrCode: null,
          createdAt: new Date(),
          lastActivity: new Date(),
        });
        console.log(`✅ WhatsApp conectado para usuário ${userId}`);
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {
          this.initializeSession(userId, companyId);
        } else {
          this.sessions.delete(sessionId);
          this.sockets.delete(sessionId);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    this.sockets.set(sessionId, sock);

    return { qrCode: qrCodeData || 'generating', sessionId };
  }

  public async sendMessage(
    sessionId: string,
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    const socket = this.sockets.get(sessionId);
    if (!socket || !socket.ws || socket.ws.readyState !== 1) {
      throw new Error(`Session ${sessionId} not connected`);
    }

    try {
      const jid = phoneNumber.includes('@')
        ? phoneNumber
        : `${phoneNumber}@s.whatsapp.net`;

      await socket.sendMessage(jid, { text: message });
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  public async getSessionStatus(sessionId: string): Promise<SessionState | null> {
    return this.sessions.get(sessionId) || null;
  }

  public disconnectSession(sessionId: string): void {
    const socket = this.sockets.get(sessionId);
    if (socket) {
      socket.end(new Error('Session disconnected by user'));
      this.sockets.delete(sessionId);
      this.sessions.delete(sessionId);
    }
  }

  public getAllActiveSessions(): SessionState[] {
    return Array.from(this.sessions.values());
  }
}

export default WhatsAppSessionManager.getInstance();
