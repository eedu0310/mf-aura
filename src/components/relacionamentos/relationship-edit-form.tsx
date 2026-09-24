"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type {
  Relacionamento,
  TemperaturaRelacionamento,
  CategoriaRelacionamento,
} from "@/lib/types";

const TEMPERATURAS: {
  valor: TemperaturaRelacionamento;
  label: string;
  cor: string;
}[] = [
  { valor: "quente", label: "Muito quente", cor: "bg-aura-success" },
  { valor: "quente", label: "Morno", cor: "bg-aura-gold" },
  { valor: "esfriando", label: "Esfriando", cor: "bg-aura-warning" },
  { valor: "frio", label: "Sem contato", cor: "bg-aura-danger" },
];

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

interface RelationshipEditFormProps {
  relacionamento: Relacionamento;
  onSalvar: (r: Relacionamento) => void;
  onCancelar: () => void;
}

export function RelationshipEditForm({
  relacionamento: r,
  onSalvar,
  onCancelar,
}: RelationshipEditFormProps) {
  const { updateRelacionamento } = useAppData();
  const [nome, setNome] = useState(r.nome);
  const [categoria, setCategoria] = useState<CategoriaRelacionamento>(
    r.categoria,
  );
  const [telefone, setTelefone] = useState(r.telefone ?? "");
  const [email, setEmail] = useState(r.email ?? "");
  const [cidade, setCidade] = useState(r.cidade ?? "");
  const [temperatura, setTemperatura] = useState<TemperaturaRelacionamento>(
    r.temperatura,
  );
  const [proximoContato, setProximoContato] = useState(
    r.proximoContato ?? "a definir",
  );
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    if (!nome.trim()) {
      alert("Informe o nome do cliente.");
      return;
    }

    setSalvando(true);

    try {
      await updateRelacionamento(r.id, {
        nome: nome.trim(),
        categoria,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        cidade: cidade.trim() || undefined,
        temperatura,
        proximoContato: proximoContato.trim() || "a definir",
      });

      onSalvar({
        ...r,
        nome: nome.trim(),
        categoria,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        cidade: cidade.trim() || undefined,
        temperatura,
        proximoContato: proximoContato.trim() || "a definir",
      });
    } catch (erro) {
      console.error("Erro ao atualizar:", erro);
      alert("Não consegui salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-aura-graphite">
          Editar Relacionamento
        </h3>
      </div>

      <div className="space-y-4">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-aura-graphite mb-1">
            Nome
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
        </div>

        {/* Categoria */}
        <div>
          <label className="block text-sm font-medium text-aura-graphite mb-1">
            Categoria
          </label>
          <select
            value={categoria}
            onChange={(e) =>
              setCategoria(e.target.value as CategoriaRelacionamento)
            }
            className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          >
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Telefone */}
        <div>
          <label className="block text-sm font-medium text-aura-graphite mb-1">
            Telefone
          </label>
          <input
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-aura-graphite mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
        </div>

        {/* Cidade */}
        <div>
          <label className="block text-sm font-medium text-aura-graphite mb-1">
            Cidade
          </label>
          <input
            type="text"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
        </div>

        {/* Temperatura */}
        <div>
          <label className="block text-sm font-medium text-aura-graphite mb-1">
            Temperatura
          </label>
          <select
            value={temperatura}
            onChange={(e) =>
              setTemperatura(e.target.value as TemperaturaRelacionamento)
            }
            className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          >
            {TEMPERATURAS.map((temp) => (
              <option key={temp.valor} value={temp.valor}>
                {temp.label}
              </option>
            ))}
          </select>
        </div>

        {/* Próximo Contato */}
        <div>
          <label className="block text-sm font-medium text-aura-graphite mb-1">
            Próximo Contato
          </label>
          <input
            type="text"
            value={proximoContato}
            onChange={(e) => setProximoContato(e.target.value)}
            placeholder="a definir"
            className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={onCancelar}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-aura-mist bg-white px-4 py-2 text-sm font-medium text-aura-graphite transition hover:bg-aura-bg"
        >
          <X size={16} />
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-aura-petrol-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-aura-petrol-700 disabled:opacity-50"
        >
          <Check size={16} />
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
