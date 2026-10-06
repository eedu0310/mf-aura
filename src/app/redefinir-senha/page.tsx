import { AuraMark } from "@/components/aura-mark";
import { RedefinirSenhaForm } from "@/components/redefinir-senha-form";

/**
 * A tela que recebe o link de "esqueci minha senha".
 *
 * Ela não existia. O botão no login mandava o e-mail, o Supabase devolvia a
 * pessoa para o site com o token na URL — e não havia ninguém esperando esse
 * token. O link "não dava nada": abria o CRM normal, o token era ignorado e a
 * senha nunca trocava. Nunca funcionou desde que o sistema existe; só ninguém
 * havia precisado até agora.
 */
export const metadata = {
  title: "Redefinir senha — AURA",
};

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-aura-petrol-950 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <AuraMark tone="light" />
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="font-display text-2xl text-aura-graphite">
            Criar uma nova senha
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-aura-graphite-soft">
            Escolha a senha que você vai usar para entrar no AURA.
          </p>
          <div className="mt-6">
            <RedefinirSenhaForm />
          </div>
        </div>
      </div>
    </div>
  );
}
