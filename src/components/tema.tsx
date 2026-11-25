"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { CHAVE_DO_TEMA } from "@/lib/tema-script";

/**
 * Tema claro / escuro da AURA.
 *
 * A escolha fica no aparelho (localStorage), não no perfil: a mesma pessoa
 * pode querer escuro no computador da loja e claro no celular, no sol da obra.
 * "Sistema" segue o tema do aparelho e é o padrão de quem nunca escolheu.
 */
export type Tema = "claro" | "escuro" | "sistema";

const CHAVE = CHAVE_DO_TEMA;
const EVENTO = "aura-tema-mudou";

function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

function sistemaEscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function aplicar(tema: Tema) {
  const escuro = tema === "escuro" || (tema === "sistema" && sistemaEscuro());
  document.documentElement.classList.toggle("dark", escuro);
}

function assinar(aviso: () => void) {
  const consulta = window.matchMedia("(prefers-color-scheme: dark)");
  const aoMudarSistema = () => {
    if (lerTema() === "sistema") aplicar("sistema");
    aviso();
  };
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso);
  consulta.addEventListener("change", aoMudarSistema);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
    consulta.removeEventListener("change", aoMudarSistema);
  };
}

export function useTema() {
  const tema = useSyncExternalStore<Tema>(assinar, lerTema, () => "sistema");
  const escuro = useSyncExternalStore(
    assinar,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  // Outra aba mudou o tema: esta acompanha.
  useEffect(() => {
    aplicar(tema);
  }, [tema]);

  const definir = useCallback((novo: Tema) => {
    try {
      if (novo === "sistema") localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, novo);
    } catch {
      // Navegação privada sem armazenamento: vale só nesta visita.
    }
    aplicar(novo);
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return { tema, escuro, definir };
}

/** Botão de um toque: alterna entre claro e escuro. Fica na barra do topo. */
export function BotaoTema({ className = "" }: { className?: string }) {
  const { escuro, definir } = useTema();
  return (
    <button
      type="button"
      onClick={() => definir(escuro ? "claro" : "escuro")}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite ${className}`}
    >
      {escuro ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

const OPCOES: Array<{ valor: Tema; rotulo: string; icone: typeof Sun }> = [
  { valor: "claro", rotulo: "Claro", icone: Sun },
  { valor: "escuro", rotulo: "Escuro", icone: Moon },
  { valor: "sistema", rotulo: "Automático", icone: Monitor },
];

/**
 * Seletor completo (Claro / Escuro / Automático), para Configurações e menus.
 * `compacto` ocupa a largura do contêiner (barra lateral, menu do perfil) e
 * mostra só os ícones: com os três nomes o seletor estourava a barra lateral.
 */
export function SeletorTema({ compacto = false }: { compacto?: boolean }) {
  const { tema, definir } = useTema();
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={`inline-flex rounded-lg border border-aura-mist bg-aura-sunken p-0.5 ${compacto ? "w-full" : ""}`}
    >
      {OPCOES.map(({ valor, rotulo, icone: Icone }) => {
        const ativo = tema === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => definir(valor)}
            title={rotulo}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${compacto ? "px-1.5" : "px-3"} ${
              ativo
                ? "bg-aura-surface text-aura-graphite shadow-sm"
                : "text-aura-graphite-soft hover:text-aura-graphite"
            }`}
          >
            <Icone size={14} aria-hidden className="shrink-0" />
            {/* Compacto: só o ícone (o nome fica no tooltip e para leitor de tela). */}
            <span className={compacto ? "sr-only" : ""}>{rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}
