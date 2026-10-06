"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  Relacionamento,
  Oportunidade,
  Venda,
  Etapa,
  Atividade,
} from "@/lib/types";
import type { Lead } from "@/lib/supabase/leads";
import { listarLeads as listarLeadsSupabase } from "@/lib/supabase/leads";
import { useUserProfile } from "@/lib/user-profile-context";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  daLinha,
  ehGanho,
  ehPerda,
  FUNIL_PADRAO,
  type EtapaFunil,
} from "@/lib/funil";
import {
  relacionamentoDoBanco,
  relacionamentoParaBanco,
  oportunidadeDoBanco,
  oportunidadeParaBanco,
  vendaDoBanco,
  vendaParaBanco,
  atividadeDoBanco,
  atividadeParaBanco,
} from "@/lib/supabase/mappers";

export interface ResumoEmpresa {
  empresa: string;
  relacionamentos: number;
  valorPipeline: number;
  valorVendido: number;
}

type NovaAtividade = Omit<Atividade, "id" | "criadoEm"> & {
  criadoEm?: string;
};

interface AppDataContextValue {
  /**
   * O funil desta loja, como o gestor deixou.
   *
   * Vive aqui porque quase toda tela precisa dele — o quadro do pipeline, a
   * ficha do cliente, o relatório — e porque as regras que decidem se uma
   * venda entra no mês precisam perguntar o PAPEL da etapa, não comparar o
   * nome dela. Com o funil editável, comparar nome é o que quebra.
   */
  funil: EtapaFunil[];

  carregando: boolean;
  usandoSupabase: boolean;

  relacionamentos: Relacionamento[];
  addRelacionamento: (
    dados: Omit<Relacionamento, "id">,
  ) => Promise<Relacionamento | null>;
  updateRelacionamento: (
    id: string,
    patch: Partial<Relacionamento>,
  ) => Promise<void>;
  deleteRelacionamento: (id: string) => Promise<void>;

  oportunidades: Oportunidade[];
  addOportunidade: (
    dados: Omit<Oportunidade, "id" | "diasParado">,
  ) => Promise<Oportunidade | null>;
  moveOportunidade: (id: string, novaEtapa: Etapa) => Promise<void>;
  updateOportunidade: (id: string, patch: Partial<Oportunidade>) => void;
  deleteOportunidade: (id: string) => void;

  vendas: Venda[];
  addVenda: (
    dados: Omit<Venda, "id">,
    arquivoOrcamento?: File,
  ) => Promise<Venda | null>;
  updateVenda: (id: string, patch: Partial<Venda>) => Promise<void>;
  deleteVenda: (id: string) => Promise<void>;

  atividades: Atividade[];
  addAtividade: (dados: NovaAtividade) => Promise<Atividade | null>;
  deleteAtividade: (id: string) => Promise<boolean>;

  leads: Lead[];
  addLead: (dados: {
    nome?: string;
    telefone: string;
    email?: string;
    empresa: string;
    origem: string;
    mensagemInicial?: string;
  }) => Promise<Lead | null>;

  playbook: string;
  salvarPlaybook: (texto: string) => Promise<boolean>;

  resumoPorEmpresa: ResumoEmpresa[];

  oportunidadesTodasLojas: Oportunidade[];
  vendasTodasLojas: Venda[];

  nomesPorOwnerId: Record<string, string>;

  /**
   * Quem está logado. A tela precisa disto para saber o que é seu: no
   * atendimento em dupla, o cliente aparece para duas pessoas e só uma delas é
   * a dona — comparar com owner_id é a única forma de a tela acertar de quem é
   * a carteira sem perguntar ao servidor.
   */
  meuId: string | null;

  /**
   * Relê tudo do banco. Existe para as ações que mexem no dado por fora do
   * contexto — o atendimento em dupla, por exemplo, é gravado por uma rota de
   * API (porque precisa do service role para alcançar o colega), e sem isto a
   * tela só mostraria a dupla no próximo F5.
   */
  recarregar: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function gerarId(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { profile, carregando: perfilCarregando } = useUserProfile();
  const empresaAtual = profile.empresa;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const usandoSupabase = Boolean(supabase);

  const [funil, setFunil] = useState<EtapaFunil[]>(FUNIL_PADRAO);
  const [todosRelacionamentos, setTodosRelacionamentos] = useState<any[]>(
    [],
  );
  const [todasOportunidades, setTodasOportunidades] = useState<any[]>(
    [],
  );
  const [todasVendas, setTodasVendas] = useState<any[]>(
    [],
  );
  const [todasAtividades, setTodasAtividades] = useState<any[]>(
    [],
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(usandoSupabase);
  const [playbook, setPlaybookState] = useState("");
  const [nomesPorOwnerId, setNomesPorOwnerId] = useState<
    Record<string, string>
  >({});
  const [meuId, setMeuId] = useState<string | null>(null);
  const [pedidoDeRecarga, setPedidoDeRecarga] = useState(0);
  const vejoTudoInicial =
    profile.cargo === "Gestor";

  useEffect(() => {
    if (!supabase || perfilCarregando || !empresaAtual) {
      return;
    }

    let ativo = true;

    async function carregarTudo() {
      setCarregandoDados(true);

      // Quem sou eu. A tela usa isto para distinguir "meu cliente" de "cliente
      // que eu atendo em dupla com alguém", que na lista aparecem lado a lado.
      const { data: eu } = await supabase!.auth.getUser();
      if (ativo) setMeuId(eu.user?.id ?? null);

      const limiteAtividades = vejoTudoInicial ? 400 : 50;
      const [relRes, opRes, vendaRes, ativRes, playbookRes, leadsRes] =
        await Promise.all([
          supabase!
            .from("relacionamentos")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase!
            .from("oportunidades")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase!
            .from("vendas")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase!
            .from("atividades")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limiteAtividades),
          supabase!
            .from("playbook")
            .select("conteudo")
            .eq("empresa", empresaAtual)
            .maybeSingle(),
          supabase!
            .from("leads_recebidos")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

      if (!ativo) return;

      if (relRes.data) {
        const mapeados = relRes.data.map(relacionamentoDoBanco);
        setTodosRelacionamentos(mapeados);
      }

      // O funil da loja vem junto: sem ele a tela desenharia as colunas do
      // desenho antigo e os cards de uma etapa renomeada não teriam coluna
      // nenhuma onde aparecer.
      if (empresaAtual) {
        const { data: etapas } = await supabase!
          .from("etapas_funil")
          .select("nome, ordem, tipo, conta_no_pipeline, probabilidade, cor, ativa, chave")
          .eq("empresa", empresaAtual)
          .order("ordem");
        if (ativo && etapas?.length) setFunil(etapas.map(daLinha));
      }

      if (opRes.data)
        setTodasOportunidades(opRes.data.map(oportunidadeDoBanco));
      if (vendaRes.data) setTodasVendas(vendaRes.data.map(vendaDoBanco));
      if (ativRes.data) setTodasAtividades(ativRes.data.map(atividadeDoBanco));
      if (playbookRes.data) setPlaybookState(playbookRes.data.conteudo ?? "");
      if (leadsRes.data) setLeads(leadsRes.data as Lead[]);

      // O mapa id → nome deixou de ser só do gestor. No atendimento em dupla o
      // vendedor precisa ler o nome do colega com quem divide o cliente, e sem
      // este mapa a tela mostraria um UUID. O gestor continua vendo as quatro
      // lojas; o vendedor vê a dele, porque a RLS de profiles já recorta isso.
      const { data: perfis } = await supabase!
        .from("profiles")
        .select("id, nome");
      if (perfis && ativo) {
        setNomesPorOwnerId(
          Object.fromEntries(perfis.map((p) => [p.id, p.nome as string])),
        );
      }

      setCarregandoDados(false);
    }

    carregarTudo();
    return () => {
      ativo = false;
    };
  }, [supabase, perfilCarregando, empresaAtual, vejoTudoInicial, pedidoDeRecarga]);

  useEffect(() => {
    if (!supabase || !empresaAtual) return;


    function aplicarEvento<T extends { id: string }>(
      setState: Dispatch<SetStateAction<T[]>>,
      payload: {
        eventType: string;
        new: Record<string, unknown>;
        old: Record<string, unknown>;
      },
      doBanco: (linha: Record<string, unknown>) => T,
      tabela: string,
    ) {
      if (payload.eventType === "INSERT") {
        const nova = doBanco(payload.new);
        setState((prev) =>
          prev.some((x) => x.id === nova.id) ? prev : [nova, ...prev],
        );
      } else if (payload.eventType === "UPDATE") {
        const atualizada = doBanco(payload.new);
        setState((prev) =>
          prev.map((x) => (x.id === atualizada.id ? atualizada : x)),
        );
      } else if (payload.eventType === "DELETE") {
        setState((prev) =>
          prev.filter((x) => x.id !== (payload.old.id as string)),
        );
      }
    }

    const canal = supabase
      .channel("aura-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relacionamentos" },
        (payload) =>
          aplicarEvento(
            setTodosRelacionamentos,
            payload as never,
            relacionamentoDoBanco,
            "relacionamentos",
          ),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "oportunidades" },
        (payload) =>
          aplicarEvento(
            setTodasOportunidades,
            payload as never,
            oportunidadeDoBanco,
            "oportunidades",
          ),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendas" },
        (payload) =>
          aplicarEvento(
            setTodasVendas,
            payload as never,
            vendaDoBanco,
            "vendas",
          ),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atividades" },
        (payload) =>
          aplicarEvento(
            setTodasAtividades,
            payload as never,
            atividadeDoBanco,
            "atividades",
          ),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads_recebidos" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const novoLead = payload.new as Lead;
            setLeads((prev) =>
              prev.some((x) => x.id === novoLead.id)
                ? prev
                : [novoLead, ...prev],
            );
          } else if (payload.eventType === "UPDATE") {
            const leadAtualizado = payload.new as Lead;
            setLeads((prev) =>
              prev.map((x) =>
                x.id === leadAtualizado.id ? leadAtualizado : x,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setLeads((prev) =>
              prev.filter((x) => x.id !== (payload.old.id as string)),
            );
          }
        },
      )
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, empresaAtual]);

  const vejoTudo = profile.cargo === "Gestor";
  const relacionamentos = vejoTudo
    ? todosRelacionamentos
    : todosRelacionamentos.filter((r) => r.empresa === empresaAtual);
  const oportunidades = vejoTudo
    ? todasOportunidades
    : todasOportunidades.filter((o) => o.empresa === empresaAtual);
  const vendas = vejoTudo
    ? todasVendas
    : todasVendas.filter((v) => v.empresa === empresaAtual);
  const atividades = vejoTudo
    ? todasAtividades
    : todasAtividades.filter((a) => a.empresa === empresaAtual);


  const resumoPorEmpresa: ResumoEmpresa[] = NOMES_EMPRESAS.map((empresa) => {
    const relEmpresa = todosRelacionamentos.filter(
      (r) => r.empresa === empresa,
    );
    const opEmpresa = todasOportunidades.filter((o) => o.empresa === empresa);
    const vendaEmpresa = todasVendas.filter((v) => v.empresa === empresa);

    return {
      empresa,
      relacionamentos: relEmpresa.length,
      valorPipeline: opEmpresa.reduce((sum, o) => sum + (o.valor || 0), 0),
      valorVendido: vendaEmpresa.reduce((sum, v) => sum + (v.valor || 0), 0),
    };
  });

  async function addRelacionamento(dados: Omit<Relacionamento, "id">) {
    const nome = dados.nome.trim();
    const telefoneNormalizado = dados.telefone?.replace(/\D/g, "") || null;
    const emailNormalizado = dados.email?.trim().toLowerCase() || null;

    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !empresaAtual || !nome) return null;

      let existente: Record<string, unknown> | null = null;

      if (telefoneNormalizado) {
        const { data } = await supabase
          .from("relacionamentos")
          .select("*")
          .eq("empresa", empresaAtual)
          .eq("owner_id", user.id)
          .eq("telefone_normalizado", telefoneNormalizado)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        existente = data;
      }

      if (!existente && emailNormalizado) {
        const { data } = await supabase
          .from("relacionamentos")
          .select("*")
          .eq("empresa", empresaAtual)
          .eq("owner_id", user.id)
          .eq("email_normalizado", emailNormalizado)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        existente = data;
      }

      if (!existente && !telefoneNormalizado && !emailNormalizado) {
        const { data } = await supabase
          .from("relacionamentos")
          .select("*")
          .eq("empresa", empresaAtual)
          .eq("owner_id", user.id)
          .ilike("nome", nome)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        existente = data;
      }

      const payload = {
        ...relacionamentoParaBanco({
          ...dados,
          nome,
          telefone: telefoneNormalizado || undefined,
          email: emailNormalizado || undefined,
        }),
        owner_id: user.id,
        empresa: empresaAtual,
      };

      if (existente?.id) {
        const { data, error } = await supabase
          .from("relacionamentos")
          .update(payload)
          .eq("id", existente.id)
          .select()
          .single();

        if (error || !data) {
          console.error("Erro ao actualizar relacionamento existente:", error);
          return null;
        }

        const actualizado = relacionamentoDoBanco(data);
        setTodosRelacionamentos((prev) =>
          prev.some((item) => item.id === actualizado.id)
            ? prev.map((item) =>
                item.id === actualizado.id ? actualizado : item,
              )
            : [actualizado, ...prev],
        );
        return actualizado;
      }

      const { data, error } = await supabase
        .from("relacionamentos")
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        console.error("Erro ao criar relacionamento:", error);
        return null;
      }

      const novo = relacionamentoDoBanco(data);
      setTodosRelacionamentos((prev) =>
        prev.some((item) => item.id === novo.id) ? prev : [novo, ...prev],
      );
      return novo;
    }

    const existente = todosRelacionamentos.find((item) => {
      const telefoneItem = item.telefone?.replace(/\D/g, "");
      const emailItem = item.email?.trim().toLowerCase();
      return (
        (telefoneNormalizado && telefoneItem === telefoneNormalizado) ||
        (emailNormalizado && emailItem === emailNormalizado) ||
        (!telefoneNormalizado &&
          !emailNormalizado &&
          item.nome.trim().toLowerCase() === nome.toLowerCase())
      );
    });

    if (existente) {
      const actualizado = { ...existente, ...dados, nome };
      setTodosRelacionamentos((prev) =>
        prev.map((item) => (item.id === existente.id ? actualizado : item)),
      );
      return actualizado;
    }

    const novo: Relacionamento = {
      ...dados,
      nome,
      telefone: telefoneNormalizado || undefined,
      email: emailNormalizado || undefined,
      empresa: dados.empresa || empresaAtual,
      id: gerarId("rel"),
    };
    setTodosRelacionamentos((prev) => [novo, ...prev]);
    return novo;
  }

  async function updateRelacionamento(
    id: string,
    patch: Partial<Relacionamento>,
  ) {
    setTodosRelacionamentos((prev) =>
      prev.map((relacionamento) =>
        relacionamento.id === id
          ? { ...relacionamento, ...patch }
          : relacionamento,
      ),
    );

    if (!supabase) return;

    const payload: Record<string, unknown> = {};
    if (patch.nome !== undefined) payload.nome = patch.nome.trim();
    if (patch.categoria !== undefined) payload.categoria = patch.categoria;
    if (patch.origem !== undefined) payload.origem = patch.origem || null;
    if (patch.telefone !== undefined) payload.telefone = patch.telefone || null;
    if (patch.email !== undefined)
      payload.email = patch.email?.trim().toLowerCase() || null;
    if (patch.cidade !== undefined) payload.cidade = patch.cidade || null;
    if (patch.estado !== undefined) payload.estado = patch.estado || null;
    if (patch.temperatura !== undefined)
      payload.temperatura = patch.temperatura;
    if (patch.proximoContato !== undefined)
      payload.proximo_contato = patch.proximoContato;
    if (patch.proximoContatoEm !== undefined)
      payload.proximo_contato_em = patch.proximoContatoEm || null;
    if (patch.ultimoContato !== undefined)
      payload.ultimo_contato = patch.ultimoContato;
    if (patch.ultimoContatoEm !== undefined)
      payload.ultimo_contato_em = patch.ultimoContatoEm || null;

    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase
      .from("relacionamentos")
      .update(payload)
      .eq("id", id);

    if (error) {
      console.error("Erro ao actualizar relacionamento:", error);
      throw error;
    }
  }

  async function deleteRelacionamento(id: string) {
    if (supabase) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Usuário não autenticado. Entre novamente para excluir o relacionamento.");

      // Atividades e vendas ficam: são histórico auditável, e apagar uma venda
      // porque o contato saiu seria perder faturamento já realizado. Só o
      // vínculo é desfeito.
      const tabelasVinculadas = ["atividades", "vendas"] as const;
      for (const tabela of tabelasVinculadas) {
        const { error: vinculoError } = await supabase
          .from(tabela)
          .update({ relacionamento_id: null })
          .eq("relacionamento_id", id);
        if (vinculoError && vinculoError.code !== "PGRST116") {
          console.error(`Erro ao limpar vínculo em ${tabela}:`, vinculoError);
          throw new Error(`Não foi possível preservar o histórico do relacionamento (${tabela}). ${vinculoError.message}`);
        }
      }

      // As oportunidades, ao contrário, vão junto. Antes elas ficavam órfãs no
      // banco e continuavam somando no funil: negócio aberto, com valor, sem
      // cliente nenhum atrás. A exceção é a oportunidade que virou venda, que
      // é histórico financeiro e já está em "Fechados", fora do pipeline.
      const { data: comVenda } = await supabase
        .from("vendas")
        .select("oportunidade_id")
        .eq("relacionamento_id", id)
        .not("oportunidade_id", "is", null);
      const preservar = (comVenda ?? []).map((v: { oportunidade_id: string }) => v.oportunidade_id);

      let apagarOportunidades = supabase.from("oportunidades").delete().eq("relacionamento_id", id);
      if (preservar.length) {
        apagarOportunidades = apagarOportunidades.not("id", "in", `(${preservar.map((v) => `"${v}"`).join(",")})`);
      }
      const { error: erroOportunidade } = await apagarOportunidades;
      if (erroOportunidade) {
        console.error("Erro ao apagar oportunidades do relacionamento:", erroOportunidade);
        throw new Error(`Não foi possível apagar os negócios do contato. ${erroOportunidade.message}`);
      }

      // Compromissos que ainda não aconteceram somem da agenda: não faz
      // sentido manter visita marcada para um cliente que não existe mais.
      const hoje = new Date().toISOString().slice(0, 10);
      const { error: erroCompromisso } = await supabase
        .from("compromissos")
        .delete()
        .eq("relacionamento_id", id)
        .gte("data", hoje);
      if (erroCompromisso && erroCompromisso.code !== "PGRST116") {
        console.error("Erro ao apagar compromissos do relacionamento:", erroCompromisso);
      }

      // Não usar .select() após o DELETE: o retorno exige uma leitura RLS
      // adicional e fazia a exclusão parecer falhar mesmo quando o DELETE era
      // permitido. O count exato confirma se a policy autorizou a remoção.
      const { count, error } = await supabase
        .from("relacionamentos")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("empresa", empresaAtual);
      if (error) {
        console.error("Erro ao excluir relacionamento:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Não foi possível excluir o relacionamento. ${error.message}`);
      }
      if (count !== 1) {
        throw new Error("Relacionamento não excluído. Ele pode não pertencer à sua empresa ou a sessão pode ter expirado.");
      }
    }
    setTodosRelacionamentos((prev) => prev.filter((r) => r.id !== id));
    setTodasOportunidades((prev) => prev.filter((o) => o.relacionamentoId !== id || ehGanho(o.etapa, funil)));
  }

  async function addOportunidade(
    dados: Omit<Oportunidade, "id" | "diasParado">,
  ) {
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const empresaParaUsar =
        dados.empresa || empresaAtual || profile.empresa || "Sem empresa";
      const dadosComEmpresa = { ...dados, empresa: empresaParaUsar };

      let relacionamentoId = dadosComEmpresa.relacionamentoId;

      if (!relacionamentoId) {

        const novoRelacionamento = await addRelacionamento({
          vendedorId: "",
          nome: dadosComEmpresa.cliente,
          categoria: "Cliente Final",
          temperatura: "ativo",
          proximoContato: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        });

        if (novoRelacionamento) {
          relacionamentoId = novoRelacionamento.id;
        } else {
          console.error("❌ Erro ao criar relacionamento");
          return null;
        }
      }

      const dadosComRelacionamento = {
        ...dadosComEmpresa,
        relacionamentoId,
      };


      const payload = {
        ...oportunidadeParaBanco(dadosComRelacionamento),
        owner_id: user.id,
      };


      const { data, error } = await supabase
        .from("oportunidades")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("❌ ERRO SUPABASE:", error);
        console.error("📋 Payload que deu erro:", payload);
        return null;
      }
      if (!data) {
        console.error("❌ SEM DADOS RETORNADOS");
        return null;
      }
      const nova = oportunidadeDoBanco(data);
      setTodasOportunidades((prev) => [nova, ...prev]);

      integrarNovaOportunidade(nova);

      return nova;
    }

    const nova: Oportunidade = { ...dados, id: gerarId("op") };
    setTodasOportunidades((prev) => [nova, ...prev]);

    integrarNovaOportunidade(nova);

    return nova;
  }

  async function moveOportunidade(id: string, novaEtapa: Etapa) {
    const oportunidade = todasOportunidades.find((o) => o.id === id);
    if (!oportunidade) return;

    const etapaAnterior = oportunidade.etapa;
    if (etapaAnterior === novaEtapa) return;

    setTodasOportunidades((prev) =>
      prev.map((o) => (o.id === id ? { ...o, etapa: novaEtapa } : o)),
    );

    // Uma venda criada pelo fechamento do pipeline deixa de ser válida quando
    // o negócio sai de Fechados. Isso impede que o ranking conte movimentações
    // temporárias como faturamento real.
    if (ehGanho(etapaAnterior, funil) && !ehGanho(novaEtapa, funil)) {
      const vendasDerivadas = todasVendas.filter((venda) => venda.oportunidadeId === id);
      setTodasVendas((prev) => prev.filter((venda) => venda.oportunidadeId !== id));
      if (supabase && vendasDerivadas.length > 0) {
        const { error } = await supabase.from("vendas").delete().eq("oportunidade_id", id);
        if (error) {
          // Se o banco recusou, a venda continua lá: devolve para a tela em vez
          // de sumir só aqui e reaparecer no próximo carregamento.
          console.error("Erro ao desfazer venda derivada do pipeline:", error);
          setTodasVendas((prev) => [...vendasDerivadas, ...prev]);
        }
      }
    }
    if (supabase) {
      /**
       * Com await e desfazendo em caso de erro. Antes o update era disparado
       * sem await e o erro só ia para o console: o vendedor arrastava o card,
       * via ele firme na coluna nova, e no próximo F5 o card estava de volta
       * no lugar antigo sem nenhum aviso. Quem move e volta sozinho é pior do
       * que quem não move: agora o card volta na hora, que é a verdade.
       */
      const { error } = await supabase
        .from("oportunidades")
        .update({ etapa: novaEtapa })
        .eq("id", id);

      if (error) {
        console.error("Erro ao mover oportunidade:", error);
        setTodasOportunidades((prev) =>
          prev.map((o) => (o.id === id ? { ...o, etapa: etapaAnterior } : o)),
        );
        return;
      }

      integrarMovimentoOportunidade(id, etapaAnterior, novaEtapa);
    }
  }

  /**
   * Atualiza a oportunidade na tela e no banco. Se o banco recusar, desfaz a
   * mudança na tela e avisa — antes o erro só ia para o console e o vendedor
   * achava que tinha salvado.
   */
  async function updateOportunidade(id: string, patch: Partial<Oportunidade>) {
    const anterior = todasOportunidades.find((o) => o.id === id);
    setTodasOportunidades((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    );
    if (!supabase) return;

    const payload: Record<string, unknown> = {};
    if (patch.cliente !== undefined) payload.cliente = patch.cliente;
    if (patch.produto !== undefined) payload.produto = patch.produto;
    if (patch.valor !== undefined) payload.valor = patch.valor;
    if (patch.probabilidade !== undefined) payload.probabilidade = patch.probabilidade;
    if (patch.etapa !== undefined) payload.etapa = patch.etapa;

    const { error } = await supabase.from("oportunidades").update(payload).eq("id", id);
    if (error) {
      console.error("Erro ao atualizar oportunidade:", error);
      if (anterior) {
        setTodasOportunidades((prev) => prev.map((o) => (o.id === id ? anterior : o)));
      }
      throw new Error("Não consegui salvar a oportunidade. Tente de novo.");
    }
  }

  /** Exclui a oportunidade. Se o banco recusar, devolve o card para a tela. */
  async function deleteOportunidade(id: string) {
    const anterior = todasOportunidades.find((o) => o.id === id);
    setTodasOportunidades((prev) => prev.filter((o) => o.id !== id));
    if (!supabase) return;

    const { error } = await supabase.from("oportunidades").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir oportunidade:", error);
      if (anterior) setTodasOportunidades((prev) => [anterior, ...prev]);
      throw new Error("Não consegui excluir a oportunidade. Verifique suas permissões.");
    }
  }

  async function addVenda(dados: Omit<Venda, "id">, arquivoOrcamento?: File) {
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const vendaComData = {
        ...dados,
        data: dados.data || new Date().toISOString().split("T")[0],
      };

      const { data, error } = await supabase
        .from("vendas")
        .insert({ ...vendaParaBanco(vendaComData), owner_id: user.id })
        .select()
        .single();

      if (error || !data) {
        // O banco impede duas vendas para a mesma oportunidade. Quando isso
        // acontece, o negócio já foi registrado — não é erro para o usuário.
        if (error?.code === "23505" || /já tem uma venda/i.test(error?.message ?? "")) {
          console.warn("Venda já registrada para esta oportunidade; ignorando a segunda.");
          return null;
        }
        console.error("Erro ao criar venda:", error);
        return null;
      }
      const nova = vendaDoBanco(data);

      if (arquivoOrcamento) {
        const nomeSeguro = arquivoOrcamento.name.replace(/[^\w.\-]+/g, "_");
        const caminho = `${empresaAtual}/${nova.id}/${nomeSeguro}`;

        const { error: erroUpload } = await supabase.storage
          .from("orcamentos")
          .upload(caminho, arquivoOrcamento, { upsert: true });

        if (erroUpload) {
          console.error("Erro ao enviar orçamento:", erroUpload);
        } else {
          await supabase
            .from("vendas")
            .update({
              orcamento_path: caminho,
              orcamento_nome: arquivoOrcamento.name,
            })
            .eq("id", nova.id);
        }
      }

      setTodasVendas((prev) => [nova, ...prev]);
      return nova;
    }

    const nova: Venda = {
      ...dados,
      id: gerarId("venda"),
      data: dados.data || new Date().toISOString().split("T")[0],
    };
    setTodasVendas((prev) => [nova, ...prev]);
    return nova;
  }

  /** Corrige uma venda. Se o banco recusar, desfaz na tela e avisa. */
  async function updateVenda(id: string, patch: Partial<Venda>) {
    const anterior = todasVendas.find((v) => v.id === id);
    setTodasVendas((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    if (!supabase) return;

    const payload: Record<string, unknown> = {};
    if (patch.cliente !== undefined) payload.cliente = patch.cliente;
    if (patch.produto !== undefined) payload.produto = patch.produto;
    if (patch.valor !== undefined) payload.valor = patch.valor;

    const { error } = await supabase.from("vendas").update(payload).eq("id", id);
    if (error) {
      console.error("Erro ao atualizar venda:", error);
      if (anterior) setTodasVendas((prev) => prev.map((v) => (v.id === id ? anterior : v)));
      throw new Error("Não consegui salvar a venda. Tente de novo.");
    }
  }

  /** Exclui uma venda lançada errada. Se o banco recusar, devolve para a lista. */
  async function deleteVenda(id: string) {
    const anterior = todasVendas.find((v) => v.id === id);
    setTodasVendas((prev) => prev.filter((v) => v.id !== id));
    if (!supabase) return;

    const { error } = await supabase.from("vendas").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir venda:", error);
      if (anterior) setTodasVendas((prev) => [anterior, ...prev]);
      throw new Error("Não consegui excluir a venda. Verifique suas permissões.");
    }
  }

  async function addAtividade(dados: NovaAtividade): Promise<Atividade | null> {
    const relacionamento = dados.relacionamentoId
      ? todosRelacionamentos.find((item) => item.id === dados.relacionamentoId)
      : undefined;

    const dadosCompletos: NovaAtividade = {
      ...dados,
      vendedorId: dados.vendedorId || "",
      empresa: dados.empresa || empresaAtual,
      contexto: dados.contexto || relacionamento?.nome || "",
      clienteNome: dados.clienteNome || relacionamento?.nome,
      clienteTelefone: dados.clienteTelefone || relacionamento?.telefone,
      clienteEmail: dados.clienteEmail || relacionamento?.email,
      clienteCategoria: dados.clienteCategoria || relacionamento?.categoria,
      ocorridaEm: dados.ocorridaEm || dados.quando || new Date().toISOString(),
      quando: dados.quando || dados.ocorridaEm || new Date().toISOString(),
    };

    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !empresaAtual) return null;

      const payload = {
        ...atividadeParaBanco({
          ...dadosCompletos,
          vendedorId: user.id,
          ownerId: user.id,
          criadoEm: dados.criadoEm || new Date().toISOString(),
        }),
        owner_id: user.id,
        empresa: empresaAtual,
      };

      const { data, error } = await supabase
        .from("atividades")
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        console.error("Erro ao criar actividade:", error);
        return null;
      }

      const nova = atividadeDoBanco(data);
      setTodasAtividades((prev) =>
        prev.some((item) => item.id === nova.id) ? prev : [nova, ...prev],
      );

      if (nova.relacionamentoId) {
        const dataContacto = nova.ocorridaEm || nova.criadoEm;
        setTodosRelacionamentos((prev) =>
          prev.map((item) =>
            item.id === nova.relacionamentoId
              ? {
                  ...item,
                  nome: nova.clienteNome || item.nome,
                  telefone: nova.clienteTelefone || item.telefone,
                  email: nova.clienteEmail || item.email,
                  categoria: nova.clienteCategoria || item.categoria,
                  ultimoContato: dataContacto.slice(0, 10),
                  ultimoContatoEm: dataContacto,
                  proximoContato: nova.proximoContatoEm
                    ? nova.proximoContatoEm.slice(0, 10)
                    : item.proximoContato,
                  proximoContatoEm:
                    nova.proximoContatoEm || item.proximoContatoEm,
                }
              : item,
          ),
        );
      }

      return nova;
    }

    const nova: Atividade = {
      ...dadosCompletos,
      id: gerarId("ativ"),
      criadoEm: dados.criadoEm || new Date().toISOString(),
    } as Atividade;
    setTodasAtividades((prev) => [nova, ...prev]);
    return nova;
  }

  async function deleteAtividade(id: string): Promise<boolean> {
    if (supabase) {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;
      const { error } = await supabase
        .from("atividades")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.user.id);
      if (error) {
        console.error("Erro ao excluir atividade:", error);
        return false;
      }
    }
    setTodasAtividades((prev) => prev.filter((atividade) => atividade.id !== id));
    return true;
  }

  async function addLead(dados: {
    nome?: string;
    telefone: string;
    email?: string;
    empresa: string;
    origem: string;
    mensagemInicial?: string;
  }): Promise<Lead | null> {
    if (!supabase) {
      alert("Sem conexão com o servidor. Verifique sua internet e tente de novo.");
      return null;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Sua sessão expirou. Entre de novo para continuar.");
      return null;
    }

    const telefoneLimpo = dados.telefone.replace(/\D/g, "");
    const emailNormalizado = dados.email?.trim().toLowerCase() || null;

    const relacionamento = await addRelacionamento({
      vendedorId: user.id,
      ownerId: user.id,
      empresa: dados.empresa,
      nome: dados.nome?.trim() || telefoneLimpo || "Lead sem nome",
      categoria: "Cliente Final",
      temperatura: "quente",
      telefone: telefoneLimpo || undefined,
      email: emailNormalizado || undefined,
      proximoContato: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      proximoContatoEm: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    if (!relacionamento) {
      alert("Não consegui salvar o cliente deste lead.");
      return null;
    }

    let consultaDuplicado = supabase
      .from("leads_recebidos")
      .select("id")
      .eq("vendedor_id", user.id);

    if (telefoneLimpo) {
      consultaDuplicado = consultaDuplicado.eq("telefone", telefoneLimpo);
    } else if (emailNormalizado) {
      consultaDuplicado = consultaDuplicado.eq(
        "email_normalizado",
        emailNormalizado,
      );
    }

    const { data: duplicado } = await consultaDuplicado.limit(1).maybeSingle();
    if (duplicado) {
      alert(
        "Este lead já existe no sistema e o relacionamento foi actualizado.",
      );
      return null;
    }

    const { data, error } = await supabase
      .from("leads_recebidos")
      .insert({
        nome: dados.nome?.trim() || null,
        telefone: telefoneLimpo || null,
        email: emailNormalizado,
        email_normalizado: emailNormalizado,
        relacionamento_id: relacionamento.id,
        empresa: dados.empresa,
        origem: dados.origem,
        mensagem_inicial: dados.mensagemInicial || null,
        status: "novo",
        vendedor_id: user.id,
        created_at: new Date().toISOString(),
        gestor_notificado: false,
        qualificacao_concluida: false,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Erro ao criar lead:", error);
      alert("Não consegui salvar o lead.");
      return null;
    }

    const novoLead = data as Lead;
    setLeads((prev) =>
      prev.some((item) => item.id === novoLead.id) ? prev : [novoLead, ...prev],
    );
    return novoLead;
  }

  async function salvarPlaybook(texto: string) {
    setPlaybookState(texto);

    if (!supabase) return true;

    const { error } = await supabase
      .from("playbook")
      .upsert({ conteudo: texto, updated_at: new Date().toISOString() });

    if (error) {
      console.error("Erro ao salvar playbook:", error);
      return false;
    }
    return true;
  }

  async function integrarNovaOportunidade(oportunidade: Oportunidade) {

    await addAtividade({
      vendedorId: "",
      tipo: "Outro",
      titulo: `Oportunidade criada: ${oportunidade.cliente}`,
      contexto: `${oportunidade.produto || "Sem produto"} - ${formatarMoeda(oportunidade.valor)}`,
      quando: new Date().toISOString(),
      relacionamentoId: oportunidade.relacionamentoId,
      empresa: oportunidade.empresa || empresaAtual,
    });

    if (oportunidade.relacionamentoId) {
      const relacionamento = todosRelacionamentos.find(
        (r) => r.id === oportunidade.relacionamentoId,
      );
      if (relacionamento) {
        await updateRelacionamento(oportunidade.relacionamentoId, {
          temperatura: "ativo",
          proximoContato: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        });
      }
    }
  }

  async function integrarMovimentoOportunidade(
    oportunidadeId: string,
    etapaAnterior: Etapa,
    novaEtapa: Etapa,
  ) {
    const oportunidade = todasOportunidades.find(
      (o) => o.id === oportunidadeId,
    );
    if (!oportunidade) return;


    await addAtividade({
      vendedorId: "",
      tipo: "Outro",
      titulo: `Oportunidade movida: ${etapaAnterior} → ${novaEtapa}`,
      contexto: oportunidade.cliente,
      quando: new Date().toISOString(),
      relacionamentoId: oportunidade.relacionamentoId,
      empresa: oportunidade.empresa || empresaAtual,
    });

    if (oportunidade.relacionamentoId) {
      await updateRelacionamento(oportunidade.relacionamentoId, {
        ultimoContato: new Date().toISOString().slice(0, 10),
      });
    }

    const vendaJaRegistrada = todasVendas.some((venda) => venda.oportunidadeId === oportunidade.id);
    if (ehGanho(novaEtapa, funil) && !ehGanho(etapaAnterior, funil) && !vendaJaRegistrada) {
      await addVenda({
        vendedorId: "",
        cliente: oportunidade.cliente,
        valor: oportunidade.valor,
        data: new Date().toISOString().slice(0, 10),
        produto: oportunidade.produto,
        empresa: oportunidade.empresa,
        relacionamentoId: oportunidade.relacionamentoId,
        oportunidadeId: oportunidade.id,
        valorOriginal: oportunidade.valor,
        valorFechado: oportunidade.valor,
        formaPagamento: "Não informado",
        quantidadeParcelas: 1,
        status: "aguardando_detalhes",
        // Atendimento em dupla: o parceiro e a divisão combinados no negócio
        // vão para a venda. Sem isto o fechamento desfaz a dupla — o colega
        // que trabalhou o cliente junto não receberia nada.
        parceiroId: oportunidade.parceiroId ?? null,
        percentualParceiro: oportunidade.parceiroId
          ? (oportunidade.percentualParceiro ?? 50)
          : 0,
      });

    }

    // A AURA analisa o negócio decidido: escreve para o vendedor o que ele
    // acertou e onde errou (à luz do manual), colhe o aprendizado da conversa
    // e avisa o gestor. Sem await de propósito — o card já se moveu e a venda
    // já está registrada; o laudo chega como notificação em seguida e uma
    // falha aqui não pode desfazer nem travar o fechamento.
    if (
      (ehGanho(novaEtapa, funil) && !ehGanho(etapaAnterior, funil)) ||
      (ehPerda(novaEtapa, funil) && !ehPerda(etapaAnterior, funil))
    ) {
      void fetch("/api/aura/fechamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oportunidadeId: oportunidade.id,
          resultado: ehGanho(novaEtapa, funil) ? "fechado" : "perdido",
          // O motivo da perda vem do próprio card, já gravado pelo modal que
          // o vendedor preenche ao arrastar para Perdidos.
          motivo: oportunidade.motivoPerda ?? null,
        }),
      }).catch(() => {
        /* sem IA ou sem rede: o fechamento vale do mesmo jeito */
      });
    }
  }

  function formatarMoeda(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  return (
    <AppDataContext.Provider
      value={{
        funil,
        carregando: carregandoDados,
        usandoSupabase,
        relacionamentos,
        addRelacionamento,
        updateRelacionamento,
        deleteRelacionamento,
        oportunidades,
        addOportunidade,
        moveOportunidade,
        updateOportunidade,
        deleteOportunidade,
        vendas,
        addVenda,
        updateVenda,
        deleteVenda,
        atividades,
        addAtividade,
        deleteAtividade,
        leads,
        addLead,
        playbook,
        salvarPlaybook,
        resumoPorEmpresa,
        oportunidadesTodasLojas: todasOportunidades,
        vendasTodasLojas: todasVendas,
        nomesPorOwnerId,
        meuId,
        recarregar: () => setPedidoDeRecarga((n) => n + 1),
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData deve ser usado dentro de <AppDataProvider>");
  }
  return ctx;
}
