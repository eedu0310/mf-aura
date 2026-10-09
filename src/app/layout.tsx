import type { Metadata, Viewport } from "next";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { UserProfileProvider } from "@/lib/user-profile-context";
import { AppDataProvider } from "@/lib/app-data-context";
import { PwaRegister } from "@/components/pwa-register";

/**
 * O endereço do sistema. Sem ele, as imagens de compartilhamento viajam com
 * caminho relativo e o WhatsApp, o Slack e o e-mail não conseguem buscá-las —
 * o link sai sem a capa. Pode ser trocado por variável de ambiente quando o
 * domínio mudar.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://crm.mflaser.com.br";

const DESCRICAO =
  "CRM e supervisão comercial com IA do Grupo MF. Pipeline, carteira, WhatsApp " +
  "analisado conversa por conversa, metas e relatório semanal de cada vendedor.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  /**
   * `template` dá o sufixo a toda página que definir o próprio título, e
   * `default` vale para quem não definir. Antes toda aba do navegador se
   * chamava igual, e com dez abas abertas ninguém achava a certa.
   */
  title: {
    default: "AURA | Sales OS",
    template: "%s · AURA",
  },
  description: DESCRICAO,
  applicationName: "AURA",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  authors: [{ name: "Grupo MF" }],
  creator: "Grupo MF",
  publisher: "Grupo MF",
  keywords: [
    "CRM", "Grupo MF", "LF Lareiras", "MF International",
    "A&G Aquecimento", "Sole Aquecimento", "lareiras", "aquecimento",
  ],
  /**
   * NÃO INDEXAR — e isto é de propósito.
   *
   * Isto é um sistema interno com carteira de cliente, conversa de WhatsApp e
   * número de venda. "SEO completo" aqui NÃO quer dizer aparecer no Google;
   * quer dizer que o link, quando alguém da equipe manda no WhatsApp ou no
   * e-mail, chega com nome, descrição e capa decentes. Posição em buscador
   * seria defeito, não melhoria.
   */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  openGraph: {
    type: "website",
    siteName: "AURA | Sales OS",
    title: "AURA | Sales OS",
    description: DESCRICAO,
    url: SITE,
    locale: "pt_BR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AURA — Sales OS do Grupo MF",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AURA | Sales OS",
    description: DESCRICAO,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/aura-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/aura-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    title: "AURA",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    /**
     * O iPhone transforma número solto em link de ligação por conta própria.
     * Num CRM cheio de valor, data e medida, isso vira texto azul sublinhado
     * no meio do relatório, e às vezes abre o discador sem querer.
     */
    telephone: false,
  },
  category: "business",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  /**
   * A barra do sistema acompanha o tema do aparelho: petróleo escuro no modo
   * claro, e o mesmo tom no escuro, porque o app é escuro na borda em ambos.
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#071f24" },
    { media: "(prefers-color-scheme: dark)", color: "#071f24" },
  ],
};

/**
 * Capas de abertura do iOS.
 *
 * O Android monta a capa sozinho com a cor de fundo e o ícone do manifest. O
 * iPhone não: ele exige uma imagem com a medida EXATA do aparelho, senão
 * mostra uma tela branca enquanto abre. Por isso a lista por aparelho.
 */
const CAPAS_IOS: { arquivo: string; w: number; h: number }[] = [
  { arquivo: "iphone-15-pro-max", w: 1290, h: 2796 },
  { arquivo: "iphone-15", w: 1179, h: 2556 },
  { arquivo: "iphone-13-14", w: 1170, h: 2532 },
  { arquivo: "iphone-x-11pro", w: 1125, h: 2436 },
  { arquivo: "iphone-11", w: 828, h: 1792 },
  { arquivo: "iphone-8", w: 750, h: 1334 },
  { arquivo: "ipad", w: 1536, h: 2048 },
  { arquivo: "ipad-pro-11", w: 1668, h: 2388 },
  { arquivo: "ipad-pro-129", w: 2048, h: 2732 },
];

function LinksDeCapa() {
  return (
    <>
      {CAPAS_IOS.flatMap(({ arquivo, w, h }) => {
        const dpr = w >= 1125 ? 3 : 2;
        const lw = Math.round(w / dpr);
        const lh = Math.round(h / dpr);
        return [
          <link
            key={`${arquivo}-retrato`}
            rel="apple-touch-startup-image"
            href={`/splash/${arquivo}.png`}
            media={`(device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`}
          />,
          <link
            key={`${arquivo}-paisagem`}
            rel="apple-touch-startup-image"
            href={`/splash/${arquivo}-paisagem.png`}
            media={`(device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: landscape)`}
          />,
        ];
      })}
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        <LinksDeCapa />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-aura-bg text-aura-graphite">
        <PwaRegister />
        <UserProfileProvider>
          <AppDataProvider>{children}</AppDataProvider>
        </UserProfileProvider>
      </body>
    </html>
  );
}
