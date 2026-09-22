import { Construction } from "lucide-react";

export function ComingSoon({ titulo }: { titulo: string }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-24 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-aura-petrol-700/10 text-aura-petrol-700">
        <Construction size={20} />
      </div>
      <p className="font-display text-lg font-semibold text-aura-graphite">
        {titulo}
      </p>
      <p className="max-w-sm text-sm text-aura-graphite-soft">
        Essa tela ainda não foi desenhada. Vamos construí-la na próxima etapa,
        parte por parte.
      </p>
    </div>
  );
}
