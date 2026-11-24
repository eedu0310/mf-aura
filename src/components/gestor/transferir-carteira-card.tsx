"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { listarUsuariosPorEmpresa, type Usuario } from "@/lib/supabase/usuarios-management";
import { useUserProfile } from "@/lib/user-profile-context";
import { Card, CardHeader, classeBotao } from "@/components/ui";

/** O que a transferência moveu, para o gestor conferir item por item. */
export interface CarteiraMovida {
  relacionamentos?: number;
  oportunidades?: number;
  tarefas?: number;
  compromissos?: number;
  conversas?: number;
  leads_pendentes?: number;
  pos_vendas?: number;
}

/**
 * Lê o resultado em uma frase. Mostrar sete zeros não ajuda ninguém: só o
 * que de fato mudou de mão aparece.
 */
export function resumoDaCarteira(m: CarteiraMovida | null | undefined): string {
  if (!m) return "Nada para transferir: a carteira estava vazia.";
  const partes: string[] = [];
  const diga = (n: number | undefined, um: string, varios: string) => {
    if (n && n > 0) partes.push(`${n} ${n === 1 ? um : varios}`);
  };
  diga(m.relacionamentos, "cliente", "clientes");
  diga(m.oportunidades, "negócio em aberto", "negócios em aberto");
  diga(m.conversas, "conversa de WhatsApp", "conversas de WhatsApp");
  diga(m.tarefas, "tarefa", "tarefas");
  diga(m.compromissos, "compromisso", "compromissos");
  diga(m.leads_pendentes, "lead sem resposta", "leads sem resposta");
  diga(m.pos_vendas, "pós-venda", "pós-vendas");

  if (!partes.length) return "Nada para transferir: a carteira estava vazia.";
  if (partes.length === 1) return `${partes[0]} mudou de responsável.`;
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)} mudaram de responsável.`;
}

export function TransferirCarteiraCard({ aoTransferir }: { aoTransferir?: () => void }) {
  const { profile } = useUserProfile();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    void listarUsuariosPorEmpresa(profile.empresa).then(setUsuarios);
  }, [profile.empresa]);

  async function transferir() {
    if (!origem || !destino || origem === destino) {
      setErro(true);
      setMensagem("Selecione duas pessoas diferentes.");
      return;
    }

    setProcessando(true);
    setMensagem("");
    setErro(false);

    // A transferência passa por uma rota do servidor que confere o cargo.
    // Chamar a função do banco direto daqui deixava qualquer vendedor
    // logado puxar a carteira de um colega para si.
    const res = await fetch("/api/gestor/transferir-carteira", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem, destino }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErro(true);
      setMensagem(data?.erro ?? "Não consegui transferir a carteira.");
      setProcessando(false);
      return;
    }

    setMensagem(resumoDaCarteira(data as CarteiraMovida));
    setProcessando(false);
    aoTransferir?.();
  }

  const vendedores = usuarios.filter((usuario) =>
    ["Vendedor", "Vendedor Interno", "SDR", "Pós-venda"].includes(usuario.cargo),
  );

  return (
    <Card>
      <CardHeader
        icone={ArrowRightLeft}
        titulo="Transferir carteira"
        descricao="Move clientes, negócios em aberto, conversas, tarefas, compromissos e pós-venda de uma pessoa para outra. Negócio já fechado ou perdido fica com quem fechou."
        className="mb-0!"
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          className="aura-input"
        >
          <option value="">Quem entrega</option>
          {vendedores.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nome}
              {!usuario.ativo ? " (inativo)" : ""}
            </option>
          ))}
        </select>
        <select
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          className="aura-input"
        >
          <option value="">Quem recebe</option>
          {vendedores
            .filter((usuario) => usuario.ativo && usuario.id !== origem)
            .map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nome}
              </option>
            ))}
        </select>
      </div>

      <button
        type="button"
        onClick={transferir}
        disabled={processando}
        className={classeBotao("primario", "md", "mt-3")}
      >
        {processando && <Loader2 size={15} className="animate-spin" />}
        Transferir carteira
      </button>
      {mensagem && (
        <p className={`mt-3 text-xs ${erro ? "text-aura-danger" : "text-aura-graphite-soft"}`}>
          {mensagem}
        </p>
      )}
    </Card>
  );
}
