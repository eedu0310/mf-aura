import { NextRequest, NextResponse } from 'next/server';
import sessionManager from '@/lib/whatsapp/session-manager';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, phoneNumber, message } = await request.json();

    if (!sessionId || !phoneNumber || !message) {
      return NextResponse.json(
        { error: 'sessionId, phoneNumber ou message ausentes' },
        { status: 400 }
      );
    }

    const success = await sessionManager.sendMessage(sessionId, phoneNumber, message);

    return NextResponse.json({
      success,
      message: 'Mensagem enviada com sucesso',
    });
  } catch (error) {
    console.error('Send Message Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar mensagem' },
      { status: 500 }
    );
  }
}
