# Design system da AURA

Visual de CRM de alto padrão: **minimalista, claro ou escuro, com linha fina no lugar de cor forte**. A cor vem do tema: nenhuma tela escolhe cor fixa.

## Regras

1. **Cores só pelos tokens** `aura-*`: `bg-aura-surface` (cartão), `bg-aura-bg` (fundo da página), `bg-aura-sunken` (área afundada, hover, trilho), `border-aura-mist` (linhas), `text-aura-graphite` (texto), `text-aura-graphite-soft` (texto secundário), `aura-petrol-*` (marca/destaque), `aura-success / aura-warning / aura-danger / aura-gold`.
   - Em código novo, **não usar** `bg-white`, `text-white` sobre fundo claro, `bg-red-50`, `text-amber-800`, `bg-gray-100`, hex fixo. (O tema escuro traduz os antigos, mas o certo é o token.)
   - `text-white` só sobre botão primário, selo cheio ou faixa escura de propósito.
2. **Sem faixas escuras de cabeçalho.** Página começa com `<PageHeader>` dentro do `<PageContainer>`.
3. **Cartão** = `<Card>` ou classe `aura-card` (borda fina + sombra mínima, `rounded-xl`). Sem `rounded-2xl`/`rounded-3xl` novos, sem `shadow-lg` em cartão parado.
4. **Botões** = `<Botao>` / `<BotaoLink>` / `classeBotao()`. Um só **primário** por área; o resto `secundario` ou `fantasma`. Nada de botão pílula preto (`bg-aura-navy-950 rounded-full`).
5. **Alertas** = `<Alerta tom=…>`: cartão claro com ícone colorido. Não pintar a caixa inteira de vermelho/verde.
6. **Números (KPI)** = `<StatCard>`: rótulo pequeno em caixa alta, número grande `tabular-nums`.
7. **Filtros de opção única** = `<Segmentado>` (trilho), não fileira de pílulas grandes.
8. **Selos** = `<Selo tom=…>` (`rounded-md`, pequeno).
9. **Campos** = classe `aura-input` (input/select/textarea) + `aura-label`.
10. **Tabelas** = classe `aura-tabela` dentro de `aura-card overflow-hidden`.
11. **Vazio** = `<EstadoVazio>`.
12. Tipografia: Inter. Título de página `text-2xl font-semibold`, título de cartão `text-sm font-semibold`, rótulos `aura-rotulo`. Evitar `font-bold` e `font-extrabold`; evitar emoji em título.
13. Espaçamento: `gap-4`/`gap-6` entre blocos; cartões `p-4`/`p-5`.
14. Ícones: lucide, 15–18 px, `text-aura-graphite-soft` parado, `text-aura-petrol-600` quando ativo/destaque.

## Peças (`@/components/ui`)

```tsx
import { PageContainer, PageHeader, Card, CardHeader, Botao, BotaoLink, classeBotao,
         StatCard, Selo, Alerta, Segmentado, EstadoVazio } from "@/components/ui";

<PageContainer>
  <PageHeader titulo="Relacionamentos" descricao="Clientes, parceiros e prospects."
    icone={Users} acoes={<Botao variante="primario" icone={Plus}>Novo contato</Botao>} />
  <div className="grid gap-4 sm:grid-cols-4">
    <StatCard rotulo="Clientes" valor="1.248" />
    <StatCard rotulo="Follow-ups vencidos" valor="220" tom="perigo" />
  </div>
  <Alerta tom="atencao" titulo="828 clientes esfriando" descricao="…" acao={<Botao tamanho="sm">Ver</Botao>} />
  <Segmentado opcoes={[{valor:"todos",rotulo:"Todos"}]} valor={f} aoMudar={setF} />
</PageContainer>
```

O layout do vendedor (`src/app/(vendedor)/layout.tsx`) **não** põe padding no `<main>`: cada página usa `PageContainer`.
