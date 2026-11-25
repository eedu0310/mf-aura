import type { Metadata } from "next";
import { PaginaLegal, RESPONSAVEL } from "@/components/legal/pagina-legal";

export const metadata: Metadata = { title: "Exclusão de dados" };

export default function ExclusaoDeDados() {
  return (
    <PaginaLegal titulo="Exclusão de dados" atualizada="25/11/2026">
      <p>
        Se você conversou com uma das lojas do Grupo MF pelo Instagram, WhatsApp ou site e quer que seus dados sejam
        apagados do AURA CRM, peça por um destes canais:
      </p>
      <ul>
        <li>
          E-mail para <a href={`mailto:${RESPONSAVEL.email}`}>{RESPONSAVEL.email}</a> com o assunto &quot;Excluir meus
          dados&quot;;
        </li>
        <li>WhatsApp {RESPONSAVEL.whatsapp};</li>
        <li>ou uma mensagem direta para a conta do Instagram da loja escrevendo &quot;excluir meus dados&quot;.</li>
      </ul>
      <p>
        Informe seu nome de usuário do Instagram (ou o telefone usado). Apagamos as conversas, comentários e dados de
        contato ligados a você em até 30 dias e confirmamos pelo mesmo canal. Dados que a lei obriga a guardar (por exemplo,
        notas fiscais de compras) ficam apenas pelo prazo legal.
      </p>

      <h2>English</h2>
      <p>
        To delete your data from AURA CRM, email {RESPONSAVEL.email} with the subject &quot;Delete my data&quot;, message
        WhatsApp {RESPONSAVEL.whatsapp}, or send &quot;delete my data&quot; by Direct to the store&apos;s Instagram account.
        Include your Instagram username. We delete your conversations, comments and contact data within 30 days and confirm
        through the same channel.
      </p>
    </PaginaLegal>
  );
}
