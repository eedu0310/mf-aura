import { AuraMark } from "@/components/aura-mark";
import { OnboardingForm } from "@/components/onboarding-form";
import { OnboardingRedirectGuard } from "@/components/onboarding-redirect-guard";

export default function OnboardingPage() {
  return (
    <OnboardingRedirectGuard>
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-aura-petrol-950 px-12 py-10 lg:flex">
        <div
          aria-hidden="true"
          className="aura-glow pointer-events-none absolute -left-24 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(58,164,180,0.35) 0%, rgba(26,132,150,0.18) 45%, rgba(26,132,150,0) 72%)",
            animation: "aura-breathe 9s ease-in-out infinite",
          }}
        />
        <AuraMark tone="light" />
        <div className="relative max-w-md">
          <p className="font-display text-[1.9rem] leading-[1.25] text-white">
            Antes de começar, um último passo.
          </p>
          <p className="mt-5 text-[0.95rem] leading-relaxed text-white/55">
            Precisamos saber quem é você e em qual loja do Grupo MF você trabalha,
            para personalizar sua experiência na AURA.
          </p>
        </div>
        <div />
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center bg-aura-bg px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <AuraMark tone="dark" />
          </div>
          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-aura-graphite">
              Bem-vindo à AURA
            </h1>
            <p className="mt-1.5 text-sm text-aura-graphite-soft">
              Só precisamos de mais duas informações.
            </p>
          </div>
          <OnboardingForm />
        </div>
      </div>
    </div>
    </OnboardingRedirectGuard>
  );
}
