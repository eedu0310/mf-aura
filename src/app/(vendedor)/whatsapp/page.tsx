"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCheck,
  ChevronDown,
  Loader2,
  LogOut,
  MessageSquarePlus,
  MoreVertical,
  QrCode,
  Search,
  Send,
  Smartphone,
  X,
  ArrowLeft,
} from "lucide-react";
import { Avatar } from "@/components/whatsapp-web/avatar";
import { Composer } from "@/components/whatsapp-web/composer";
import { MediaViewer } from "@/components/whatsapp-web/media-viewer";
import { MessageBubble } from "@/components/whatsapp-web/message-bubble";
import { SupervisorPanel } from "@/components/whatsapp-web/supervisor-panel";
import {
  API,
  ETAPAS_FUNIL,
  PONTO_ETAPA,
  formatDayLabel,
  formatListTime,
  formatPhone,
  postJson,
  type Alerta,
  type Etapa,
  type LeadInfo,
  type WaChat,
  type WaMessage,
  type WaState,
} from "@/components/whatsapp-web/types";

type Filtro = "tudo" | "nao_lidas" | "leads" | "alertas";

// Fundo "doodle" do WhatsApp Web (tema escuro), desenhado só com CSS.
const FUNDO_CHAT: React.CSSProperties = {
  backgroundColor: "#0b141a",
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.045) 1.2px, transparent 1.2px), radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
  backgroundSize: "26px 26px, 38px 38px",
  backgroundPosition: "0 0, 13px 19px",
};

function SeletorEtapa({ etapa, onEscolher, ocupado }: { etapa: Etapa | null; onEscolher: (e: Etapa) => void; ocupado: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-[#3b4a54] px-3 py-1.5 text-sm text-[#e9edef] hover:bg-white/5"
        title="Etapa no pipeline"
      >
        {ocupado ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: etapa ? PONTO_ETAPA[etapa] : "#8696a0" }} />
        )}
        {etapa ?? "Sem etapa"}
        <ChevronDown className="h-4 w-4 text-[#8696a0]" />
      </button>
      {aberto && (
        <div className="absolute right-0 top-10 z-40 w-52 rounded-lg bg-[#233138] py-2 shadow-2xl" onMouseLeave={() => setAberto(false)}>
          {[...ETAPAS_FUNIL, "Perdidos" as Etapa].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setAberto(false);
                if (e !== etapa) onEscolher(e);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-[#182229] ${e === etapa ? "text-[#00a884]" : "text-[#e9edef]"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PONTO_ETAPA[e] }} />
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppPage() {
  const [state, setState] = useState<WaState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [alertasChat, setAlertasChat] = useState<Alerta[]>([]);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [painelIa, setPainelIa] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [menuAberto, setMenuAberto] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [novoNumero, setNovoNumero] = useState("");
  const [novoTexto, setNovoTexto] = useState("");
  const [novoErro, setNovoErro] = useState<string | null>(null);
  const [novoEnviando, setNovoEnviando] = useState(false);
  const [arrastado, setArrastado] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [mudandoEtapa, setMudandoEtapa] = useState(false);
  const [buscandoAntigas, setBuscandoAntigas] = useState(false);
  const [respondendo, setRespondendo] = useState<WaMessage | null>(null);
  const [abaVisivel, setAbaVisivel] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const colarNoFim = useRef(true);

  const status = state?.status ?? "disconnected";
  const connected = status === "connected";
  const chats = useMemo(() => state?.chats ?? [], [state]);
  const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;

  // ------------------------------------------------------------ dados
  const loadState = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setState(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Não foi possível falar com o servidor.");
    }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`${API}?chat=${encodeURIComponent(chatId)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages ?? []);
        setAlertasChat(data.alertas ?? []);
      }
    } catch {
      /* próximo ciclo */
    }
  }, []);

  const loadLead = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`${API}?lead=${encodeURIComponent(chatId)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setLead(data);
    } catch {
      /* próximo ciclo */
    }
  }, []);

  // Vendedor deixa a tela aberta o dia inteiro atras de outra janela. Sem
  // isto, ela continuava pedindo dados tres vezes por segundo para ninguem.
  useEffect(() => {
    function aoMudar() {
      setAbaVisivel(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);

  // Voltou para a tela: atualiza na hora, sem esperar o proximo ciclo.
  useEffect(() => {
    if (!abaVisivel) return;
    loadState();
    if (selectedChatId && connected) {
      loadMessages(selectedChatId);
      loadLead(selectedChatId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaVisivel]);

  // O Supervisor fica sempre aberto em telas largas.
  useEffect(() => {
    if (window.innerWidth >= 1280) setPainelIa(true);
  }, []);

  useEffect(() => {
    loadState();
    if (!abaVisivel) return;
    const t = setInterval(loadState, status === "connected" ? 3000 : 1500);
    return () => clearInterval(t);
  }, [loadState, status, abaVisivel]);

  useEffect(() => {
    setMessages([]);
    setLead(null);
    setAlertasChat([]);
    setViewerId(null);
    colarNoFim.current = true;
    if (!selectedChatId || !connected || !abaVisivel) return;
    loadMessages(selectedChatId);
    loadLead(selectedChatId);
    const t1 = setInterval(() => loadMessages(selectedChatId), 2000);
    const t2 = setInterval(() => loadLead(selectedChatId), 8000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [selectedChatId, connected, abaVisivel, loadMessages, loadLead]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && colarNoFim.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ------------------------------------------------------------ ações
  async function conectar() {
    setBusy(true);
    try {
      const data = await postJson({ action: "connect" });
      if (data?.status) setState((s) => (s ? { ...s, ...data } : s));
      loadState();
    } catch (e: any) {
      setLoadError(e?.message ?? "Erro ao conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function desconectar() {
    setMenuAberto(false);
    if (!window.confirm("Desconectar o WhatsApp deste computador?")) return;
    setBusy(true);
    try {
      await postJson({ action: "logout" });
      setSelectedChatId(null);
      await loadState();
    } catch (e: any) {
      setLoadError(e?.message ?? "Erro ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  function abrirChat(chat: WaChat) {
    setSelectedChatId(chat.id);
    setRespondendo(null);
    if (chat.unread > 0) {
      postJson({ action: "read", chat: chat.id }).catch(() => {});
      setState((s) => (s ? { ...s, chats: s.chats.map((c) => (c.id === chat.id ? { ...c, unread: 0 } : c)) } : s));
    }
  }

  async function mudarEtapa(etapa: Etapa) {
    if (!selectedChatId) return;
    setMudandoEtapa(true);
    try {
      if (!lead?.oportunidadeId) {
        // Ainda não é lead: cadastra primeiro e depois define a etapa.
        await postJson({ action: "ignore", chat: selectedChatId, ignorado: false });
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const res = await fetch(`${API}?lead=${encodeURIComponent(selectedChatId)}`, { cache: "no-store" });
          const info = await res.json();
          if (info?.oportunidadeId) break;
        }
      }
      await postJson({ action: "stage", chat: selectedChatId, etapa });
      await loadLead(selectedChatId);
      loadState();
    } catch (e: any) {
      window.alert(e?.message ?? "Não foi possível mudar a etapa.");
    } finally {
      setMudandoEtapa(false);
    }
  }

  async function carregarAntigas() {
    if (!selectedChatId || buscandoAntigas) return;
    setBuscandoAntigas(true);
    colarNoFim.current = false;
    try {
      await postJson({ action: "older", chat: selectedChatId });
      // O celular responde em alguns segundos; o polling traz as mensagens.
      await new Promise((r) => setTimeout(r, 4000));
      await loadMessages(selectedChatId);
    } catch (e: any) {
      window.alert(e?.message ?? "Não foi possível buscar mensagens anteriores.");
    } finally {
      setBuscandoAntigas(false);
    }
  }

  /**
   * Telefone citado numa mensagem.
   *
   * Se ja existe conversa com aquele numero, abre; senao leva ao "Nova
   * conversa" com o numero preenchido, faltando so escrever o recado. Era
   * o caminho que o vendedor fazia na mao, copiando e colando.
   */
  function abrirNumero(numero: string) {
    const digitos = numero.replace(/\D/g, "");
    const fim = digitos.slice(-8);
    const existente = chats.find((c) => {
      const dele = (c.phone || c.id).replace(/\D/g, "");
      return fim.length === 8 && dele.endsWith(fim);
    });
    if (existente) {
      abrirChat(existente);
      return;
    }
    setNovoNumero(digitos);
    setNovoTexto("");
    setNovoErro(null);
    setNovaAberta(true);
  }

  /** Leva a mensagem que foi citada, e pisca para a pessoa achar. */
  function irParaMensagem(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[#00a884]", "rounded-lg");
    setTimeout(() => el.classList.remove("ring-2", "ring-[#00a884]", "rounded-lg"), 1500);
  }

  async function iniciarConversa() {
    if (!novoNumero.trim() || !novoTexto.trim()) {
      setNovoErro("Preencha o número e a mensagem.");
      return;
    }
    setNovoEnviando(true);
    setNovoErro(null);
    try {
      const data = await postJson({ action: "send", to: novoNumero, text: novoTexto });
      await loadState();
      setSelectedChatId(data.chatId);
      setNovaAberta(false);
      setNovoNumero("");
      setNovoTexto("");
    } catch (e: any) {
      setNovoErro(e?.message ?? "Erro ao enviar.");
    } finally {
      setNovoEnviando(false);
    }
  }

  // ------------------------------------------------------------ listas
  const alertasPorChat = state?.alertas ?? {};
  const totalAlertas = Object.keys(alertasPorChat).length;
  const semResposta = Object.values(alertasPorChat).filter((a) => a.some((x) => x.tipo === "sem_resposta")).length;
  const naoLidas = chats.filter((c) => c.unread > 0).length;

  const chatsFiltrados = chats.filter((c) => {
    const q = busca.trim().toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q.replace(/\D/g, "") || q)) return false;
    const info = state?.leads[c.id];
    if (filtro === "nao_lidas") return c.unread > 0;
    if (filtro === "leads") return !!info?.lead && !info.ignorado;
    if (filtro === "alertas") return !!alertasPorChat[c.id];
    return true;
  });

  const mensagensComDias = useMemo(() => {
    const out: ({ tipo: "dia"; label: string; key: string } | { tipo: "msg"; msg: WaMessage; primeira: boolean })[] = [];
    let diaAnterior = "";
    messages.forEach((m, i) => {
      const dia = new Date(m.timestamp).toDateString();
      if (dia !== diaAnterior) {
        out.push({ tipo: "dia", label: formatDayLabel(m.timestamp), key: `d-${dia}` });
        diaAnterior = dia;
      }
      const ant = messages[i - 1];
      const primeira = !ant || ant.fromMe !== m.fromMe || new Date(ant.timestamp).toDateString() !== dia;
      out.push({ tipo: "msg", msg: m, primeira });
    });
    return out;
  }, [messages]);

  const etapaAtual = lead && !lead.ignorado ? ((lead.etapaPipeline ?? lead.etapa) as Etapa | null) : null;
  const chatAvatarJid = selectedChat ? selectedChat.pnJid ?? selectedChat.id : null;

  // ------------------------------------------------------------ telas
  if (!state) {
    return (
      <div className="flex h-[calc(100dvh-7rem)] items-center justify-center bg-[#111b21]">
        {loadError ? (
          <div className="flex items-center gap-2 rounded-lg bg-[#3d1d22] px-4 py-3 text-sm text-[#f15c6d]">
            <AlertCircle className="h-4 w-4" /> {loadError}
          </div>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
        )}
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] items-center justify-center bg-[#0b141a] p-4">
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-[#111b21] shadow-2xl">
          <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:p-14">
            <div>
              <h1 className="text-[28px] font-light text-[#e9edef]">Use o WhatsApp no AURA</h1>
              <ol className="mt-8 space-y-5 text-[17px] text-[#aebac1]">
                <li className="flex gap-3"><span>1.</span> Abra o WhatsApp no seu celular.</li>
                <li className="flex gap-3">
                  <span>2.</span>
                  <span>Toque em <strong className="text-[#e9edef]">Mais opções ⋮</strong> no Android ou em <strong className="text-[#e9edef]">Configurações</strong> no iPhone.</span>
                </li>
                <li className="flex gap-3"><span>3.</span> <span>Toque em <strong className="text-[#e9edef]">Dispositivos conectados</strong> e, em seguida, em <strong className="text-[#e9edef]">Conectar dispositivo</strong>.</span></li>
                <li className="flex gap-3"><span>4.</span> Aponte seu celular para esta tela para escanear o QR code.</li>
              </ol>
              {state.error && (
                <div className="mt-6 flex items-start gap-2 rounded-lg bg-[#3d3219] px-3 py-2 text-sm text-[#ffd279]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
                </div>
              )}
              {loadError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#3d1d22] px-3 py-2 text-sm text-[#f15c6d]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}
                </div>
              )}
              <div className="mt-8 flex items-start gap-3 rounded-lg bg-[#202c33] px-4 py-3 text-sm text-[#aebac1]">
                <Bot className="mt-0.5 h-5 w-5 shrink-0 text-[#00a884]" />
                Depois de conectar, o Supervisor AURA acompanha suas conversas, cadastra os leads no CRM e move cada um no pipeline automaticamente.
              </div>
            </div>
            <div className="flex h-[280px] w-[280px] items-center justify-center self-center justify-self-center rounded-xl bg-white">
              {status === "qr" && state.qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={state.qrCode} alt="QR code do WhatsApp" className="h-[264px] w-[264px]" />
              ) : status === "connecting" || busy ? (
                <div className="flex flex-col items-center gap-3 text-[#54656f]">
                  <Loader2 className="h-10 w-10 animate-spin text-[#00a884]" />
                  <p className="text-sm">Gerando QR code…</p>
                </div>
              ) : (
                <button type="button" onClick={conectar} className="flex h-full w-full flex-col items-center justify-center gap-3 text-[#54656f]">
                  <QrCode className="h-14 w-14" />
                  <span className="rounded-full bg-[#00a884] px-5 py-2 text-sm font-medium text-white">Conectar WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100dvh-7.5rem)] min-h-[520px] overflow-hidden bg-[#0b141a] lg:h-[calc(100dvh-6rem)]">
      {/* ======================= Lista de conversas ======================= */}
      <div className={`${selectedChatId ? "hidden md:flex" : "flex"} w-full flex-col border-r border-[#222d34] bg-[#111b21] md:w-[380px] md:min-w-[320px] lg:w-[30%] lg:max-w-[440px]`}>
        <header className="flex h-[64px] items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar jid={state.myJid} name={state.name ?? "Eu"} size={40} />
            <h2 className="truncate text-[22px] font-bold text-[#e9edef]">WhatsApp</h2>
          </div>
          <div className="relative flex items-center gap-2 text-[#aebac1]">
            <button type="button" onClick={() => setMenuAberto((v) => !v)} className="rounded-full p-2 hover:bg-white/10" title="Menu">
              <MoreVertical className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setNovaAberta(true);
                setNovoErro(null);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9edef] text-[#111b21] hover:bg-white"
              title="Nova conversa"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </button>
            {menuAberto && (
              <div className="absolute right-0 top-12 z-30 w-60 rounded-lg bg-[#233138] py-2 shadow-2xl">
                <p className="px-5 py-2 text-xs text-[#8696a0]">{state.phone ? formatPhone(state.phone) : ""}</p>
                <button type="button" onClick={desconectar} className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm text-[#e9edef] hover:bg-[#182229]">
                  <LogOut className="h-4 w-4" /> Desconectar
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="px-3 pb-2">
          <div className="flex items-center gap-3 rounded-full bg-[#202c33] px-4 py-2">
            <Search className="h-4 w-4 text-[#8696a0]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar ou começar uma nova conversa"
              className="w-full bg-transparent text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
            />
            {busca && (
              <button type="button" onClick={() => setBusca("")} className="text-[#8696a0]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {([
              ["tudo", "Tudo"],
              ["nao_lidas", `Não lidas${naoLidas ? ` ${naoLidas}` : ""}`],
              ["leads", "Leads"],
              ["alertas", `Alertas${totalAlertas ? ` ${totalAlertas}` : ""}`],
            ] as [Filtro, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm transition ${
                  filtro === id ? "border-[#0a332c] bg-[#0a332c] text-[#00a884]" : "border-[#3b4a54] text-[#aebac1] hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {semResposta > 0 && (
          <button
            type="button"
            onClick={() => setFiltro("alertas")}
            className="mx-3 mb-2 flex items-center gap-3 rounded-lg bg-[#202c33] px-4 py-3 text-left text-sm text-[#aebac1] hover:bg-[#2a3942]"
          >
            <AlertTriangle className="h-6 w-6 shrink-0 text-[#ffd279]" />
            <span>
              <strong className="text-[#e9edef]">
                {semResposta} {semResposta === 1 ? "cliente aguardando" : "clientes aguardando"} resposta.
              </strong>{" "}
              <span className="text-[#00a884]">Ver agora</span>
            </span>
          </button>
        )}

        <div className="flex-1 overflow-y-auto">
          {chatsFiltrados.length === 0 && (
            <p className="px-8 py-12 text-center text-sm text-[#8696a0]">
              {chats.length === 0
                ? "Suas conversas aparecem aqui assim que chegarem mensagens. Use o botão de nova conversa para chamar um cliente."
                : "Nenhuma conversa neste filtro."}
            </p>
          )}
          {chatsFiltrados.map((chat) => {
            const info = state.leads[chat.id];
            const alerta = alertasPorChat[chat.id]?.[0];
            const ativo = chat.id === selectedChatId;
            const etapa = info?.lead && !info.ignorado ? info.etapa : null;
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => abrirChat(chat)}
                className={`flex w-full items-center gap-3 px-3 text-left transition ${ativo ? "bg-[#2a3942]" : "hover:bg-[#202c33]"}`}
              >
                <Avatar jid={chat.pnJid ?? chat.id} name={chat.name} />
                <div className="min-w-0 flex-1 border-b border-[#222d34] py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-[17px] text-[#e9edef]">
                      <span className="truncate">{chat.name}</span>
                      {etapa && <span title={etapa} className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PONTO_ETAPA[etapa] }} />}
                    </p>
                    <span className={`shrink-0 text-xs ${chat.unread ? "text-[#00a884]" : "text-[#8696a0]"}`}>{formatListTime(chat.timestamp)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1 truncate text-sm text-[#8696a0]">
                      {chat.lastFromMe && <CheckCheck className="h-4 w-4 shrink-0 text-[#53bdeb]" />}
                      <span className="truncate">{chat.lastMessage}</span>
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {alerta && (
                        <span title={alerta.texto}>
                          <AlertTriangle className={`h-4 w-4 ${alerta.nivel === "critico" ? "text-[#f15c6d]" : "text-[#ffd279]"}`} />
                        </span>
                      )}
                      {chat.unread > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#00a884] px-1.5 text-xs font-semibold text-[#111b21]">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================= Conversa ======================= */}
      {selectedChat ? (
        <div
          className="relative flex min-w-0 flex-1 flex-col"
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setArrastado(f);
          }}
        >
          <header className="z-10 flex h-[59px] items-center gap-3 bg-[#202c33] px-4">
            <button type="button" onClick={() => setSelectedChatId(null)} className="text-[#aebac1] md:hidden" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Avatar jid={chatAvatarJid} name={selectedChat.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] text-[#e9edef]">{selectedChat.name}</p>
              <p className="truncate text-xs text-[#8696a0]">{selectedChat.hasName ? formatPhone(selectedChat.phone) : "Contato do WhatsApp"}</p>
            </div>
            <SeletorEtapa etapa={etapaAtual} onEscolher={mudarEtapa} ocupado={mudandoEtapa} />
            <button
              type="button"
              onClick={() => setPainelIa((v) => !v)}
              className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${painelIa ? "bg-[#0a332c] text-[#00a884]" : "text-[#aebac1] hover:bg-white/10"}`}
              title="Supervisor AURA"
            >
              <Bot className="h-5 w-5" />
              <span className="hidden sm:inline">Supervisor</span>
              {(alertasChat.length > 0 || (lead?.alertasIa.length ?? 0) > 0) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#f15c6d]" />}
            </button>
          </header>

          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              colarNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="flex-1 overflow-y-auto pb-3"
            style={FUNDO_CHAT}
          >
            {messages.length === 0 ? (
              <div className="mx-auto mt-6 w-fit max-w-md rounded-lg bg-[#182229] px-4 py-2 text-center text-xs text-[#ffd279]">
                Nenhuma mensagem desta conversa foi sincronizada ainda. As novas mensagens aparecem aqui.
              </div>
            ) : (
              <div className="flex justify-center pt-3">
                <button
                  type="button"
                  onClick={carregarAntigas}
                  disabled={buscandoAntigas}
                  className="flex items-center gap-2 rounded-full bg-[#182229] px-4 py-1.5 text-xs text-[#8696a0] shadow hover:text-[#e9edef] disabled:opacity-70"
                >
                  {buscandoAntigas && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {buscandoAntigas ? "Buscando no celular…" : "Carregar mensagens anteriores"}
                </button>
              </div>
            )}
            {mensagensComDias.map((item) =>
              item.tipo === "dia" ? (
                <div key={item.key} className="my-3 flex justify-center">
                  <span className="rounded-lg bg-[#182229] px-3 py-1.5 text-xs text-[#8696a0] shadow">{item.label}</span>
                </div>
              ) : (
                <MessageBubble
                  key={item.msg.id}
                  msg={item.msg}
                  primeiraDoGrupo={item.primeira}
                  onAbrirMidia={setViewerId}
                  avatarJid={item.msg.fromMe ? state.myJid : chatAvatarJid}
                  avatarNome={item.msg.fromMe ? state.name ?? "Eu" : selectedChat.name}
                  onResponder={setRespondendo}
                  onIrPara={irParaMensagem}
                  onAbrirNumero={abrirNumero}
                  nomeDoOutro={selectedChat.name}
                />
              ),
            )}
          </div>

          <Composer
            chatId={selectedChat.id}
            sugestao={lead?.sugestaoResposta ?? null}
            onSent={() => {
              colarNoFim.current = true;
              loadMessages(selectedChat.id);
              loadState();
            }}
            arquivoArrastado={arrastado}
            limparArrastado={() => setArrastado(null)}
            respondendo={respondendo}
            onCancelarResposta={() => setRespondendo(null)}
          />

          {arrastando && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#00a884]/10 text-lg font-medium text-[#00a884] ring-4 ring-inset ring-[#00a884]/40">
              Solte o arquivo para enviar
            </div>
          )}
        </div>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center bg-[#222e35] text-center md:flex">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0a332c]">
            <Smartphone className="h-12 w-12 text-[#00a884]" />
          </div>
          <h2 className="mt-6 text-[30px] font-light text-[#e9edef]">WhatsApp no AURA</h2>
          <p className="mt-3 max-w-md text-sm text-[#8696a0]">
            Envie e receba mensagens, fotos e documentos. O Supervisor AURA acompanha cada conversa, move seus leads no pipeline e avisa quando alguém está esperando resposta.
          </p>
        </div>
      )}

      {/* ======================= Supervisor AURA ======================= */}
      {selectedChat && painelIa && (
        <div className="absolute inset-y-0 right-0 z-40 flex w-full shadow-2xl md:w-[360px] xl:static xl:shadow-none">
          <div className="h-full w-full">
            <SupervisorPanel
              chatId={selectedChat.id}
              lead={lead}
              alertas={alertasChat}
              onClose={() => setPainelIa(false)}
              onChanged={() => {
                loadLead(selectedChat.id);
                loadState();
                setTimeout(() => loadLead(selectedChat.id), 2500);
              }}
            />
          </div>
        </div>
      )}

      {/* ======================= Visualizador de mídia ======================= */}
      {viewerId && selectedChat && (
        <MediaViewer
          mensagens={messages}
          abertoId={viewerId}
          onTrocar={setViewerId}
          onFechar={() => setViewerId(null)}
          contatoJid={chatAvatarJid}
          contatoNome={selectedChat.name}
          meuJid={state.myJid}
          meuNome={state.name ?? "Eu"}
        />
      )}

      {/* ======================= Nova conversa ======================= */}
      {novaAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setNovaAberta(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-[#111b21] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 bg-[#202c33] px-5 py-4 text-[#e9edef]">
              <button type="button" onClick={() => setNovaAberta(false)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-lg">Nova conversa</h3>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-sm text-[#00a884]">
                Número com DDD
                <input
                  type="tel"
                  value={novoNumero}
                  onChange={(e) => setNovoNumero(e.target.value)}
                  placeholder="54 99999-1234"
                  className="mt-1 w-full border-b-2 border-[#00a884] bg-transparent py-2 text-[15px] text-[#e9edef] outline-none placeholder:text-[#8696a0]"
                  autoFocus
                />
              </label>
              <label className="block text-sm text-[#00a884]">
                Mensagem
                <textarea
                  value={novoTexto}
                  onChange={(e) => setNovoTexto(e.target.value)}
                  rows={4}
                  placeholder="Olá! Aqui é da LF Lareiras…"
                  className="mt-1 w-full rounded-md bg-[#2a3942] px-3 py-2 text-[15px] text-[#e9edef] outline-none placeholder:text-[#8696a0]"
                />
              </label>
              {novoErro && <p className="text-sm text-[#f15c6d]">{novoErro}</p>}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={iniciarConversa}
                  disabled={novoEnviando}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] shadow hover:bg-[#06cf9c] disabled:opacity-60"
                  aria-label="Enviar"
                >
                  {novoEnviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
