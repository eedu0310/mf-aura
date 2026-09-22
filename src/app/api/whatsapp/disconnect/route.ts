import { NextRequest, NextResponse } from 'next/server';
import sessionManager from '@/lib/whatsapp/session-manager';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId ausente' },
        { status: 400 }
      );
    }

    sessionManager.disconnectSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session desconectada com sucesso',
    });
  } catch (error) {
    console.error('Disconnect Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao desconectar' },
      { status: 500 }
    );
  }
}
