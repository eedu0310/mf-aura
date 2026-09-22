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

export const metadata: Metadata = {
  title: "AURA | Sales OS",
  description:
    "Alta performance não acontece por acaso. Ela é construída todos os dias.",
  manifest: "/manifest.webmanifest",
  applicationName: "AURA",
  icons: {
    icon: [
      {
        url: "/icons/aura-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/aura-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/aura-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "AURA",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#071f24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-aura-bg text-aura-graphite">
        <PwaRegister />
        <UserProfileProvider>
          <AppDataProvider>{children}</AppDataProvider>
        </UserProfileProvider>
      </body>
    </html>
  );
}
