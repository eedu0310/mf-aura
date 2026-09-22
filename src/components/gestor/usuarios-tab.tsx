"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCw, Loader2, Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/lib/user-profile-context";
import { TransferirCarteiraCard } from "@/components/gestor/transferir-carteira-card";

interface Usuario {
  id: string;
  nome: string;
  email?: string;
  cargo: string;
  empresa: string;
  ativo: boolean;
  created_at: string;
}

export function UsuariosTab() {
  const { profile } = useUserProfile();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [novoUsuario, setNovoUsuario] = useState({
    nome: "",
    email: "",
    cargo: "Vendedor",
    empresa: profile.empresa,
  });

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCarregando(false);
      return;
    }

    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("empresa", profile.empresa)
        .order("created_at", { ascending: false });

      if (data) {
        setUsuarios(data as Usuario[]);
      }
    } catch (erro) {
      console.error("Erro ao carregar usuários:", erro);
    }

    setCarregando(false);
  }

  async function adicionarUsuario() {
    if (!novoUsuario.nome || !novoUsuario.email) {
      alert("Preencha todos os campos");
      return;
    }

    setCarregando(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase não disponível");

      // Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: novoUsuario.email,
        password: Math.random().toString(36).slice(-8),
      });

      if (authError || !authData.user) throw authError;

      // Criar perfil
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        nome: novoUsuario.nome,
        cargo: novoUsuario.cargo,
        empresa: profile.empresa,
        ativo: true,
      });

      if (profileError) throw profileError;

      setModalAberto(false);
      setNovoUsuario({ nome: "", email: "", cargo: "Vendedor", empresa: profile.empresa });
      await carregar();
    } catch (erro) {
      console.error("Erro ao adicionar usuário:", erro);
      alert("Erro ao criar usuário");
    } finally {
      setCarregando(false);
    }
  }

  async function toggleAtivar(usuario: Usuario) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      await supabase
        .from("profiles")
        .update({ ativo: !usuario.ativo })
        .eq("id", usuario.id);

      await carregar();
    } catch (erro) {
      console.error("Erro ao atualizar usuário:", erro);
    }
  }

  return (
    <div className="space-y-6">
      <TransferirCarteiraCard />
      {/* Botão Adicionar */}
      <button
        onClick={() => setModalAberto(true)}
        className="flex items-center gap-2 rounded-lg bg-aura-petrol-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-aura-petrol-700"
      >
        <Plus size={18} />
        Novo Usuário
      </button>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 w-full max-w-md">
            <h2 className="font-display text-xl font-bold text-aura-graphite">
              Novo Usuário
            </h2>

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
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setModalAberto(false)}
                className="flex-1 rounded-lg border border-aura-mist px-4 py-2 text-sm font-medium text-aura-graphite transition hover:bg-aura-bg"
              >
                Cancelar
              </button>
              <button
                onClick={adicionarUsuario}
                disabled={carregando}
                className="flex-1 rounded-lg bg-aura-petrol-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-aura-petrol-700 disabled:opacity-50"
              >
                {carregando ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Usuários */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-aura-petrol-600" />
        </div>
      ) : (
        <div className="grid gap-3">
          {usuarios.map((user) => (
            <div
              key={user.id}
              className={`rounded-2xl border p-4 transition ${
                user.ativo
                  ? "border-aura-mist bg-white"
                  : "border-aura-mist/50 bg-aura-bg opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-aura-graphite">{user.nome}</p>
                    {!user.ativo && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Inativo
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-aura-graphite-soft">
                    <Mail size={14} />
                    {user.email || "Sem email registrado"}
                  </div>
                  <p className="mt-1 text-xs text-aura-graphite-soft">{user.cargo}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAtivar(user)}
                    title={user.ativo ? "Desativar" : "Reativar"}
                    className={`rounded-lg p-2 transition ${
                      user.ativo
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Desativar ${user.nome}?`)) {
                        toggleAtivar(user);
                      }
                    }}
                    className="rounded-lg bg-red-100 p-2 text-red-700 transition hover:bg-red-200"
                    title="Desativar usuário"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
