import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import whatsappService from '@/lib/whatsapp-service';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sessionId = randomUUID();
    const { error } = await supabase.from('whatsapp_sessoes').insert({
      id: sessionId,
      vendor_id: user.id,
      phone_number: '',
      session_name: `WhatsApp Session ${new Date().toLocaleString('pt-BR')}`,
      is_connected: false,
      qr_code: null,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    });

    if (error) {
      console.error('Error creating session:', error);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    try {
      const qrCode = await whatsappService.initializeSession(
        sessionId,
        user.id
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      return NextResponse.json({
        sessionId,
        qrCode,
        message: 'Session initialized. Scan the QR code with WhatsApp.',
      });
    } catch (qrError) {
      console.error('Error initializing WhatsApp session:', qrError);
      
      await supabase
        .from('whatsapp_sessoes')
        .delete()
        .eq('id', sessionId);

      return NextResponse.json(
        { error: 'Failed to initialize WhatsApp session' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Init session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
