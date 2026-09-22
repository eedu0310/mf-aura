import { NextRequest, NextResponse } from 'next/server';
import sessionManager from '@/lib/whatsapp/session-manager';

export async function POST(request: NextRequest) {
  try {
    const { userId, companyId } = await request.json();

    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'userId ou companyId ausentes' },
        { status: 400 }
      );
    }

    const { qrCode, sessionId } = await sessionManager.initializeSession(
      userId,
      companyId
    );

    let qrBase64 = qrCode;
    if (qrCode !== 'connected' && qrCode !== 'generating') {
      if (!qrCode.startsWith('data:')) {
        const qrcodeLib = require('qrcode');
        qrBase64 = await qrcodeLib.toDataURL(qrCode);
        qrBase64 = qrBase64.split(',')[1];
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
      qrCode: qrBase64,
      message: 'QR code gerado com sucesso',
    });
  } catch (error) {
    console.error('QR Init Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao inicializar QR' },
      { status: 500 }
    );
  }
}
