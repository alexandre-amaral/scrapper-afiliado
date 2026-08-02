# Redesign UI — Dashboard Agente ML Afiliados

**Data:** 2026-08-02  
**Status:** aprovado em brainstorming; aguardando review final do spec  
**Escopo:** casca completa (login, sidebar, tokens, tipografia) + todas as páginas no mesmo nível de acabamento

## Contexto

O painel atual é dark utilitário (`neutral-950`, cards cinza, tipografia system). Funciona, mas parece template genérico. O operador é único e não técnico; a UI precisa comunicar status e próximos passos sem jargão.

**Decisões de produto (brainstorming):**

| Eixo | Escolha |
|------|---------|
| Marca | Identidade própria do produto (não Houer) |
| Clima | Escuro operacional |
| Escopo | Casca + todas as páginas |
| Acento | Azul elétrico sóbrio (“ML” frio, sem branding oficial do Mercado Livre) |
| Abordagem | “Console de afiliado” — status strip como assinatura |

## Objetivo

Melhorar substancialmente a UI do `apps/dashboard` com identidade visual própria, hierarquia tipográfica clara e um elemento memorável (faixa de status), sem mudar fluxos de API, regras de negócio ou contratos do agente.

## Fora de escopo

- Mudanças de endpoints, schemas ou pipeline do agente
- Multi-tenant / multi-usuário
- Tema claro / toggle de tema
- Reescrita de copy de domínio além do necessário para estados vazios/erro
- Identidade visual Houer

## Direção visual: “Console de afiliado”

Dark operacional com um único acento azul elétrico. Assinatura: **faixa de status operacional** (WhatsApp · Sessão afiliado · Disparos) sempre visível no topo do conteúdo. Tipografia carrega a personalidade; decoração mínima.

### Tokens de cor

| Token | Hex | Uso |
|-------|-----|-----|
| `--bg` | `#0B0F14` | body |
| `--surface` | `#121821` | cards, sidebar |
| `--elevated` | `#1A2330` | hover, inputs |
| `--border` | `#243041` | divisórias |
| `--text` | `#E8EEF6` | texto principal |
| `--muted` | `#8B9BB0` | labels, ajuda |
| `--accent` | `#4F8CFF` | links, item ativo, CTA primário |
| `--accent-hover` | `#6BA0FF` | hover do acento |
| `--success` | `#3DDC97` | WhatsApp ok, ready |
| `--warning` | `#F5A524` | warn, pausado |
| `--danger` | `#FF6B6B` | falhas |

Implementação: CSS variables em `globals.css` + utilitários Tailwind (`@theme` / classes semânticas). Evitar espalhar hex cru nos componentes após a migração.

### Tipografia

| Papel | Família | Uso |
|-------|---------|-----|
| Display | **Syne** (600/700) | títulos de página, nome do produto no login/sidebar |
| Corpo | **IBM Plex Sans** (400/500) | UI geral, formulários, nav |
| Dados | **IBM Plex Mono** (400) | horários de disparo, IDs, status técnicos |

Carregar via `next/font` (Google). Manter `lang="pt-BR"` e antialias.

### Assinatura: status strip

Componente compartilhado no layout do painel (abaixo do `PausedBanner`):

- **Visão geral:** versão completa — dots + labels + estados + CTAs (Pausar/Retomar, Coletar agora quando fizer sentido)
- **Demais páginas:** versão compacta — só dots + labels curtos; link implícito/volta à visão geral se precisar de ação

Fonte de dados: overview/diagnostics já existentes via `tryAgent` (sem novos endpoints obrigatórios). Se o fetch falhar, strip mostra estado “indisponível” sem quebrar a página.

## Layout

```
┌──────────┬────────────────────────────────────────────┐
│  MARCA   │  [PausedBanner se houver]                  │
│  Agente  │  [status strip]                            │
│  ML      ├────────────────────────────────────────────┤
│          │  título da página              [ações]     │
│  nav…    │  conteúdo (max-w ~1120px)                  │
│          │                                            │
│  [Sair]  │                                            │
└──────────┴────────────────────────────────────────────┘
```

### Sidebar (desktop, ~224px)

- Fundo `--surface`; borda `--border`
- Marca em Syne no topo (“Agente ML Afiliados” + subtítulo muted)
- Item ativo: fundo `--elevated` + barra esquerda 2px `--accent`
- Ícones line-art discretos (SVG stroke) ao lado dos labels
- `BotaoSair` no rodapé (`mt-auto`)

### Mobile

- Sidebar oculta (como hoje)
- **Bottom nav** com 4 destinos principais: Visão geral, Aprovação, Grupos, WhatsApp + item “Mais” abrindo o restante (Fontes, Configurações, Credenciais, Sair)
- Conteúdo com `padding-bottom` suficiente para não ficar sob a nav

### Página padrão

1. Título em Syne + subtítulo curto em muted (quando houver)
2. Slot de ações à direita no header da página
3. Conteúdo em cards/listas com tokens
4. Listas com horário em IBM Plex Mono

## Telas

### Login (`/login`)

- Fundo `--bg`; marca Syne central; card estreito `--surface`
- Input e CTA com tokens; CTA primário `--accent`
- Mensagem de ajuda em muted; sem decoração excessiva

### Visão geral (`/`)

1. Status strip completa  
2. `DiagnosticsPanel` restilizado (ready = linha discreta success; bloqueio = painel danger/warning com links de ação)  
3. Grade de status (WhatsApp / sessão / disparos) — pode fundir visualmente com a strip se redundante; preferir strip como fonte de verdade e cards só se agregarem valor  
4. Seções: próximos disparos, últimos enviados, últimas execuções

### Aprovação (`/aprovacao`)

- Cada rascunho como bloco de revisão
- Corpo editável; horário em mono
- Aprovar = botão primário; Rejeitar = secundário/danger outline
- Estado vazio: frase + próximo passo (“Coletar agora” ou ir a Fontes)

### Fontes, Grupos, Configurações, Credenciais, WhatsApp

- Mesmos tokens e padrões de formulário
- Labels muted; inputs `--elevated`; botões primário/secundário consistentes
- WhatsApp: área de foco no status de conexão + instrução curta (QR / reconectar)

### Componentes compartilhados a atualizar

- `nav-links`, `paused-banner`, `diagnostics-panel`, `setup-hint`, `botao-sair`, `refresh-button`, `sync-groups-button`, `auto-refresh`
- Novo: `status-strip` (+ eventual `bottom-nav` mobile)
- `error.tsx` alinhado aos tokens

## Estados e acessibilidade

| Estado | Comportamento |
|--------|----------------|
| Vazio | Uma frase em português + próximo passo acionável |
| Erro de agente | `SetupHint` no visual novo; não estourar 500 na página |
| Loading | Manter padrões atuais (Server Components); botões com feedback nativo de form |
| Foco | Outline visível no acento |
| Motion | Respeitar `prefers-reduced-motion` |

Copy permanece em português, tom direto para operador não técnico.

## Arquitetura de implementação (UI only)

1. Definir tokens + fontes em `app/globals.css` e `app/layout.tsx`
2. Extrair primitivos leves (se necessário): `PageHeader`, `Card`, `Button` — só se reduzir duplicação; senão classes utilitárias semânticas
3. Atualizar `(painel)/layout.tsx` (sidebar + strip + mobile nav)
4. Migrar páginas e componentes na mesma passagem visual
5. `pnpm typecheck` como portão de qualidade

Não introduzir dependências de UI kit (shadcn etc.) neste redesign, salvo se já existirem no repo.

## Critérios de sucesso

- [ ] Identidade reconhecível: dark + azul `#4F8CFF` + Syne/Plex, sem parecer template neutral
- [ ] Status strip presente em todas as telas autenticadas
- [ ] Login e todas as rotas do painel no mesmo sistema visual
- [ ] Navegação usável em mobile (bottom nav)
- [ ] Contrastes legíveis; foco de teclado visível
- [ ] `pnpm typecheck` passa
- [ ] Nenhuma mudança de contrato da API do agente

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Strip duplica cards da home | Preferir strip; simplificar cards se redundantes |
| Fontes Google indisponíveis offline | `next/font` com fallback system-ui / ui-monospace |
| Bottom nav cobre CTAs | `pb` generoso no main mobile |

## Próximo passo

Após aprovação deste spec pelo usuário → skill `writing-plans` com plano de implementação detalhado → execução.
