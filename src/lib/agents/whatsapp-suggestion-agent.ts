import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

interface WhatsAppMessage {
  id: string;
  conversa_id: string;
  texto: string;
  remetente: 'cliente' | 'vendedor' | 'ia' | 'sistema';
  created_at: string;
  phone_number_id: string;
}

interface VendorInfo {
  id: string;
  nome: string;
  email: string;
  empresa_id: string;
  auth_id: string;
}

interface ConversationInfo {
  id: string;
  nome_cliente: string;
  telefone: string;
  ultima_mensagem_preview?: string;
  status: string;
}

interface GeneratedSuggestion {
  type: 'opportunity' | 'follow_up' | 'objection_handling' | 'negotiation' | 'upsell' | 'retention';
  title: string;
  description: string;
  suggested_action: string;
  confidence: number;
}

class WhatsAppSuggestionAgent {
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

  /**
   * Process unprocessed WhatsApp messages and generate suggestions
   */
  async processWhatsAppMessages(vendorId: string): Promise<GeneratedSuggestion[]> {
    try {
      console.log(`[WhatsApp Agent] Processing messages for vendor: ${vendorId}`);

      // Fetch vendor info
      const vendor = await this.getVendorInfo(vendorId);
      if (!vendor) {
        console.error(`[WhatsApp Agent] Vendor not found: ${vendorId}`);
        return [];
      }

      // Fetch unprocessed messages
      const unprocessedMessages = await this.getUnprocessedMessages(vendorId);
      if (unprocessedMessages.length === 0) {
        console.log(`[WhatsApp Agent] No unprocessed messages for vendor: ${vendorId}`);
        return [];
      }

      console.log(
        `[WhatsApp Agent] Found ${unprocessedMessages.length} unprocessed messages for vendor: ${vendorId}`
      );

      const allSuggestions: GeneratedSuggestion[] = [];

      // Process each message
      for (const message of unprocessedMessages) {
        // Fetch conversation info
        const conversation = await this.getConversationInfo(message.conversa_id);
        if (!conversation) continue;

        // Get conversation context (last 10 messages)
        const context = await this.getConversationContext(message.conversa_id);

        // Analyze message with Claude
        const suggestions = await this.analyzeMessageWithClaude(
          message,
          conversation,
          context,
          vendor
        );

        // Store suggestions in database
        for (const suggestion of suggestions) {
          const stored = await this.storeSuggestion(
            vendorId,
            message.conversa_id,
            message.id,
            suggestion
          );

          if (stored) {
            allSuggestions.push(suggestion);
            // Create notification
            await this.createNotification(
              vendorId,
              stored.id,
              suggestion.title,
              suggestion.description
            );
          }
        }

        // Mark message as processed
        await this.markMessageProcessed(message.id);
      }

      console.log(
        `[WhatsApp Agent] Generated ${allSuggestions.length} suggestions for vendor: ${vendorId}`
      );
      return allSuggestions;
    } catch (error) {
      console.error('[WhatsApp Agent] Error processing messages:', error);
      return [];
    }
  }

  /**
   * Analyze a single message with Claude and return suggestions
   */
  private async analyzeMessageWithClaude(
    message: WhatsAppMessage,
    conversation: ConversationInfo,
    context: WhatsAppMessage[],
    vendor: VendorInfo
  ): Promise<GeneratedSuggestion[]> {
    try {
      // Build context string from conversation history
      const contextString = context
        .slice(-10)
        .map((msg) => `${msg.remetente === 'cliente' ? 'Cliente' : 'Vendedor'}: ${msg.texto}`)
        .join('\n');

      const systemPrompt = this.buildSystemPrompt(vendor);

      const userPrompt = `
Analise a seguinte mensagem de cliente e gere sugestões de ação para o vendedor.

INFORMAÇÕES DO CLIENTE:
- Nome: ${conversation.nome_cliente}
- Telefone: ${conversation.telefone}
- Status: ${conversation.status}

HISTÓRICO DA CONVERSA:
${contextString}

NOVA MENSAGEM DO CLIENTE:
${message.texto}

Por favor, analise esta mensagem e gere sugestões acionáveis. Responda APENAS com um JSON array com as seguintes sugestões:

[
  {
    "type": "opportunity|follow_up|objection_handling|negotiation|upsell|retention",
    "title": "Título conciso da sugestão",
    "description": "Descrição detalhada do que foi identificado",
    "suggested_action": "Ação específica que o vendedor deve tomar",
    "confidence": 0.85
  }
]

Gere apenas as sugestões relevantes (máximo 3). Se nenhuma sugestão for relevante, retorne um array vazio [].
`;

      const response = await this.anthropic.messages.create({
        model: 'claude-opus-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Extract text content from response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return [];
      }

      // Parse JSON response
      try {
        const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];

        const suggestions = JSON.parse(jsonMatch[0]) as GeneratedSuggestion[];
        return suggestions;
      } catch (error) {
        console.error('[WhatsApp Agent] Error parsing Claude response:', error);
        return [];
      }
    } catch (error) {
      console.error('[WhatsApp Agent] Error analyzing message:', error);
      return [];
    }
  }

  /**
   * Fetch vendor information
   */
  private async getVendorInfo(vendorId: string): Promise<VendorInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('vendedores')
        .select('id, nome, email, empresa_id, auth_id')
        .eq('id', vendorId)
        .single();

      if (error) {
        console.error('[WhatsApp Agent] Error fetching vendor:', error);
        return null;
      }

      return data as VendorInfo;
    } catch (error) {
      console.error('[WhatsApp Agent] Error fetching vendor:', error);
      return null;
    }
  }

  /**
   * Get unprocessed messages for a vendor
   */
  private async getUnprocessedMessages(vendorId: string): Promise<WhatsAppMessage[]> {
    try {
      // First, get all conversations for this vendor
      const { data: conversations, error: convError } = await this.supabase
        .from('whatsapp_conversas')
        .select('id')
        .eq('empresa', vendorId);

      if (convError || !conversations || conversations.length === 0) {
        return [];
      }

      const conversationIds = conversations.map((c) => c.id);

      // Then get unprocessed messages from those conversations
      const { data: messages, error: msgError } = await this.supabase
        .from('whatsapp_mensagens')
        .select('*')
        .in('conversa_id', conversationIds)
        .eq('remetente', 'cliente')
        .is('agent_processed', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (msgError || !messages) {
        return [];
      }

      return messages as WhatsAppMessage[];
    } catch (error) {
      console.error('[WhatsApp Agent] Error fetching unprocessed messages:', error);
      return [];
    }
  }

  /**
   * Get conversation information
   */
  private async getConversationInfo(conversationId: string): Promise<ConversationInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_conversas')
        .select('id, nome_cliente, telefone, ultima_mensagem_preview, status')
        .eq('id', conversationId)
        .single();

      if (error) {
        console.error('[WhatsApp Agent] Error fetching conversation:', error);
        return null;
      }

      return data as ConversationInfo;
    } catch (error) {
      console.error('[WhatsApp Agent] Error fetching conversation:', error);
      return null;
    }
  }

  /**
   * Get conversation context (last messages)
   */
  private async getConversationContext(conversationId: string): Promise<WhatsAppMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_mensagens')
        .select('*')
        .eq('conversa_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error || !data) {
        return [];
      }

      return data as WhatsAppMessage[];
    } catch (error) {
      console.error('[WhatsApp Agent] Error fetching conversation context:', error);
      return [];
    }
  }

  /**
   * Store suggestion in database
   */
  private async storeSuggestion(
    vendorId: string,
    conversationId: string,
    messageId: string,
    suggestion: GeneratedSuggestion
  ): Promise<{ id: string } | null> {
    try {
      const { data, error } = await this.supabase
        .from('agent_suggestions')
        .insert({
          vendor_id: vendorId,
          conversation_id: conversationId,
          related_message_id: messageId,
          type: suggestion.type,
          title: suggestion.title,
          description: suggestion.description,
          suggested_action: suggestion.suggested_action,
          confidence: suggestion.confidence,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('[WhatsApp Agent] Error storing suggestion:', error);
        return null;
      }

      return data as { id: string };
    } catch (error) {
      console.error('[WhatsApp Agent] Error storing suggestion:', error);
      return null;
    }
  }

  /**
   * Create notification for new suggestion
   */
  private async createNotification(
    vendorId: string,
    suggestionId: string,
    title: string,
    message: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from('agent_notifications').insert({
        vendor_id: vendorId,
        suggestion_id: suggestionId,
        title,
        message,
        notification_type: 'suggestion',
        status: 'unread',
        priority: 'normal',
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[WhatsApp Agent] Error creating notification:', error);
      }
    } catch (error) {
      console.error('[WhatsApp Agent] Error creating notification:', error);
    }
  }

  /**
   * Mark message as processed
   */
  private async markMessageProcessed(messageId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('whatsapp_mensagens')
        .update({ agent_processed: true })
        .eq('id', messageId);

      if (error) {
        console.error('[WhatsApp Agent] Error marking message as processed:', error);
      }
    } catch (error) {
      console.error('[WhatsApp Agent] Error marking message as processed:', error);
    }
  }

  /**
   * Build system prompt for Claude
   */
  private buildSystemPrompt(vendor: VendorInfo): string {
    return `Você é um especialista em vendas e estratégia de atendimento ao cliente. Sua tarefa é analisar mensagens de clientes em conversas de WhatsApp e sugerir ações estratégicas para o vendedor ${vendor.nome}.

Suas responsabilidades principais:
1. Identificar oportunidades de vendas e sugerir como aproveitá-las
2. Detectar objeções dos clientes e recomendar estratégias de tratamento
3. Reconhecer sinais de interesse e propor próximos passos de acompanhamento
4. Identificar chances de negociação e venda adicional (upsell)
5. Detectar sinais de insatisfação ou risco de churn e sugerir retenção

Ao analisar mensagens:
- Considere o contexto da conversa completa
- Identifique emoções e sentimentos implícitos
- Reconheça objeções comuns em vendas
- Sugira ações práticas e imediatas
- Sempre forneça um nível de confiança (0.0 a 1.0) para cada sugestão

Gere apenas sugestões relevantes e acionáveis. Priorize qualidade sobre quantidade.`;
  }
}

export default new WhatsAppSuggestionAgent();
