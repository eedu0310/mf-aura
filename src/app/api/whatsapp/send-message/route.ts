import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import whatsappService from '@/lib/whatsapp-service';

export async function POST(request: NextRequest) {
  try {
    const { session_id, contact_number, message } = await request.json();

    if (!session_id || !contact_number || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessoes')
      .select('*')
      .eq('id', session_id)
      .eq('vendor_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (!session.is_connected) {
      return NextResponse.json(
        { error: 'Session is not connected' },
        { status: 400 }
      );
    }

    await whatsappService.sendMessage(session_id, contact_number, message);

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully',
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
