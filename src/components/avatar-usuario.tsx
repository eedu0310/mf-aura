"use client";

/**
 * Foto de perfil da pessoa, ou as iniciais quando ela ainda não tem foto.
 * O tamanho e as cores das iniciais vêm de quem usa (className).
 */
export function AvatarUsuario({
  foto,
  iniciais,
  className = "",
  alt = "",
}: {
  foto: string | null | undefined;
  iniciais: string;
  className?: string;
  alt?: string;
}) {
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={foto} alt={alt} className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  return <span className={`flex shrink-0 items-center justify-center rounded-full ${className}`}>{iniciais || "??"}</span>;
}
