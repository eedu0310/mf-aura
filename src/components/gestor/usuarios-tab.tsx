"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Power,
  Loader2,
  Mail,
  AlertTriangle,
  UserX,
  KeyRound,
} from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import {
  TransferirCarteiraCard,
  resumoDaCarteira,
  type CarteiraMovida,
} from "@/components/gestor/transferir-carteira-card";

interface Usuario {
  id: string;
  nome: string;
  email?: string | null;
  cargo: string;
  empresa: string;
  ativo: boolean;
  created_at: string;
  gestor_mestre?: boolean;
  gestor_aprovado?: boolean;
  excluido?: boolean;
  excluido_em?: string | null;
  excluido_motivo?: string | null;
  semAcesso?: boolean;
}

interface Incompleto {
  id: string;
  email: string;
  created_at: string;
}

const CARGOS_COM_CARTEIRA = ["Vendedor", "Vendedor Interno", "SDR", "Pós-venda"];

export function UsuariosTab() {
  const { profile } = useUserProfile();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [incompletos, setIncompletos] = useState<Incompleto[]>([]);
  const [souMestre, setSouMestre] = useState(false);
  const [lojaFiltro, setLojaFiltro] = useState("");
  const [verExcluidos, setVerExcluidos] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);
  const [novoUsuario, setNovoUsuario] = useState({
    nome: "",
    email: "",
    cargo: "Vendedor",
  });

  useEffect(() => {
    void carregar();
  }, [lojaFiltro, verExcluidos]);

  async function carregar() {
    try {
      // Pelo servidor, para vir junto o e-mail de acesso de cada pessoa — ele
      // não fica na tabela de perfis — e as contas sem cadastro terminado.
      const qs = new URLSearchParams();
      if (lojaFiltro) qs.set("loja", lojaFiltro);
      if (verExcluidos) qs.set("incluirExcluidos", "1");
      const resposta = await fetch(`/api/admin/usuarios?${qs}`, { cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui carregar a equipe.");
      setUsuarios((dados.usuarios ?? []) as Usuario[]);
      setIncompletos((dados.incompletos ?? []) as Incompleto[]);
      setSouMestre(Boolean(dados.souMestre));
      setErroForm(null);
    } catch (erro) {
      console.error("Erro ao carregar usuários:", erro);
      setErroForm(erro instanceof Error ? erro.message : "Não consegui carregar a equipe.");
    }
    setCarregando(false);
  }

  const lojas = useMemo(
    () => [...new Set(usuarios.map((u) => u.empresa))].filter(Boolean).sort(),
    [usuarios],
  );

  async function adicionarUsuario() {
    setErroForm(null);
    setCredencial(null);

    if (!novoUsuario.nome.trim() || !novoUsuario.email.trim()) {
      setErroForm("Preencha o nome e o e-mail.");
      return;
    }

    setSalvando(true);
    try {
      // Criado pelo servidor: assim a sessão do gestor não é trocada pela
      // do usuário novo, e a conta já nasce confirmada.
      const resposta = await fetch("/api/admin/criar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novoUsuario.nome.trim(),
          email: novoUsuario.email.trim(),
          cargo: novoUsuario.cargo,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui criar o usuário.");

      setCredencial({ email: dados.email, senha: dados.senhaProvisoria });
      setNovoUsuario({ nome: "", email: "", cargo: "Vendedor" });
      await carregar();
    } catch (erro) {
      setErroForm(erro instanceof Error ? erro.message : "Não consegui criar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivar(usuario: Usuario) {
    setErroForm(null);
    setAviso(null);
    try {
      // Pela rota de administração: além de marcar o perfil como inativo,
      // bloqueia o acesso no Auth. O update direto não bloqueava o login.
      const resposta = await fetch("/api/admin/definir-status-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: usuario.id, ativo: !usuario.ativo }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui atualizar o acesso.");
      await carregar();
    } catch (erro) {
      setErroForm(erro instanceof Error ? erro.message : "Não consegui atualizar o acesso.");
    }
  }

  return (
    <div className="space-y-6">
      <TransferirCarteiraCard aoTransferir={carregar} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 rounded-lg bg-aura-petrol-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-aura-petrol-700"
        >
          <Plus size={18} />
          Novo Usuário
        </button>

        {souMestre && lojas.length > 1 && (
          <select
            value={lojaFiltro}
            onChange={(e) => setLojaFiltro(e.target.value)}
            className="rounded-lg border border-aura-mist px-3 py-2 text-sm"
          >
            <option value="">Todas as lojas</option>
            {lojas.map((loja) => (
              <option key={loja} value={loja}>
                {loja}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <input
            type="checkbox"
            checked={verExcluidos}
            onChange={(e) => setVerExcluidos(e.target.checked)}
            className="rounded border-aura-mist"
          />
          Mostrar quem já foi excluído
        </label>
      </div>

      {erroForm && !modalAberto && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroForm}</p>
      )}
      {aviso && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{aviso}</p>
      )}

      {/* Contas que criaram acesso e não terminaram o cadastro. Sem esta
          lista, essas pessoas ficavam invisíveis em todo o sistema: o gestor
          não tinha como saber que elas existiam nem como ajudar. */}
      {incompletos.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <p className="font-medium text-amber-900">
                {incompletos.length === 1
                  ? "1 pessoa criou o acesso e não terminou o cadastro"
                  : `${incompletos.length} pessoas criaram o acesso e não terminaram o cadastro`}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Elas conseguem entrar, mas não têm nome, loja nem cargo — então não aparecem em
                nenhuma lista, não recebem lead e não contam em relatório. Peça para entrarem e
                concluírem a tela de cadastro.
              </p>
              <ul className="mt-3 space-y-1">
                {incompletos.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm text-amber-900">
                    <Mail size={13} />
                    <span className="font-mono text-xs">{c.email}</span>
                    <span className="text-xs text-amber-700">
                      desde {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Modal de novo usuário */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="font-display text-xl font-bold text-aura-graphite">Novo Usuário</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-aura-graphite">Nome</label>
                <input
                  type="text"
                  value={novoUsuario.nome}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-aura-graphite">Email</label>
                <input
                  type="email"
                  value={novoUsuario.email}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                  placeholder="email@empresa.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-aura-graphite">Cargo</label>
                <select
                  value={novoUsuario.cargo}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, cargo: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
                >
                  <option>Vendedor</option>
                  <option>Vendedor Interno</option>
                  <option>SDR</option>
                  <option>Pós-venda</option>
                  <option>Marketing</option>
                  <option>Gestor</option>
                </select>
                {novoUsuario.cargo === "Gestor" && (
                  <p className="mt-1 text-xs text-amber-700">
                    Gestor criado aqui ainda precisa ser aprovado na aba Permissões.
                  </p>
                )}
              </div>
            </div>

            {erroForm && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroForm}</p>
            )}

            {credencial && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <p className="font-semibold">Acesso criado.</p>
                <p className="mt-1">Entregue estes dados para a pessoa (ela troca a senha depois):</p>
                <p className="mt-2 font-mono text-xs">E-mail: {credencial.email}</p>
                <p className="font-mono text-xs">Senha provisória: {credencial.senha}</p>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  setModalAberto(false);
                  setErroForm(null);
                  setCredencial(null);
                }}
                className="flex-1 rounded-lg border border-aura-mist px-4 py-2 text-sm font-medium text-aura-graphite transition hover:bg-aura-bg"
              >
                {credencial ? "Fechar" : "Cancelar"}
              </button>
              <button
                onClick={adicionarUsuario}
                disabled={salvando}
                className="flex-1 rounded-lg bg-aura-petrol-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-aura-petrol-700 disabled:opacity-50"
              >
                {salvando ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluindo && (
        <ModalExcluir
          alvo={excluindo}
          candidatos={usuarios.filter(
            (u) =>
              u.id !== excluindo.id &&
              u.ativo &&
              !u.excluido &&
              u.empresa === excluindo.empresa &&
              CARGOS_COM_CARTEIRA.includes(u.cargo),
          )}
          aoFechar={() => setExcluindo(null)}
          aoConcluir={async (mensagem) => {
            setExcluindo(null);
            setAviso(mensagem);
            await carregar();
          }}
        />
      )}

      {/* Lista de Usuários */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-aura-petrol-600" />
        </div>
      ) : usuarios.length === 0 ? (
        <p className="rounded-2xl border border-aura-mist bg-white p-6 text-sm text-aura-graphite-soft">
          Nenhuma pessoa cadastrada nesta seleção.
        </p>
      ) : (
        <div className="grid gap-3">
          {usuarios.map((user) => (
            <div
              key={user.id}
              className={`rounded-2xl border p-4 transition ${
                user.excluido
                  ? "border-dashed border-aura-mist bg-aura-bg opacity-70"
                  : user.ativo
                    ? "border-aura-mist bg-white"
                    : "border-aura-mist/50 bg-aura-bg opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-aura-graphite">{user.nome}</p>
                    {user.excluido ? (
                      <span className="rounded-full bg-aura-graphite/10 px-2 py-0.5 text-xs font-medium text-aura-graphite">
                        Excluído
                      </span>
                    ) : !user.ativo ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Inativo
                      </span>
                    ) : null}
                    {user.gestor_mestre && (
                      <span className="rounded-full bg-aura-petrol-100 px-2 py-0.5 text-xs font-medium text-aura-petrol-700">
                        Gestor mestre
                      </span>
                    )}
                    {user.cargo === "Gestor" && !user.gestor_aprovado && !user.excluido && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Aguardando aprovação
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-aura-graphite-soft">
                    <Mail size={14} />
                    {user.email || "Sem e-mail de acesso"}
                  </div>
                  <p className="mt-1 text-xs text-aura-graphite-soft">
                    {user.cargo} · {user.empresa}
                  </p>
                  {user.semAcesso && !user.excluido && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                      <KeyRound size={12} />
                      Cadastro sem conta de acesso: esta pessoa não consegue entrar.
                    </p>
                  )}
                  {user.excluido && (
                    <p className="mt-1 text-xs text-aura-graphite-soft">
                      Excluído em{" "}
                      {user.excluido_em
                        ? new Date(user.excluido_em).toLocaleDateString("pt-BR")
                        : "—"}
                      {user.excluido_motivo ? ` · ${user.excluido_motivo}` : ""}
                    </p>
                  )}
                </div>

                {!user.excluido && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => toggleAtivar(user)}
                      title={
                        user.ativo
                          ? "Desativar: tira o acesso e os leads novos, mantém tudo no lugar"
                          : "Reativar o acesso"
                      }
                      className={`rounded-lg p-2 transition ${
                        user.ativo
                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      <Power size={16} />
                    </button>
                    {souMestre && (
                      <button
                        onClick={() => {
                          setAviso(null);
                          setExcluindo(user);
                        }}
                        className="rounded-lg bg-red-100 p-2 text-red-700 transition hover:bg-red-200"
                        title="Excluir da equipe e passar a carteira para outra pessoa"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Exclusão em duas etapas, porque é a única ação da tela que não se desfaz
 * pelo painel. A primeira pergunta é para quem vai a carteira — se ela
 * ficasse com a pessoa excluída, os clientes virariam invisíveis para toda a
 * equipe, já que cada vendedor só vê a própria carteira.
 */
function ModalExcluir({
  alvo,
  candidatos,
  aoFechar,
  aoConcluir,
}: {
  alvo: Usuario;
  candidatos: Usuario[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void | Promise<void>;
}) {
  const [herdeiro, setHerdeiro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const nomeConfere = confirmacao.trim().toLowerCase() === alvo.nome.trim().toLowerCase();

  async function excluir() {
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/admin/excluir-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioId: alvo.id,
          herdeiroId: herdeiro || null,
          motivo: motivo.trim() || null,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui excluir.");

      const carteira = (dados.carteira ?? null) as CarteiraMovida | null;
      const nomeHerdeiro = candidatos.find((c) => c.id === herdeiro)?.nome;
      await aoConcluir(
        `${alvo.nome} foi excluído da equipe.` +
          (nomeHerdeiro ? ` ${resumoDaCarteira(carteira)} Agora é de ${nomeHerdeiro}.` : "") +
          (dados.aviso ? ` ${dados.aviso}` : ""),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui excluir.");
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-start gap-3">
          <UserX size={20} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <h2 className="font-display text-lg font-bold text-aura-graphite">
              Excluir {alvo.nome}
            </h2>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              Sai de todas as listas do sistema e perde o acesso para sempre. As vendas que ela já
              registrou continuam valendo no histórico e nos relatórios — por isso o nome fica
              guardado no banco.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-aura-graphite">
            Quem assume a carteira dela
          </label>
          {candidatos.length === 0 ? (
            <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Não há ninguém ativo em {alvo.empresa} para receber a carteira. Se {alvo.nome} tiver
              clientes, a exclusão vai ser recusada — cadastre ou reative alguém da loja primeiro.
            </p>
          ) : (
            <>
              <select
                value={herdeiro}
                onChange={(e) => setHerdeiro(e.target.value)}
                className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm"
              >
                <option value="">Ninguém (só se a carteira estiver vazia)</option>
                {candidatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — {c.cargo}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-aura-graphite-soft">
                Vão com ela: clientes, negócios em aberto, conversas de WhatsApp, tarefas,
                compromissos, leads sem resposta e pós-venda. Negócio fechado ou perdido fica com
                quem fechou.
              </p>
            </>
          )}
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-aura-graphite">Motivo (opcional)</label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Saiu da empresa, conta de teste…"
            className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-aura-graphite">
            Digite <span className="font-mono">{alvo.nome}</span> para confirmar
          </label>
          <input
            type="text"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm"
          />
        </div>

        {erro && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="mt-6 flex gap-2">
          <button
            onClick={aoFechar}
            className="flex-1 rounded-lg border border-aura-mist px-4 py-2 text-sm font-medium text-aura-graphite transition hover:bg-aura-bg"
          >
            Cancelar
          </button>
          <button
            onClick={excluir}
            disabled={enviando || !nomeConfere}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {enviando && <Loader2 size={15} className="animate-spin" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
