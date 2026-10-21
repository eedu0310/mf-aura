"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      // updateViaCache "none": o navegador nunca usa cópia guardada do sw.js
      // ao procurar atualização.
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        console.warn("Não foi possível registar o PWA:", error);
      });
  }, []);

  return null;
}
