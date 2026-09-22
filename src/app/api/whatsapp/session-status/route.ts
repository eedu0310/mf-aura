import { NextRequest, NextResponse } from 'next/server';
import sessionManager from '@/lib/whatsapp/session-manager';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId ausente' },
        { status: 400 }
      );
    }

    const status = await sessionManager.getSessionStatus(sessionId);

    if (!status) {
      return NextResponse.json(
        { error: 'Session não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      phoneNumber: status.phoneNumber,
      isConnected: status.isConnected,
      qrCode: status.qrCode,
    });
  } catch (error) {
    console.error('Session Status Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao obter status' },
      { status: 500 }
    );
  }
}
