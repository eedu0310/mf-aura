import type { Metadata } from "next";
import { PaginaLegal, RESPONSAVEL } from "@/components/legal/pagina-legal";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizada="25/11/2026">
      <p>
        O AURA CRM é o sistema interno de atendimento e vendas do Grupo MF (LF Lareiras, A&amp;G Aquecimento, Sole Ferro e
        Fogo e MF International). É usado somente pelas equipes dessas empresas para atender os próprios clientes. O
        responsável pelos dados é a {RESPONSAVEL.empresa}, {RESPONSAVEL.cidade}.
      </p>

      <h2>Que dados tratamos</h2>
      <ul>
        <li>
          <strong>Instagram das lojas:</strong> mensagens diretas enviadas às contas do Instagram das lojas, comentários nas
          publicações delas, nome de usuário, nome e foto de perfil de quem escreveu, e as respostas da equipe.
        </li>
        <li>
          <strong>WhatsApp e chat do site:</strong> mensagens trocadas com a equipe, nome e telefone informados pelo cliente.
        </li>
        <li>
          <strong>Formulários das lojas:</strong> nome, telefone, e-mail, cidade e interesse informados pelo cliente.
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Responder o cliente pela própria loja que ele procurou, no Instagram, WhatsApp ou site.</li>
        <li>Registrar o atendimento no CRM (histórico, orçamento, pós-venda) para o cliente não precisar repetir informações.</li>
        <li>
          Quando a loja liga, um assistente virtual pode responder enquanto a equipe não está disponível, sempre se
          apresentando como assistente virtual.
        </li>
      </ul>
      <p>
        Não vendemos, alugamos nem compartilhamos esses dados com terceiros para publicidade. Os dados do Instagram são
        usados apenas para o atendimento da conta da loja que os recebeu.
      </p>
      <p>
        Para funcionar, o AURA usa prestadores de serviço que tratam os dados só em nome das lojas e só para esta
        finalidade: Supabase (banco de dados e arquivos), Anthropic (a inteligência artificial que sugere e escreve as
        respostas do assistente virtual e organiza o atendimento) e OpenAI (transcrição de áudios recebidos). Eles não
        usam os dados para publicidade.
      </p>

      <h2>Onde ficam e por quanto tempo</h2>
      <p>
        Os dados ficam em servidores com acesso restrito à equipe autorizada de cada loja (banco de dados Supabase e
        servidor próprio do AURA). São mantidos enquanto houver relacionamento comercial com o cliente ou até que ele peça a
        exclusão.
      </p>

      <h2>Seus direitos (LGPD)</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento. Veja como em{" "}
        <a href="/exclusao-de-dados">Exclusão de dados</a>.
      </p>

      <h2>Contato</h2>
      <p>
        E-mail: <a href={`mailto:${RESPONSAVEL.email}`}>{RESPONSAVEL.email}</a> · WhatsApp: {RESPONSAVEL.whatsapp}
      </p>

      <h2>English summary</h2>
      <p>
        AURA CRM is the internal customer-service CRM of Grupo MF (Brazilian fireplace stores). It receives Instagram Direct
        messages and comments sent to the stores&apos; own Instagram accounts only to let each store&apos;s staff read and
        reply to its customers. Data is not sold or shared with third parties for advertising; it is processed only by
        service providers acting on the stores&apos; behalf (Supabase for hosting, Anthropic for the AI assistant, OpenAI
        for audio transcription). Users can request deletion at any time (see{" "}
        <a href="/exclusao-de-dados">Data deletion</a>). Contact: {RESPONSAVEL.email}.
      </p>
    </PaginaLegal>
  );
}
