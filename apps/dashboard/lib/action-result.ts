/** Resultado discriminado de Server Actions — para a UI mostrar erros em vez de “nada acontece”. */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export function actionOk(message?: string): ActionResult {
  return message ? { ok: true, message } : { ok: true };
}

export function actionErr(err: unknown): ActionResult {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Algo deu errado. Tente de novo.";
  return { ok: false, error: message };
}
