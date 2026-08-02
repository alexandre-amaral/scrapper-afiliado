/**
 * Estado observável do loop de disparo, para o painel conseguir responder
 * "quando sai a próxima mensagem?" sem adivinhar a matemática do jitter.
 * Vive em memória: é informação do processo, não do banco.
 */

export interface DispatchState {
  /** Quando o próximo tick de disparo está agendado (ISO 8601). */
  nextAttemptAt: string | null;
  /** Último tick executado (ISO 8601). */
  lastAttemptAt: string | null;
  /** Motivo em português do último tick que não enviou nada. */
  lastReason: string | null;
}

const state: DispatchState = {
  nextAttemptAt: null,
  lastAttemptAt: null,
  lastReason: null,
};

export function getDispatchState(): DispatchState {
  return { ...state };
}

export function setDispatchState(patch: Partial<DispatchState>): void {
  Object.assign(state, patch);
}
