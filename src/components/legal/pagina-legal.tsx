/**
 * Casca das páginas públicas de política (privacidade e exclusão de dados).
 * A Meta exige as duas, abertas sem login, para liberar o Instagram do AURA.
 */
export function PaginaLegal({ titulo, atualizada, children }: { titulo: string; atualizada: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-white px-5 py-10 text-aura-graphite">
      <article className="mx-auto max-w-3xl space-y-5 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_a]:text-aura-petrol-600 [&_a]:underline">
        <header className="border-b border-aura-mist pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-aura-graphite-soft">AURA CRM · Grupo MF</p>
          <h1 className="mt-1 font-display text-2xl font-bold">{titulo}</h1>
          <p className="mt-1 text-xs text-aura-graphite-soft">Atualizada em {atualizada}</p>
        </header>
        {children}
      </article>
    </main>
  );
}

export const RESPONSAVEL = {
  empresa: "A&G Comércio de Sistemas para Aquecimento LTDA",
  cidade: "Av. Rio Branco, 495, Centro, Garibaldi/RS, Brasil",
  email: "atendimento@lflareiras.com.br",
  whatsapp: "(54) 99327-2098",
};
