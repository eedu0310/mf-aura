import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import whatsappService from '@/lib/whatsapp-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
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
      .eq('id', sessionId)
      .eq('vendor_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    await whatsappService.logoutSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session logged out successfully',
    });
  } catch (error) {
    console.error('Logout session error:', error);
    return NextResponse.json(
      { error: 'Failed to logout session' },
      { status: 500 }
    );
  }
}
