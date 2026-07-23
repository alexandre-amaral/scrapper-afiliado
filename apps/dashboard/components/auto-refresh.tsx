"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Atualiza a página em intervalo fixo — usado na tela do QR, que expira
 * em poucos segundos na Evolution. Re-renderiza o Server Component,
 * buscando um QR novo a cada ciclo.
 */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return null;
}
