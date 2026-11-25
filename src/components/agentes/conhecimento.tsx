"use client";

/**
 * BASE DE CONHECIMENTO vista pela equipe de agentes: quanto a AURA já sabe
 * (aprendizados aprovados e sugeridos, materiais e trechos), quando a base
 * mudou pela última vez e quando foi a última cópia de segurança — com a
 * explicação, em palavras simples, de por que nada do que ela aprendeu se
 * perde. A edição continua nas telas que já existem (Aprendizado e Base de
 * conhecimento), e aqui só há atalhos para elas.
 */
import { ArrowRight, BookOpen, CloudUpload, DatabaseBackup, GraduationCap, History, RefreshCw, ShieldCheck } from "lucide-react";
import { Alerta, Botao, BotaoLink, Card, CardHeader, StatCard } from "@/components/ui";
import { Esqueleto, dataHora, haQuanto, numero, useEscritorio } from "./comum";

export function ConhecimentoAgentes() {
  const { estado, erro, carregando, recarregar } = useEscritorio();

  if (carregando && !estado) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-24" />
          ))}
        </div>
        <Esqueleto className="h-48 w-full" />
      </div>
    );
  }
  if (!estado) {
    return (
      <Alerta
        tom="perigo"
        titulo="Não consegui carregar a base de conhecimento"
        descricao={erro ?? "Tente de novo em instantes."}
        acao={
          <Botao tamanho="sm" icone={RefreshCw} onClick={() => void recarregar()}>
            Tentar de novo
          </Botao>
        }
      />
    );
  }

  const k = estado.conhecimento;
  // Cópia com mais de 36 h: alguma noite falhou. Avisa, sem alarmar.
  const backupAtrasado = k.ultimoBackup ? Date.now() - new Date(k.ultimoBackup).getTime() > 36 * 3_600_000 : false;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Aprendizados aprovados" valor={numero(k.aprendizadosAprovados)} tom="marca" detalhe="a AURA já usa nas respostas" />
        <StatCard
          rotulo="Sugeridos"
          valor={numero(k.aprendizadosSugeridos)}
          tom={k.aprendizadosSugeridos > 0 ? "atencao" : "neutro"}
          detalhe="esperando aprovação"
        />
        <StatCard rotulo="Materiais" valor={numero(k.materiais)} detalhe="catálogos, manuais, tabelas" />
        <StatCard rotulo="Trechos" valor={numero(k.trechos)} detalhe="pedaços indexados para busca" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icone={History} titulo="Última versão salva" descricao="Última alteração registrada no histórico" />
          <p className="font-display text-xl font-semibold text-aura-graphite">{k.ultimaVersao ? haQuanto(k.ultimaVersao) : "Sem registro ainda"}</p>
          {k.ultimaVersao && <p className="mt-0.5 text-xs text-aura-graphite-soft">{dataHora(k.ultimaVersao)}</p>}
        </Card>
        <Card>
          <CardHeader
            icone={CloudUpload}
            corIcone={backupAtrasado ? "text-aura-warning" : "text-aura-petrol-600"}
            titulo="Última cópia de segurança"
            descricao="Cópia da base de conhecimento guardada na nuvem"
          />
          <p className="font-display text-xl font-semibold text-aura-graphite">{k.ultimoBackup ? haQuanto(k.ultimoBackup) : "Sem cópia registrada"}</p>
          {k.ultimoBackup && <p className="mt-0.5 text-xs text-aura-graphite-soft">{dataHora(k.ultimoBackup)}</p>}
          {backupAtrasado && (
            <p className="mt-2 text-xs text-aura-gold-700">
              A cópia de ontem à noite não apareceu. As Sentinelas (Saúde do sistema) avisam se algo falhou.
            </p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader icone={ShieldCheck} corIcone="text-aura-success" titulo="Por que nada do que a AURA aprendeu se perde" />
        <ul className="grid gap-4 md:grid-cols-3">
          <Protecao
            icone={History}
            titulo="Toda mudança fica no histórico"
            texto="Cada aprendizado aprovado, editado ou apagado deixa a versão anterior guardada no histórico, com a data da mudança. Editar nunca apaga o que havia antes."
          />
          <Protecao
            icone={CloudUpload}
            titulo="Cópia da base toda noite"
            texto="Toda noite a base de conhecimento inteira é copiada para a nuvem, e cada cópia fica guardada por 365 dias."
          />
          <Protecao
            icone={DatabaseBackup}
            titulo="Backup completo do banco"
            texto="Além disso, o banco de dados inteiro (clientes, vendas e tudo mais) tem backup automático todas as noites."
          />
        </ul>
        <p className="mt-4 border-t border-aura-mist pt-3 text-xs leading-relaxed text-aura-graphite-soft">
          Os agentes só <strong className="font-medium text-aura-graphite">sugerem</strong> aprendizados: o que eles tiram das
          conversas entra como “sugerido” e só passa a valer depois de aprovado — por você ou pelo Curador, quando há
          evidência de resultado.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Atalho
          href="/gestor?aba=aprendizado"
          icone={GraduationCap}
          titulo="Aprovar aprendizados"
          descricao="Veja o que a AURA e os agentes tiraram das conversas"
        />
        <Atalho
          href="/gestor?aba=configuracoes"
          icone={BookOpen}
          titulo="Editar a base de conhecimento"
          descricao="Materiais, regras do CRM e o que a AURA sabe"
        />
      </div>
    </div>
  );
}

function Protecao({ icone: Icone, titulo, texto }: { icone: typeof History; titulo: string; texto: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-success/10">
        <Icone size={15} className="text-aura-success" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium text-aura-graphite">{titulo}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-aura-graphite-soft">{texto}</p>
      </div>
    </li>
  );
}

function Atalho({ href, icone: Icone, titulo, descricao }: { href: string; icone: typeof History; titulo: string; descricao: string }) {
  return (
    <div className="aura-card aura-card-interativo flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
        <Icone size={16} className="text-aura-petrol-600" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-aura-graphite">{titulo}</p>
        <p className="truncate text-xs text-aura-graphite-soft">{descricao}</p>
      </div>
      <BotaoLink href={href} tamanho="sm" variante="fantasma" icone={ArrowRight}>
        Abrir
      </BotaoLink>
    </div>
  );
}
