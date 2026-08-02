/** Classes de UI reutilizáveis — console de afiliado. */

export const ui = {
  card: "rounded-xl border border-border bg-surface p-5",
  cardFlush: "rounded-xl border border-border bg-surface overflow-hidden",
  input:
    "w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none transition placeholder:text-mute/70 focus:border-accent",
  textarea:
    "w-full rounded-lg border border-border bg-elevated p-3 text-sm text-ink outline-none transition placeholder:text-mute/70 focus:border-accent",
  label: "mb-1 block text-xs font-medium text-mute",
  btnPrimary:
    "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
  btnSecondary:
    "rounded-lg border border-border bg-elevated px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50",
  btnGhost:
    "rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50",
  btnDanger:
    "rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10",
  btnOnLight:
    "rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-white",
  pageTitle: "font-display text-2xl font-semibold tracking-tight text-ink",
  pageSub: "mt-1 text-sm text-mute",
  sectionTitle: "mb-3 text-sm font-semibold text-ink",
  list: "divide-y divide-border rounded-xl border border-border bg-surface",
  monoBadge:
    "shrink-0 rounded bg-elevated px-2 py-0.5 font-mono text-xs text-mute",
  empty: "rounded-xl border border-border bg-surface p-10 text-center",
} as const;
