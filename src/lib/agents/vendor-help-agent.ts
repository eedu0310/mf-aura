import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

interface WhatsAppMessage {
  id: string;
  conversationId: string;
  sender: string;
  text: string;
  timestamp: string;
  isFromMe: boolean;
  phoneNumber: string;
}

interface VendorContext {
  vendorId: string;
  companyId: string;
  vendorName: string;
  phoneNumber: string;
  currentRanking: number;
  totalRanking: number;
  monthTarget: number;
  monthSales: number;
  recentMessages: WhatsAppMessage[];
}

interface AgentSuggestion {
  id: string;
  vendorId: string;
  type: 'opportunity' | 'follow_up' | 'objection_handling' | 'negotiation';
  title: string;
  description: string;
  suggestedAction: string;
  relatedMessageId: string;
  confidence: number;
  createdAt: Date;
}

class VendorHelpAgent {
  private anthropic: Anthropic;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async processVendorMessages(): Promise<void> {
    try {
      console.log('[AGENT] Iniciando processamento de mensagens...');

      const { data: vendors, error: vendorError } = await this.supabase
        .from('users')
        .select('id, company_id, full_name, phone')
        .eq('role', 'vendedor')
        .eq('is_active', true);

      if (vendorError) throw vendorError;

      for (const vendor of vendors || []) {
        await this.processVendorActivity(vendor);
      }

      console.log('[AGENT] Processamento concluído');
    } catch (error) {
      console.error('Erro ao processar agente:', error);
    }
  }

  private async processVendorActivity(vendor: any): Promise<void> {
    try {
      const context = await this.getVendorContext(vendor.id, vendor.company_id);
      if (!context.recentMessages.length) return;

      const unprocessedMessages = await this.getUnprocessedMessages(vendor.id);
      if (!unprocessedMessages.length) return;

      for (const message of unprocessedMessages) {
        const suggestions = await this.analyzeMessage(message, context);

        for (const suggestion of suggestions) {
          await this.storeSuggestion(vendor.id, suggestion);
          await this.notifyVendor(vendor.id, suggestion);
        }

        await this.markMessageProcessed(message.id);
      }
    } catch (error) {
      console.error(`Erro ao processar vendedor ${vendor.id}:`, error);
    }
  }

  private async getVendorContext(
    vendorId: string,
    companyId: string
  ): Promise<VendorContext> {
    const { data: vendor, error: vendorError } = await this.supabase
      .from('users')
      .select('id, full_name, phone')
      .eq('id', vendorId)
      .single();

    if (vendorError) throw vendorError;

    return {
      vendorId,
      companyId,
      vendorName: vendor.full_name,
      phoneNumber: vendor.phone,
      currentRanking: 0,
      totalRanking: 10,
      monthTarget: 100000,
      monthSales: 50000,
      recentMessages: [],
    };
  }

  private async getUnprocessedMessages(vendorId: string): Promise<WhatsAppMessage[]> {
    const { data, error } = await this.supabase
      .from('whatsapp_mensagens')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('agent_processed', false)
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) throw error;
    return data || [];
  }

  private async analyzeMessage(
    message: WhatsAppMessage,
    context: VendorContext
  ): Promise<AgentSuggestion[]> {
    const systemPrompt = this.buildSystemPrompt(context);

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [
        {
          name: 'create_suggestion',
          description:
            'Criar uma sugestão para o vendedor baseado na análise da mensagem',
          input_schema: {
            type: 'object' as const,
            properties: {
              type: {
                type: 'string',
                enum: ['opportunity', 'follow_up', 'objection_handling', 'negotiation'],
                description: 'Tipo de sugestão',
              },
              title: {
                type: 'string',
                description: 'Título breve da sugestão (max 50 chars)',
              },
              description: {
                type: 'string',
                description: 'Análise detalhada do que o agente encontrou (max 200 chars)',
              },
              suggestedAction: {
                type: 'string',
                description: 'Ação específica que o vendedor deve tomar (max 150 chars)',
              },
              confidence: {
                type: 'number',
                description: 'Pontuação de confiança de 0 a 1',
              },
            },
            required: [
              'type',
              'title',
              'description',
              'suggestedAction',
              'confidence',
            ],
          },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Analise esta mensagem WhatsApp de um cliente:\n\n"${message.text}"\n\nForneca sugestões para ajudar o vendedor a responder efetivamente.`,
        },
      ],
    });

    const suggestions: AgentSuggestion[] = [];

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        if (block.name === 'create_suggestion') {
          const input = block.input as any;
          suggestions.push({
            id: block.id,
            vendorId: context.vendorId,
            type: input.type,
            title: input.title,
            description: input.description,
            suggestedAction: input.suggestedAction,
            relatedMessageId: message.id,
            confidence: input.confidence,
            createdAt: new Date(),
          });
        }
      }
    }

    return suggestions;
  }

  private buildSystemPrompt(context: VendorContext): string {
    return `Você é um treinador de vendas inteligente ajudando um vendedor em um sistema CRM. Seu papel é analisar mensagens de clientes e fornecer sugestões acionáveis para melhorar a eficácia nas vendas.

Contexto do Vendedor:
- Nome: ${context.vendorName}
- Ranking: ${context.currentRanking}/${context.totalRanking}
- Meta Mensal: R$ ${context.monthTarget.toLocaleString('pt-BR')}
- Vendas Mês Atual: R$ ${context.monthSales.toLocaleString('pt-BR')} (${((context.monthSales / context.monthTarget) * 100).toFixed(1)}%)

Suas responsabilidades:
1. Identificar oportunidades de vendas nas mensagens dos clientes
2. Detectar objeções e sugerir estratégias de tratamento
3. Recomendar ações de acompanhamento baseadas na intenção do cliente
4. Propor táticas de negociação quando apropriado

Foque em insights acionáveis que ajudem o vendedor a fechar mais negócios e melhorar seu ranking.`;
  }

  private async storeSuggestion(
    vendorId: string,
    suggestion: AgentSuggestion
  ): Promise<void> {
    const { error } = await this.supabase
      .from('agent_suggestions')
      .insert({
        vendor_id: vendorId,
        type: suggestion.type,
        title: suggestion.title,
        description: suggestion.description,
        suggested_action: suggestion.suggestedAction,
        related_message_id: suggestion.relatedMessageId,
        confidence: suggestion.confidence,
        is_read: false,
        is_applied: false,
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('Erro ao armazenar sugestão:', error);
    }
  }

  private async markMessageProcessed(messageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('whatsapp_mensagens')
      .update({ agent_processed: true })
      .eq('id', messageId);

    if (error) console.error('Erro ao marcar mensagem como processada:', error);
  }

  private async notifyVendor(
    vendorId: string,
    suggestion: AgentSuggestion
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from('notifications').insert({
        vendor_id: vendorId,
        type: 'agent_suggestion',
        title: `Nova sugestão: ${suggestion.title}`,
        message: suggestion.description,
        related_suggestion_id: suggestion.id,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      if (error) console.error('Erro ao notificar vendedor:', error);
    } catch (error) {
      console.error('Erro ao notificar vendedor:', error);
    }
  }
}

export default new VendorHelpAgent();
