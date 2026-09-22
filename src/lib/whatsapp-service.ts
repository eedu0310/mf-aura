import { Boom } from '@hapi/boom';
import makeWASocket, { 
  AuthenticationState, 
  ConnectionState,
  MessageType,
  proto,
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface WhatsAppSession {
  id: string;
  vendor_id: string;
  phone_number: string;
  session_name: string;
  qr_code: string | null;
  is_connected: boolean;
  created_at: string;
  last_activity: string;
  socket?: any;
}

class WhatsAppService {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private socketsMap: Map<string, any> = new Map();

  async initializeSession(sessionId: string, vendorId: string): Promise<string> {
    try {
      const sessionDir = path.join(
        process.env.WHATSAPP_SESSION_DIR || '/tmp/whatsapp-sessions',
        sessionId
      );

      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['AURA CRM', 'Chrome', '5.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        retryRequestDelayMs: 100,
      });

      let qrCode = '';

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          qrCode = qr;
          await supabase
            .from('whatsapp_sessoes')
            .update({ qr_code: qrCode })
            .eq('id', sessionId);
        }

        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          if (shouldReconnect) {
            setTimeout(() => {
              this.initializeSession(sessionId, vendorId);
            }, 3000);
          } else {
            await this.logoutSession(sessionId);
          }
        } else if (connection === 'open') {
          console.log(`✅ Session ${sessionId} connected`);
          const phoneNumber = socket.user?.id.split(':')[0];

          await supabase
            .from('whatsapp_sessoes')
            .update({
              is_connected: true,
              phone_number: phoneNumber || '',
              qr_code: null,
              last_activity: new Date().toISOString(),
            })
            .eq('id', sessionId);

          this.socketsMap.set(sessionId, socket);
        }
      });

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('messages.upsert', async (m) => {
        for (const msg of m.messages) {
          if (!msg.message) continue;

          const messageContent = msg.message.conversation || 
                                 msg.message.extendedTextMessage?.text || 
                                 msg.message.imageMessage?.caption ||
                                 '';

          if (!messageContent) continue;

          const contactNumber = msg.key.remoteJid?.split('@')[0];
          const isGroup = msg.key.remoteJid?.includes('@g.us');

          if (isGroup || !contactNumber) continue;

          await supabase.from('whatsapp_mensagens').insert({
            session_id: sessionId,
            contact_number: contactNumber,
            message: messageContent,
            direction: 'in',
            timestamp: new Date(msg.messageTimestamp! * 1000).toISOString(),
            read: false,
            message_id: msg.key.id,
          });

          const contactName = msg.pushName || contactNumber;
          const { data: existingChat } = await supabase
            .from('whatsapp_conversas')
            .select('id')
            .eq('session_id', sessionId)
            .eq('contact_number', contactNumber)
            .single();

          if (existingChat) {
            await supabase
              .from('whatsapp_conversas')
              .update({
                last_message: messageContent,
                last_timestamp: new Date().toISOString(),
                unread_count: (await supabase
                  .from('whatsapp_mensagens')
                  .select('id')
                  .eq('session_id', sessionId)
                  .eq('contact_number', contactNumber)
                  .eq('read', false)
                  .eq('direction', 'in')).data?.length || 0,
                contact_name: contactName,
              })
              .eq('id', existingChat.id);
          } else {
            await supabase.from('whatsapp_conversas').insert({
              session_id: sessionId,
              contact_number: contactNumber,
              contact_name: contactName,
              last_message: messageContent,
              last_timestamp: new Date().toISOString(),
              unread_count: 1,
            });
          }
        }
      });

      const session: WhatsAppSession = {
        id: sessionId,
        vendor_id: vendorId,
        phone_number: '',
        session_name: `Session ${new Date().toLocaleTimeString()}`,
        qr_code: qrCode,
        is_connected: false,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        socket,
      };

      this.sessions.set(sessionId, session);
      return qrCode;
    } catch (error) {
      console.error(`Error initializing session ${sessionId}:`, error);
      throw error;
    }
  }

  async sendMessage(
    sessionId: string,
    contactNumber: string,
    message: string
  ): Promise<void> {
    try {
      const socket = this.socketsMap.get(sessionId);
      if (!socket) {
        throw new Error(`Session ${sessionId} not connected`);
      }

      const jid = `${contactNumber}@s.whatsapp.net`;
      const response = await socket.sendMessage(jid, { text: message });

      if (response) {
        await supabase.from('whatsapp_mensagens').insert({
          session_id: sessionId,
          contact_number: contactNumber,
          message,
          direction: 'out',
          timestamp: new Date().toISOString(),
          read: true,
          message_id: response.key.id,
        });

        const { data: existingChat } = await supabase
          .from('whatsapp_conversas')
          .select('id')
          .eq('session_id', sessionId)
          .eq('contact_number', contactNumber)
          .single();

        if (existingChat) {
          await supabase
            .from('whatsapp_conversas')
            .update({
              last_message: message,
              last_timestamp: new Date().toISOString(),
            })
            .eq('id', existingChat.id);
        }
      }
    } catch (error) {
      console.error(
        `Error sending message from session ${sessionId} to ${contactNumber}:`,
        error
      );
      throw error;
    }
  }

  async logoutSession(sessionId: string): Promise<void> {
    try {
      const socket = this.socketsMap.get(sessionId);
      if (socket) {
        await socket.logout();
        this.socketsMap.delete(sessionId);
      }

      const sessionDir = path.join(
        process.env.WHATSAPP_SESSION_DIR || '/tmp/whatsapp-sessions',
        sessionId
      );

      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      await supabase
        .from('whatsapp_sessoes')
        .update({
          is_connected: false,
          qr_code: null,
        })
        .eq('id', sessionId);

      this.sessions.delete(sessionId);
    } catch (error) {
      console.error(`Error logging out session ${sessionId}:`, error);
      throw error;
    }
  }

  getSession(sessionId: string): WhatsAppSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSocket(sessionId: string): any {
    return this.socketsMap.get(sessionId);
  }
}

export default new WhatsAppService();
