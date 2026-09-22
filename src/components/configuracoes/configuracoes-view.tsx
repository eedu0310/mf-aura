"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Factory, Store, Pencil, Check, X, Lock } from "lucide-react";
import { ToggleSwitch } from "./toggle-switch";
import { useUserProfile } from "@/lib/user-profile-context";
import { EMPRESAS } from "@/lib/companies";

export function ConfiguracoesView() {
  const router = useRouter();
  const { profile, setProfile, clearProfile } = useUserProfile();
  const [notifFollowUp, setNotifFollowUp] = useState(true);
  const [notifRanking, setNotifRanking] = useState(true);
  const [notifMissoes, setNotifMissoes] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("aura:missoes") === "true",
  );
  const [resumoDiario, setResumoDiario] = useState(true);

  const [editando, setEditando] = useState(false);
  const [nomeRascunho, setNomeRascunho] = useState(profile.nome);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("editarPerfil") === "1") setEditando(true);
  }, []);

  const empresaAtual = EMPRESAS.find((e) => e.nome === profile.empresa);
  const IconeEmpresa = empresaAtual?.tipo === "Fábrica" ? Factory : Store;

  async function salvarPerfil() {
    if (!nomeRascunho.trim()) return;
    setSalvandoPerfil(true);
    setErroPerfil("");
    try {
      // A loja é definida apenas no cadastro inicial e não pode ser alterada aqui.
      await setProfile(nomeRascunho, profile.empresa, profile.cargo);
      setEditando(false);
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      setErroPerfil("Não foi possível salvar seu perfil no banco de dados.");
    } finally {
      setSalvandoPerfil(false);
    }
  }

  function cancelarEdicao() {
    setNomeRascunho(profile.nome);
    setEditando(false);
  }

  function sair() {
    void clearProfile();
    router.push("/login");
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pb-24">
      <div>
        <p className="font-display text-xl font-semibold text-aura-graphite">
          Configurações
        </p>
        <p className="text-sm text-aura-graphite-soft">
          Seus dados e preferências na AURA.
        </p>
      </div>

      {/* Perfil */}
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        {!editando ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-aura-petrol-700/10 font-display text-lg font-semibold text-aura-petrol-700">
                  {profile.avatarIniciais}
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-aura-graphite">
                    {profile.nome}
                  </p>
                  <p className="text-sm text-aura-graphite-soft">
                    {profile.cargo} · {profile.empresa}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditando(true)}
                aria-label="Editar perfil"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-graphite"
              >
                <Pencil size={15} />
              </button>
            </div>

            <div className="mt-5 flex flex-col divide-y divide-aura-mist border-t border-aura-mist">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-aura-graphite-soft">E-mail</span>
                <span className="text-sm text-aura-graphite">
                  {profile.nome.split(" ")[0]?.toLowerCase()}@
                  {profile.empresa.toLowerCase().replace(/[^a-z]/g, "")}.com.br
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-aura-graphite-soft">Telefone</span>
                <span className="text-sm text-aura-graphite">(54) 99988-7766</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-aura-graphite-soft">Perfil de acesso</span>
                <span className="text-sm text-aura-graphite">{profile.cargo}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
                Nome
              </label>
              <input
                type="text"
                value={nomeRascunho}
                onChange={(e) => setNomeRascunho(e.target.value)}
                className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              />
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
                Loja
                <Lock size={11} className="text-aura-graphite-soft" />
              </p>
              <div className="flex items-center gap-2.5 rounded-xl border border-aura-mist bg-aura-bg px-3 py-2.5 text-sm text-aura-graphite-soft">
                <IconeEmpresa size={14} />
                {profile.empresa}
              </div>
              <p className="mt-1.5 text-xs text-aura-graphite-soft">
                Definida no cadastro inicial. Para mudar de loja, fale com seu gestor.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void salvarPerfil()}
                disabled={salvandoPerfil}
                className="flex items-center gap-1.5 rounded-xl bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
              >
                <Check size={14} />
                {salvandoPerfil ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={cancelarEdicao}
                className="flex items-center gap-1.5 rounded-xl border border-aura-mist px-4 py-2 text-sm font-medium text-aura-graphite hover:bg-aura-bg"
              >
                <X size={14} />
                Cancelar
              </button>
            </div>
            {erroPerfil && <p className="text-sm text-aura-danger">{erroPerfil}</p>}
          </div>
        )}
      </div>

      {/* Notificações */}
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <p className="text-sm font-medium text-aura-graphite">Notificações</p>
        <div className="mt-1 flex flex-col divide-y divide-aura-mist">
          <ToggleSwitch
            label="Follow-ups atrasados"
            descricao="Avisar quando um follow-up passar do prazo"
            checked={notifFollowUp}
            onChange={setNotifFollowUp}
          />
          <ToggleSwitch
            label="Mudanças no ranking"
            descricao="Avisar quando eu subir ou descer de posição"
            checked={notifRanking}
            onChange={setNotifRanking}
          />
          <ToggleSwitch
            label="Novas missões"
            descricao="Avisar quando uma nova missão estiver disponível"
            checked={notifMissoes}
            onChange={(valor) => {
              setNotifMissoes(valor);
              localStorage.setItem("aura:missoes", String(valor));
            }}
          />
          <ToggleSwitch
            label="Resumo diário"
            descricao="Receber um resumo do meu dia toda manhã"
            checked={resumoDiario}
            onChange={setResumoDiario}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={sair}
        className="flex items-center justify-center gap-2 rounded-xl border border-aura-mist bg-white py-3 text-sm font-medium text-aura-danger hover:bg-aura-danger/5"
      >
        <LogOut size={16} />
        Sair da conta
      </button>
    </div>
  );
}
