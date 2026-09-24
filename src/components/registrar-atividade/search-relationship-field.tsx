"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { formatarTelefone } from "@/lib/format-phone";
import type {
  CategoriaRelacionamento,
  Relacionamento,
  TemperaturaRelacionamento,
} from "@/lib/types";

const CATEGORIAS: CategoriaRelacionamento[] = [
  "Cliente Final",
  "Arquiteto",
  "Construtora",
  "Revendedor",
  "Engenheiro",
  "Designer de Interiores",
  "Consultor",
  "Obra",
  "Distribuidor",
  "Outro",
];

const TEMPERATURAS: TemperaturaRelacionamento[] = [
  "quente",
  "ativo",
  "esfriando",
  "frio",
];

interface SearchRelationshipFieldProps {
  label: string;
  value: Relacionamento | null;
  onChange: (relacionamento: Relacionamento | null) => void;
}

function normalizarPesquisa(valor: string) {
  return valor.trim().toLocaleLowerCase("pt-BR");
}

export function SearchRelationshipField({
  label,
  value,
  onChange,
}: SearchRelationshipFieldProps) {
  const { relacionamentos, addRelacionamento } = useAppData();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [telefoneNovo, setTelefoneNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [cidadeNova, setCidadeNova] = useState("");
  const [categoriaNova, setCategoriaNova] =
    useState<CategoriaRelacionamento>("Cliente Final");
  const [temperaturaNova, setTemperaturaNova] =
    useState<TemperaturaRelacionamento>("quente");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const resultados = useMemo(() => {
    const pesquisa = normalizarPesquisa(termo);
    if (!pesquisa) return relacionamentos.slice(0, 8);

    const pesquisaTelefone = termo.replace(/\D/g, "");
    return relacionamentos
      .filter((relacionamento) => {
        const nome = normalizarPesquisa(relacionamento.nome);
        const email = normalizarPesquisa(relacionamento.email || "");
        const telefone = (relacionamento.telefone || "").replace(/\D/g, "");
        return (
          nome.includes(pesquisa) ||
          email.includes(pesquisa) ||
          (pesquisaTelefone.length >= 3 && telefone.includes(pesquisaTelefone))
        );
      })
      .slice(0, 20);
  }, [relacionamentos, termo]);

  useEffect(() => {
    function aoClicarFora(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setAberto(false);
        setCriandoNovo(false);
      }
    }

    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  function iniciarCadastro() {
    setNomeNovo(termo.trim());
    setTelefoneNovo(termo.replace(/\D/g, "").length >= 8 ? termo : "");
    setEmailNovo(termo.includes("@") ? termo.trim().toLowerCase() : "");
    setErro("");
    setCriandoNovo(true);
  }

  async function criarNovoRelacionamento() {
    const nome = nomeNovo.trim();
    const telefone = telefoneNovo.replace(/\D/g, "");
    const email = emailNovo.trim().toLowerCase();

    if (!nome) {
      setErro("Informe o nome do relacionamento.");
      return;
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setErro("Informe um email válido ou deixe o campo vazio.");
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const novo = await addRelacionamento({
        vendedorId: "",
        nome,
        telefone: telefone || undefined,
        email: email || undefined,
        categoria: categoriaNova,
        cidade: cidadeNova.trim() || undefined,
        temperatura: temperaturaNova,
        proximoContato: "a definir",
      });

      if (!novo) {
        setErro("Não foi possível criar ou actualizar o relacionamento.");
        return;
      }

      onChange(novo);
      setTermo("");
      setAberto(false);
      setCriandoNovo(false);
    } finally {
      setSalvando(false);
    }
  }

  if (value) {
    return (
      <div>
        <p className="mb-1.5 text-sm font-medium text-aura-graphite">{label}</p>
        <div className="flex items-center justify-between rounded-xl border border-aura-petrol-500/40 bg-aura-petrol-700/5 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-aura-graphite">
              {value.nome}
            </p>
            <p className="truncate text-xs text-aura-graphite-soft">
              {[value.categoria, value.telefone, value.email]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remover selecção"
            className="ml-3 shrink-0 text-aura-graphite-soft hover:text-aura-graphite"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <p className="mb-1.5 text-sm font-medium text-aura-graphite">{label}</p>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aura-graphite-soft"
        />
        <input
          type="text"
          value={termo}
          onFocus={() => setAberto(true)}
          onChange={(event) => {
            setTermo(event.target.value);
            setAberto(true);
            setCriandoNovo(false);
          }}
          placeholder="Buscar por nome, telefone ou email..."
          className="w-full rounded-xl border border-aura-mist bg-white py-3 pl-9 pr-4 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
        />
      </div>

      {aberto && !criandoNovo && (
        <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-aura-mist bg-white shadow-lg shadow-black/5">
          {resultados.map((relacionamento) => (
            <li key={relacionamento.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(relacionamento);
                  setTermo("");
                  setAberto(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-aura-bg"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-aura-graphite">
                    {relacionamento.nome}
                  </p>
                  <p className="truncate text-xs text-aura-graphite-soft">
                    {[
                      relacionamento.categoria,
                      relacionamento.telefone,
                      relacionamento.email,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Check size={14} className="text-transparent" />
              </button>
            </li>
          ))}

          {resultados.length === 0 && termo.trim() && (
            <li className="px-4 py-3 text-sm text-aura-graphite-soft">
              Nenhum relacionamento encontrado.
            </li>
          )}

          {termo.trim() && (
            <li className="border-t border-aura-mist">
              <button
                type="button"
                onClick={iniciarCadastro}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-aura-petrol-600 hover:bg-aura-bg"
              >
                <UserPlus size={14} />
                Cadastrar ou actualizar relacionamento
              </button>
            </li>
          )}
        </ul>
      )}

      {criandoNovo && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-aura-mist bg-white p-4 shadow-lg shadow-black/5">
          <p className="mb-3 text-sm font-medium text-aura-graphite">
            Dados do relacionamento
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={nomeNovo}
              onChange={(event) => setNomeNovo(event.target.value)}
              placeholder="Nome *"
              className="rounded-xl border border-aura-mist px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500"
            />
            <input
              type="tel"
              inputMode="tel"
              value={telefoneNovo}
              onChange={(event) => setTelefoneNovo(formatarTelefone(event.target.value))}
              placeholder="Telefone"
              className="rounded-xl border border-aura-mist px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500"
            />
            <input
              type="email"
              inputMode="email"
              value={emailNovo}
              onChange={(event) => setEmailNovo(event.target.value)}
              placeholder="Email para marketing"
              className="rounded-xl border border-aura-mist px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500"
            />
            <input
              type="text"
              value={cidadeNova}
              onChange={(event) => setCidadeNova(event.target.value)}
              placeholder="Cidade"
              className="rounded-xl border border-aura-mist px-3 py-2.5 text-sm outline-none focus:border-aura-petrol-500"
            />
          </div>

          <p className="mb-1.5 mt-3 text-xs text-aura-graphite-soft">
            Categoria
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((categoria) => (
              <button
                key={categoria}
                type="button"
                onClick={() => setCategoriaNova(categoria)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  categoriaNova === categoria
                    ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                    : "border-aura-mist bg-white text-aura-graphite"
                }`}
              >
                {categoria}
              </button>
            ))}
          </div>

          <p className="mb-1.5 mt-3 text-xs text-aura-graphite-soft">
            Temperatura
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPERATURAS.map((temperatura) => (
              <button
                key={temperatura}
                type="button"
                onClick={() => setTemperaturaNova(temperatura)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  temperaturaNova === temperatura
                    ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                    : "border-aura-mist bg-white text-aura-graphite"
                }`}
              >
                {temperatura.charAt(0).toUpperCase() + temperatura.slice(1)}
              </button>
            ))}
          </div>

          {erro && <p className="mt-3 text-xs text-aura-danger">{erro}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={criarNovoRelacionamento}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg bg-aura-petrol-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
            >
              {salvando ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              {salvando ? "Salvando..." : "Salvar e selecionar"}
            </button>
            <button
              type="button"
              onClick={() => setCriandoNovo(false)}
              className="rounded-lg border border-aura-mist px-3 py-2 text-xs font-medium text-aura-graphite"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
