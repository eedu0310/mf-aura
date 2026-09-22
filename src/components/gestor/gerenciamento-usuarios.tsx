"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import {
  listarUsuariosPorEmpresa,
  criarUsuario,
  excluirUsuario,
  type Usuario,
} from "@/lib/supabase/usuarios-management";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const CARGOS = ["Vendedor", "Vendedor Interno", "SDR", "Pós-venda", "Gestor", "Marketing"];

export function GerenciamentoUsuarios() {
  const { profile } = useUserProfile();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrraFormulario, setMostrarFormulario] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(
    null
  );

  const [formDados, setFormDados] = useState({
    nome: "",
    email: "",
    cargo: "Vendedor",
    senha: "",
    confirmarSenha: "",
  });

  async function carregar() {
    const lista = await listarUsuariosPorEmpresa(profile.empresa);
    setUsuarios(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();

    // Sincronização em tempo real
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const canal = supabase
      .channel("aura-usuarios-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () =>
        carregar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [profile.empresa]);

  async function aoAdicionarUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (processando) return;

    // Validações
    if (!formDados.nome || !formDados.email || !formDados.senha) {
      setMensagem({ tipo: "erro", texto: "Preencha todos os campos!" });
      return;
    }

    if (formDados.senha !== formDados.confirmarSenha) {
      setMensagem({ tipo: "erro", texto: "As senhas não conferem!" });
      return;
    }

    if (formDados.senha.length < 6) {
      setMensagem({ tipo: "erro", texto: "Senha deve ter no mínimo 6 caracteres!" });
      return;
    }

    setProcessando(true);
    const resultado = await criarUsuario(
      formDados.email,
      formDados.nome,
      formDados.cargo,
      profile.empresa,
      formDados.senha
    );

    if (resultado.sucesso) {
      setMensagem({ tipo: "sucesso", texto: resultado.mensagem });
      setFormDados({ nome: "", email: "", cargo: "Vendedor", senha: "", confirmarSenha: "" });
      setMostrarFormulario(false);
      await carregar();
    } else {
      setMensagem({ tipo: "erro", texto: resultado.mensagem });
    }

    setProcessando(false);
    setTimeout(() => setMensagem(null), 5000);
  }

  async function aoExcluirUsuario(usuarioId: string, nomeUsuario: string) {
    if (!confirm(`Tem certeza que deseja desativar ${nomeUsuario}?`)) return;

    setProcessando(true);
    const resultado = await excluirUsuario(usuarioId);

    if (resultado.sucesso) {
      setMensagem({ tipo: "sucesso", texto: resultado.mensagem });
      await carregar();
    } else {
      setMensagem({ tipo: "erro", texto: resultado.mensagem });
    }

    setProcessando(false);
    setTimeout(() => setMensagem(null), 5000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-aura-graphite">
            Gerenciar Usuários
          </h2>
          <p className="text-sm text-aura-graphite-soft">
            Adicione ou remova usuários de {profile.empresa}
          </p>
        </div>
        <button
          onClick={() => setMostrarFormulario(!mostrraFormulario)}
          className="flex items-center gap-2 rounded-lg bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus size={16} />
          Novo Usuário
        </button>
      </div>

      {/* Mensagem */}
      {mensagem && (
        <div
          className={`rounded-lg border p-3 ${
            mensagem.tipo === "sucesso"
              ? "border-aura-success/30 bg-aura-success/10 text-aura-success"
              : "border-aura-danger/30 bg-aura-danger/10 text-aura-danger"
          }`}
        >
          <p className="text-sm font-medium">{mensagem.texto}</p>
        </div>
      )}

      {/* Formulário */}
      {mostrraFormulario && (
        <form
          onSubmit={aoAdicionarUsuario}
          className="space-y-4 rounded-2xl border border-aura-mist bg-white p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-aura-graphite mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={formDados.nome}
                onChange={(e) => setFormDados({ ...formDados, nome: e.target.value })}
                placeholder="Ex: João Silva"
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-aura-graphite mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formDados.email}
                onChange={(e) => setFormDados({ ...formDados, email: e.target.value })}
                placeholder="Ex: joao@email.com"
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-aura-graphite mb-1">
                Cargo *
              </label>
              <select
                value={formDados.cargo}
                onChange={(e) => setFormDados({ ...formDados, cargo: e.target.value })}
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              >
                {CARGOS.map((cargo) => (
                  <option key={cargo} value={cargo}>
                    {cargo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-aura-graphite mb-1">
                Loja
              </label>
              <input
                type="text"
                value={profile.empresa}
                disabled
                className="w-full rounded-lg border border-aura-mist bg-aura-bg px-3 py-2 text-sm text-aura-graphite-soft"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-aura-graphite mb-1">
                Senha *
              </label>
              <input
                type="password"
                value={formDados.senha}
                onChange={(e) => setFormDados({ ...formDados, senha: e.target.value })}
                placeholder="Mín. 6 caracteres"
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-aura-graphite mb-1">
                Confirmar Senha *
              </label>
              <input
                type="password"
                value={formDados.confirmarSenha}
                onChange={(e) => setFormDados({ ...formDados, confirmarSenha: e.target.value })}
                placeholder="Confirme a senha"
                className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={processando}
              className="flex-1 rounded-lg bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {processando ? "Criando..." : "Criar Usuário"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              className="flex-1 rounded-lg border border-aura-mist px-4 py-2 text-sm font-medium text-aura-graphite hover:bg-aura-bg"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de Usuários */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-aura-petrol-600" />
        </div>
      ) : usuarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-aura-mist bg-white/60 p-8 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-aura-graphite-soft" />
          <p className="text-sm text-aura-graphite-soft">Nenhum usuário cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map((usuario) => (
            <div
              key={usuario.id}
              className="flex items-center justify-between rounded-lg border border-aura-mist bg-white p-4"
            >
              <div className="flex-1">
                <p className="font-medium text-aura-graphite">{usuario.nome}</p>
                <p className="text-xs text-aura-graphite-soft">ID: {usuario.id.slice(0, 8)}</p>
                <div className="mt-1 flex gap-2">
                  <span className="inline-block rounded bg-aura-petrol-100 px-2 py-0.5 text-xs font-medium text-aura-petrol-700">
                    {usuario.cargo}
                  </span>
                  {!usuario.ativo && (
                    <span className="inline-block rounded bg-aura-danger/10 px-2 py-0.5 text-xs font-medium text-aura-danger">
                      Desativado
                    </span>
                  )}
                </div>
              </div>

              {usuario.ativo && (
                <button
                  onClick={() => aoExcluirUsuario(usuario.id, usuario.nome)}
                  disabled={processando}
                  className="ml-2 rounded-lg border border-aura-danger/40 p-2 text-aura-danger hover:bg-aura-danger/10 disabled:opacity-50"
                  title="Desativar usuário"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}