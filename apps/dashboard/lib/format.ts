const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return dateTimeFormatter.format(date);
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return "—";
  return currencyFormatter.format(value);
}

export function truncate(text: string | null | undefined, max = 120): string {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export type DurationUnit = "s" | "min";

/**
 * Escolhe a unidade mais legível para preencher o formulário de cadência:
 * múltiplos exatos de minuto viram minutos, o resto fica em segundos.
 */
export function splitDuration(totalSeconds: number): {
  value: number;
  unit: DurationUnit;
} {
  if (totalSeconds >= 60 && totalSeconds % 60 === 0) {
    return { value: totalSeconds / 60, unit: "min" };
  }
  return { value: totalSeconds, unit: "s" };
}

/** Segundos → texto curto em português ("30 s", "45 min", "1 h 30 min"). */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
