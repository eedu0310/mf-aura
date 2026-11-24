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
  RotateCcw,
  Pencil,
  Phone,
} from "lucide-react";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { useUserProfile } from "@/lib/user-profile-context";
import {
  TransferirCarteiraCard,
  resumoDaCarteira,
  type CarteiraMovida,
} from "@/components/gestor/transferir-carteira-card";
import { Alerta, Card, CardHeader, EstadoVazio, Selo, classeBotao } from "@/components/ui";

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
  telefone?: string | null;
  permissoes?: Record<string, boolean> | null;
}

const CARGOS = ["Vendedor", "Vendedor Interno", "SDR", "Pós-venda", "Marketing", "Gestor"];

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
  const [editando, setEditando] = useState<Usuario | null>(null);
  // Conta de teste/cadastro incompleto: primeiro clique pede confirmação.
  const [apagandoIncompleto, setApagandoIncompleto] = useState<string | null>(null);
  const [ocupadoIncompleto, setOcupadoIncompleto] = useState(false);

  async function apagarIncompleto(c: Incompleto) {
    setOcupadoIncompleto(true);
    try {
      const resposta = await fetch("/api/admin/excluir-cadastro-incompleto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui apagar.");
      setAviso(`Conta ${c.email} apagada.`);
      setApagandoIncompleto(null);
      await carregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não consegui apagar.");
    } finally {
      setOcupadoIncompleto(false);
    }
  }
  const [senhaNova, setSenhaNova] = useState<{ nome: string; senha: string } | null>(null);
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


  /**
   * Senha nova para quem esqueceu a dela.
   *
   * Confirmação na mão porque a senha antiga para de valer no mesmo instante:
   * se a pessoa estiver trabalhando, ela cai.
   */
  async function redefinirSenha(usuario: Usuario) {
    if (
      !confirm(
        `Gerar uma senha nova para ${usuario.nome}?\n\nA senha atual para de funcionar na hora, e a nova aparece aqui uma vez só.`,
      )
    )
      return;
    setErroForm(null);
    setAviso(null);
    setSenhaNova(null);
    try {
      const resposta = await fetch("/api/admin/senha-provisoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: usuario.id }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui gerar a senha.");
      setSenhaNova({ nome: dados.nome ?? usuario.nome, senha: dados.senhaProvisoria });
    } catch (erro) {
      setErroForm(erro instanceof Error ? erro.message : "Não consegui gerar a senha.");
    }
  }

  async function restaurar(usuario: Usuario) {
    if (!confirm(`Trazer ${usuario.nome} de volta para a equipe?`)) return;
    setErroForm(null);
    setSenhaNova(null);
    try {
      const resposta = await fetch("/api/admin/restaurar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: usuario.id }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui trazer de volta.");
      setAviso(
        `${dados.nome ?? usuario.nome} voltou para a equipe e já consegue entrar.` +
          (dados.era_mestre
            ? " Ele era gestor mestre: devolva esse poder na aba Permissões, se for o caso."
            : usuario.cargo === "Gestor"
              ? " Como gestor, ele volta esperando aprovação na aba Permissões."
              : "") +
          " A carteira dele não volta sozinha — use Transferir carteira se precisar devolver." +
          (dados.aviso ? ` ${dados.aviso}` : ""),
      );
      await carregar();
    } catch (erro) {
      setErroForm(erro instanceof Error ? erro.message : "Não consegui trazer de volta.");
    }
  }

  return (
    <div className="space-y-6">
      <TransferirCarteiraCard aoTransferir={carregar} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setModalAberto(true)}
          className={classeBotao("primario")}
        >
          <Plus size={15} />
          Novo Usuário
        </button>

        {souMestre && lojas.length > 1 && (
          <select
            value={lojaFiltro}
            onChange={(e) => setLojaFiltro(e.target.value)}
            className="aura-input w-auto min-w-44"
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
            className="h-4 w-4 accent-aura-petrol-600"
          />
          Mostrar quem já foi excluído
        </label>
      </div>

      {erroForm && !modalAberto && (
        <Alerta tom="perigo" titulo={erroForm} />
      )}
      {aviso && (
        <Alerta tom="sucesso" titulo={aviso} />
      )}
      {senhaNova && (
        <Alerta
          tom="sucesso"
          icone={KeyRound}
          titulo={<>Senha nova de {senhaNova.nome}</>}
          descricao={
            <>
              <p>
                Entregue agora: ela aparece uma vez só e não fica guardada em lugar nenhum. Peça para a
                pessoa trocar depois de entrar.
              </p>
              <p className="mt-2 select-all rounded-lg border border-aura-mist bg-aura-sunken px-3 py-2 font-mono text-base text-aura-graphite">
                {senhaNova.senha}
              </p>
              <button
                type="button"
                onClick={() => setSenhaNova(null)}
                className={classeBotao("fantasma", "sm", "mt-2 -ml-2.5")}
              >
                Já anotei, pode esconder
              </button>
            </>
          }
        />
      )}

      {/* Contas que criaram acesso e não terminaram o cadastro. Sem esta
          lista, essas pessoas ficavam invisíveis em todo o sistema: o gestor
          não tinha como saber que elas existiam nem como ajudar. */}
      {incompletos.length > 0 && (
        <Card>
          <CardHeader
            icone={AlertTriangle}
            corIcone="text-aura-warning"
            titulo={
              incompletos.length === 1
                ? "1 pessoa criou o acesso e não terminou o cadastro"
                : `${incompletos.length} pessoas criaram o acesso e não terminaram o cadastro`
            }
            descricao="Elas conseguem entrar, mas não têm nome, loja nem cargo — então não aparecem em nenhuma lista, não recebem lead e não contam em relatório. Peça para entrarem e concluírem a tela de cadastro."
            className="mb-3"
          />
          <ul className="divide-y divide-aura-mist rounded-lg border border-aura-mist">
                {incompletos.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-aura-graphite">
                    <Mail size={13} className="text-aura-graphite-soft" />
                    <span className="font-mono text-xs">{c.email}</span>
                    <span className="text-xs text-aura-graphite-soft">
                      desde {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    {souMestre &&
                      (apagandoIncompleto === c.id ? (
                        <span className="ml-auto flex items-center gap-1">
                          <span className="text-xs font-medium text-aura-danger">Apagar de vez? Não dá para desfazer.</span>
                          <button
                            type="button"
                            onClick={() => apagarIncompleto(c)}
                            disabled={ocupadoIncompleto}
                            className={classeBotao("perigo", "sm")}
                          >
                            {ocupadoIncompleto ? "Apagando..." : "Sim, apagar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setApagandoIncompleto(null)}
                            className={classeBotao("fantasma", "sm")}
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApagandoIncompleto(c.id)}
                          className={classeBotao("perigo-suave", "sm", "ml-auto")}
                          title="Apagar esta conta (teste ou cadastro por engano)"
                        >
                          <Trash2 size={12} /> Apagar
                        </button>
                      ))}
                  </li>
                ))}
          </ul>
        </Card>
      )}

      {/* Modal de novo usuário */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="aura-card w-full max-w-md rounded-xl p-5 shadow-xl">
            <h2 className="font-display text-lg font-semibold text-aura-graphite">Novo Usuário</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-aura-graphite">Nome</label>
                <input
                  type="text"
                  value={novoUsuario.nome}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                  className="aura-input mt-1.5"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-aura-graphite">Email</label>
                <input
                  type="email"
                  value={novoUsuario.email}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                  className="aura-input mt-1.5"
                  placeholder="email@empresa.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-aura-graphite">Cargo</label>
                <select
                  value={novoUsuario.cargo}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, cargo: e.target.value })}
                  className="aura-input mt-1.5"
                >
                  <option>Vendedor</option>
                  <option>Vendedor Interno</option>
                  <option>SDR</option>
                  <option>Pós-venda</option>
                  <option>Marketing</option>
                  <option>Gestor</option>
                </select>
                {novoUsuario.cargo === "Gestor" && (
                  <p className="mt-1 text-xs text-aura-gold-700">
                    Gestor criado aqui ainda precisa ser aprovado na aba Permissões.
                  </p>
                )}
              </div>
            </div>

            {erroForm && (
              <Alerta tom="perigo" titulo={erroForm} className="mt-4" />
            )}

            {credencial && (
              <Alerta
                tom="sucesso"
                className="mt-4"
                titulo="Acesso criado."
                descricao={
                  <>
                    <p>Entregue estes dados para a pessoa (ela troca a senha depois):</p>
                    <div className="mt-2 select-all rounded-lg border border-aura-mist bg-aura-sunken px-3 py-2 font-mono text-xs text-aura-graphite">
                      <p>E-mail: {credencial.email}</p>
                      <p>Senha provisória: {credencial.senha}</p>
                    </div>
                  </>
                }
              />
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  setModalAberto(false);
                  setErroForm(null);
                  setCredencial(null);
                }}
                className={classeBotao("secundario", "md", "flex-1")}
              >
                {credencial ? "Fechar" : "Cancelar"}
              </button>
              <button
                onClick={adicionarUsuario}
                disabled={salvando}
                className={classeBotao("primario", "md", "flex-1")}
              >
                {salvando ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <ModalEditar
          alvo={editando}
          souMestre={souMestre}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (mensagem) => {
            setEditando(null);
            setAviso(mensagem);
            await carregar();
          }}
        />
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
          <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-500" />
        </div>
      ) : usuarios.length === 0 ? (
        <EstadoVazio titulo="Nenhuma pessoa cadastrada nesta seleção." />
      ) : (
        <div className="aura-card divide-y divide-aura-mist overflow-hidden">
          {usuarios.map((user) => (
            <div
              key={user.id}
              className={`p-4 transition ${
                user.excluido
                  ? "bg-aura-sunken/60 opacity-70"
                  : user.ativo
                    ? "hover:bg-aura-sunken/40"
                    : "bg-aura-sunken/40 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-aura-graphite">{user.nome}</p>
                    {user.excluido ? (
                      <Selo tom="neutro">Excluído</Selo>
                    ) : !user.ativo ? (
                      <Selo tom="perigo">Inativo</Selo>
                    ) : null}
                    {user.gestor_mestre && (
                      <Selo tom="marca">Gestor mestre</Selo>
                    )}
                    {user.cargo === "Gestor" && !user.gestor_aprovado && !user.excluido && (
                      <Selo tom="atencao">Aguardando aprovação</Selo>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-aura-graphite-soft">
                    <Mail size={13} />
                    {user.email || "Sem e-mail de acesso"}
                  </div>
                  {user.telefone && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-aura-graphite-soft">
                      <Phone size={13} />
                      {user.telefone}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-aura-graphite-soft">
                    {user.cargo} · {user.empresa}
                  </p>
                  {user.semAcesso && !user.excluido && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-aura-gold-700">
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

                {user.excluido ? (
                  souMestre && (
                    <button
                      onClick={() => restaurar(user)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-aura-mist bg-aura-surface text-aura-graphite-soft transition shrink-0 hover:border-aura-petrol-500/40 hover:text-aura-petrol-600"
                      title="Trazer de volta para a equipe"
                    >
                      <RotateCcw size={15} />
                    </button>
                  )
                ) : (
                  <div className="flex shrink-0 gap-2">
                    {(souMestre || !user.gestor_mestre) && (
                      <button
                        onClick={() => {
                          setAviso(null);
                          setEditando(user);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-aura-mist bg-aura-surface text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-petrol-600"
                        title="Editar dados: nome, e-mail, telefone, cargo, loja e permissões"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => redefinirSenha(user)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-aura-mist bg-aura-surface text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
                      title="Gerar uma senha nova para entregar a esta pessoa"
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      onClick={() => toggleAtivar(user)}
                      title={
                        user.ativo
                          ? "Desativar: tira o acesso e os leads novos, mantém tudo no lugar"
                          : "Reativar o acesso"
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-aura-mist bg-aura-surface text-aura-graphite-soft transition ${
                        user.ativo
                          ? "hover:bg-aura-warning/10 hover:text-aura-warning"
                          : "text-aura-success hover:bg-aura-success/10"
                      }`}
                    >
                      <Power size={15} />
                    </button>
                    {souMestre && (
                      <button
                        onClick={() => {
                          setAviso(null);
                          setExcluindo(user);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-aura-mist bg-aura-surface text-aura-graphite-soft transition hover:bg-aura-danger/10 hover:text-aura-danger"
                        title="Excluir da equipe e passar a carteira para outra pessoa"
                      >
                        <Trash2 size={15} />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aura-danger/10">
            <UserX size={18} className="text-aura-danger" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-aura-graphite">
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
            <p className="mt-1.5 rounded-lg border border-aura-warning/30 bg-aura-warning/10 px-3 py-2 text-xs text-aura-graphite">
              Não há ninguém ativo em {alvo.empresa} para receber a carteira. Se {alvo.nome} tiver
              clientes, a exclusão vai ser recusada — cadastre ou reative alguém da loja primeiro.
            </p>
          ) : (
            <>
              <select
                value={herdeiro}
                onChange={(e) => setHerdeiro(e.target.value)}
                className="aura-input mt-1.5"
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
            className="aura-input mt-1.5"
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
            className="aura-input mt-1.5"
          />
        </div>

        {erro && <Alerta tom="perigo" titulo={erro} className="mt-4" />}

        <div className="mt-6 flex gap-2">
          <button
            onClick={aoFechar}
            className={classeBotao("secundario", "md", "flex-1")}
          >
            Cancelar
          </button>
          <button
            onClick={excluir}
            disabled={enviando || !nomeConfere}
            className={classeBotao("perigo", "md", "flex-1")}
          >
            {enviando && <Loader2 size={15} className="animate-spin" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

interface Permissao {
  chave: string;
  rotulo: string;
  ajuda: string;
  padrao: boolean;
}

/**
 * Editar os dados de alguém da equipe. Pensado para a troca de pessoa numa
 * vaga (24/11: a Sabrina saiu e o acesso passou para a Jaqueline): muda o
 * nome, o e-mail de acesso e o telefone; o mestre também muda a loja e as
 * permissões. A senha não muda aqui — use a chave para gerar uma provisória.
 */
function ModalEditar({
  alvo,
  souMestre,
  aoFechar,
  aoSalvar,
}: {
  alvo: Usuario;
  souMestre: boolean;
  aoFechar: () => void;
  aoSalvar: (mensagem: string) => void | Promise<void>;
}) {
  const [nome, setNome] = useState(alvo.nome);
  const [email, setEmail] = useState(alvo.email ?? "");
  const [telefone, setTelefone] = useState(alvo.telefone ?? "");
  const [cargo, setCargo] = useState(alvo.cargo);
  const [empresa, setEmpresa] = useState(alvo.empresa);
  const [catalogo, setCatalogo] = useState<Permissao[]>([]);
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>(alvo.permissoes ?? {});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!souMestre) return;
    let vivo = true;
    fetch("/api/gestor/permissoes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!vivo || !j) return;
        setCatalogo((j.permissoes ?? []) as Permissao[]);
        const atual = (j.pessoas ?? []).find((p: { id: string }) => p.id === alvo.id);
        if (atual?.permissoes) setPermissoes(atual.permissoes);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [souMestre, alvo.id]);

  const ligada = (p: Permissao) => permissoes[p.chave] ?? p.padrao;
  const mudouLoja = empresa !== alvo.empresa;
  const mudouEmail = email.trim().toLowerCase() !== (alvo.email ?? "").toLowerCase();

  async function salvar() {
    setErro(null);
    setEnviando(true);
    try {
      const corpo: Record<string, unknown> = { id: alvo.id, nome, telefone, cargo };
      if (alvo.email || email.trim()) corpo.email = email;
      if (souMestre) corpo.empresa = empresa;
      const resposta = await fetch("/api/admin/editar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui salvar.");

      if (souMestre && catalogo.length) {
        const original = alvo.permissoes ?? {};
        const mudou = catalogo.some((p) => (permissoes[p.chave] ?? p.padrao) !== (original[p.chave] ?? p.padrao));
        if (mudou) {
          const limpo = Object.fromEntries(catalogo.map((p) => [p.chave, ligada(p)]));
          const r2 = await fetch("/api/gestor/permissoes", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: alvo.id, permissoes: limpo }),
          });
          const d2 = await r2.json().catch(() => ({}));
          if (!r2.ok) throw new Error(`Os dados foram salvos, mas as permissões não: ${d2.erro ?? "erro"}`);
        }
      }

      await aoSalvar(
        dados.emailTrocado
          ? `Dados de ${nome.trim()} salvos. O acesso agora é pelo e-mail ${email.trim().toLowerCase()}; gere uma senha provisória na chave para entregar a ela.`
          : `Dados de ${nome.trim()} salvos.`,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "aura-input mt-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="editar-usuario-titulo">
      <div className="aura-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-5 shadow-xl">
        <h2 id="editar-usuario-titulo" className="font-display text-lg font-semibold text-aura-graphite">
          Editar dados
        </h2>
        <p className="mt-1 text-sm text-aura-graphite-soft">{alvo.nome}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-aura-graphite" htmlFor="ed-nome">Nome completo</label>
            <input id="ed-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-aura-graphite" htmlFor="ed-email">E-mail de acesso</label>
            <input id="ed-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
            {mudouEmail && alvo.email && (
              <p className="mt-1 text-xs text-aura-gold-700">
                A pessoa passa a entrar com o e-mail novo. A senha não muda: gere uma provisória na chave depois de salvar.
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-aura-graphite" htmlFor="ed-tel">Telefone</label>
            <input id="ed-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(54) 99999-9999" className={campo} />
          </div>
          <div>
            <label className="text-sm font-medium text-aura-graphite" htmlFor="ed-cargo">Cargo</label>
            <select id="ed-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} className={campo}>
              {CARGOS.filter((c) => souMestre || c !== "Gestor" || alvo.cargo === "Gestor").map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {souMestre && (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-aura-graphite" htmlFor="ed-loja">Loja</label>
              <select id="ed-loja" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={campo}>
                {NOMES_EMPRESAS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              {mudouLoja && (
                <p className="mt-1 text-xs text-aura-gold-700">
                  A pessoa passa a atuar na {empresa}. Os clientes que ela já tem continuam na {alvo.empresa}; se precisar, use Transferir carteira.
                </p>
              )}
            </div>
          )}
        </div>

        {souMestre && catalogo.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium text-aura-graphite">Permissões</p>
            <ul className="mt-2 divide-y divide-aura-mist rounded-lg border border-aura-mist">
              {catalogo.map((p) => (
                <li key={p.chave} className="flex items-start gap-3 px-3 py-2">
                  <input
                    id={`perm-${p.chave}`}
                    type="checkbox"
                    checked={ligada(p)}
                    onChange={(e) => setPermissoes((atual) => ({ ...atual, [p.chave]: e.target.checked }))}
                    className="mt-1 h-4 w-4 accent-aura-petrol-600"
                  />
                  <label htmlFor={`perm-${p.chave}`} className="text-sm">
                    <span className="text-aura-graphite">{p.rotulo}</span>
                    <span className="block text-xs text-aura-graphite-soft">{p.ajuda}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {erro && <Alerta tom="perigo" titulo={erro} className="mt-4" />}

        <div className="mt-6 flex gap-2">
          <button
            onClick={aoFechar}
            className={classeBotao("secundario", "md", "flex-1")}
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={enviando || nome.trim().length < 2}
            className={classeBotao("primario", "md", "flex-1")}
          >
            {enviando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
