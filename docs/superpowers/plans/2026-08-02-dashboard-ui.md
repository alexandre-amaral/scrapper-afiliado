# Dashboard UI Redesign — Implementation Plan

> **For agentic workers:** Execute inline (usuário pediu implementar). Verificação: `pnpm typecheck`. Sem suíte de testes no monorepo.

**Goal:** Aplicar o design “Console de afiliado” em todo o `apps/dashboard` conforme `docs/superpowers/specs/2026-08-02-dashboard-ui-design.md`.

**Architecture:** Tokens CSS + `@theme` Tailwind 4; fontes via `next/font`; layout do painel com sidebar, status strip e bottom nav mobile; migrar páginas/componentes para classes semânticas.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, TypeScript.

## Global Constraints

- Copy e UI em português
- Sem mudança de API do agente
- Sem UI kit novo
- Portão de qualidade: `pnpm typecheck`

## File map

| Arquivo | Responsabilidade |
|---------|------------------|
| `app/globals.css` | Tokens + @theme + focus/motion |
| `app/layout.tsx` | Fontes Syne / Plex |
| `lib/ui.ts` | Classes reutilizáveis (btn, input, card) |
| `components/status-strip.tsx` | Assinatura — status operacional |
| `components/bottom-nav.tsx` | Nav mobile |
| `components/page-header.tsx` | Título Syne + subtítulo |
| `components/nav-links.tsx` | Nav com ícones + ativo |
| `(painel)/layout.tsx` | Shell |
| Demais pages/components | Tokens novos |

## Tasks

### Task 1: Tokens, fontes, utilitários
### Task 2: Shell (layout, strip, bottom nav, nav)
### Task 3: Componentes compartilhados
### Task 4: Login + todas as páginas
### Task 5: typecheck

---
