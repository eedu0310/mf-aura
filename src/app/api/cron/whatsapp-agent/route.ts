import { createClient } from '@supabase/supabase-js';
import WhatsAppSuggestionAgent from '@/lib/agents/whatsapp-suggestion-agent';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase credentials not configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get('Authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🤖 Iniciando agente de sugestões WhatsApp');

    // Fetch all active vendors
    const { data: vendors, error: vendorError } = await supabase
      .from('vendedores')
      .select('id')
      .eq('ativo', true)
      .limit(100);

    if (vendorError || !vendors) {
      console.error('Erro ao buscar vendedores:', vendorError);
      return Response.json({ error: 'Erro ao buscar vendedores' }, { status: 500 });
    }

    console.log(`📊 Processando ${vendors.length} vendedores`);

    let totalSuggestions = 0;
    const results = [];

    // Process each vendor's messages in parallel
    const promises = vendors.map(async (vendor) => {
      try {
        const suggestions = await WhatsAppSuggestionAgent.processWhatsAppMessages(
          vendor.id
        );
        totalSuggestions += suggestions.length;
        return {
          vendorId: vendor.id,
          suggestionsCount: suggestions.length,
          status: 'success',
        };
      } catch (error) {
        console.error(`Erro ao processar agente para ${vendor.id}:`, error);
        return {
          vendorId: vendor.id,
          suggestionsCount: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
      }
    });

    const processedResults = await Promise.allSettled(promises);

    // Collect results
    for (const result of processedResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          vendorId: 'unknown',
          suggestionsCount: 0,
          status: 'error',
          error: 'Promise rejected',
        });
      }
    }

    const sucessos = results.filter((r) => r.status === 'success').length;
    const erros = results.filter((r) => r.status === 'error').length;

    console.log(`✅ Agente finalizado: ${sucessos} sucessos, ${erros} erros, ${totalSuggestions} sugestões geradas`);

    return Response.json({
      success: true,
      totalVendors: vendors.length,
      sucessos,
      erros,
      totalSuggestions,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Erro no cron de agente WhatsApp:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
