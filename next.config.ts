import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes de servidor que não devem ser empacotados pelo Next (o Baileys é
  // ESM puro e usa módulos nativos do Node; empacotado ele quebra em runtime).
  serverExternalPackages: ["@whiskeysockets/baileys", "pino", "qrcode", "jimp", "sharp"],
};

export default nextConfig;
