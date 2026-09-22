/** Extrai o ID de um vídeo do YouTube a partir de vários formatos de link. */
export function extrairYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1) || null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/embed/")[1] ?? null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
