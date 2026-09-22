import { AuraMark } from "@/components/aura-mark";
import { LoginForm } from "@/components/login-form";
import { NOMES_EMPRESAS } from "@/lib/companies";

const EMPRESAS = NOMES_EMPRESAS;

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-aura-petrol-950 px-12 py-10 lg:flex">
        {/* Assinatura visual: o "halo" da AURA, respirando ao fundo */}
        <div
          aria-hidden="true"
          className="aura-glow pointer-events-none absolute -left-24 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(58,164,180,0.35) 0%, rgba(26,132,150,0.18) 45%, rgba(26,132,150,0) 72%)",
            animation: "aura-breathe 9s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden="true"
          className="aura-glow pointer-events-none absolute right-[-6rem] bottom-[-6rem] h-[22rem] w-[22rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(185,144,47,0.18) 0%, rgba(185,144,47,0) 70%)",
            animation: "aura-breathe 11s ease-in-out infinite 1.5s",
          }}
        />

        <AuraMark tone="light" />

        <div className="relative max-w-md">
          <p className="font-display text-[1.9rem] leading-[1.25] text-white">
            Alta performance não acontece por acaso.
            <span className="text-white/60"> Ela é construída todos os dias.</span>
          </p>
          <p className="mt-5 text-[0.95rem] leading-relaxed text-white/55">
            Sistema Operacional Comercial do Grupo MF — relacionamentos, execução
            e resultado em um único lugar.
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[0.7rem] uppercase tracking-[0.14em] text-white/40">
          {EMPRESAS.map((empresa, i) => (
            <span key={empresa} className="flex items-center gap-3">
              {empresa}
              {i < EMPRESAS.length - 1 && <span className="text-white/20">·</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Painel de acesso */}
      <div className="flex items-center justify-center bg-aura-bg px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <AuraMark tone="dark" />
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-aura-graphite">
              Entrar
            </h1>
            <p className="mt-1.5 text-sm text-aura-graphite-soft">
              Acesse sua conta para ver seu dia, sua equipe ou seu grupo.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
