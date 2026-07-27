# 👋 Comece por aqui

Este guia leva você do zero até o agente funcionando. **Não precisa saber
programar.** São 4 etapas, cerca de 30 minutos (a maior parte é espera de
download).

> **O que este programa faz:** procura promoções no Mercado Livre, transforma
> em link de afiliado seu (para você ganhar comissão), escreve a mensagem de
> venda com inteligência artificial e posta nos seus grupos de WhatsApp aos
> poucos, no horário que você escolher.

---

## Etapa 1 — Instalar dois programas

Instale os dois antes de tudo. São gratuitos.

### 1.1 Node.js

1. Acesse **<https://nodejs.org>**
2. Clique no botão da **esquerda** (o que diz **LTS**)
3. Abra o arquivo baixado e instale aceitando todas as opções padrão

### 1.2 Docker Desktop

1. Acesse **<https://www.docker.com/products/docker-desktop>**
2. Baixe a versão para **Windows** e instale
3. **Reinicie o computador** quando ele pedir
4. Abra o **Docker Desktop** e espere o ícone da baleia ficar **verde**
   (canto inferior esquerdo diz "Engine running")

> 💡 **Deixe o Docker abrir sozinho:** dentro do Docker Desktop, clique na
> **engrenagem** (Settings) e marque **"Start Docker Desktop when you sign
> in"**. Assim você não precisa lembrar de abrir toda vez.

---

## Etapa 2 — Baixar o projeto

1. Abra o link do repositório que te enviaram
2. Clique no botão verde **`< > Code`**
3. Clique em **Download ZIP**
4. Abra a pasta **Downloads**, clique com o botão direito no arquivo e
   escolha **Extrair tudo...**
5. Extraia para **Documentos** (ou outra pasta fácil de achar)

> Você deve acabar com uma pasta contendo arquivos como `setup.cmd`,
> `start.cmd` e a pasta `docs`.

---

## Etapa 3 — Instalar o agente

1. Abra a pasta que você extraiu
2. **Dê dois cliques em `setup.cmd`**
3. Uma janela preta abre e vai mostrando o progresso. **Espere terminar** —
   pode levar vários minutos e às vezes parece travado, é normal.
4. Quando aparecer **"Instalação concluída!"**, pode fechar a janela.

### Se aparecer uma mensagem com `X`

A mensagem diz exatamente o que fazer. As mais comuns:

| Mensagem | O que fazer |
|---|---|
| `Node.js nao encontrado` | Volte à etapa 1.1. Depois **feche e abra** a janela de novo. |
| `Docker ... nao esta rodando` | Abra o Docker Desktop e espere ficar verde. |
| `Nao consegui preparar o pnpm` | Clique com o botão direito em `setup.cmd` → **Executar como administrador**. |

Resolva e dê dois cliques em `setup.cmd` de novo. **Pode rodar quantas vezes
quiser — não estraga nada.**

> ⚠️ **Windows SmartScreen:** se aparecer "O Windows protegeu o computador",
> clique em **Mais informações** → **Executar assim mesmo**. Isso acontece
> porque o arquivo não tem assinatura digital paga.

---

## Etapa 4 — Ligar e configurar

1. **Dê dois cliques em `start.cmd`**
2. O painel abre sozinho no navegador em alguns segundos
3. **Deixe a janela preta aberta** — é ela que mantém o agente funcionando

Agora siga o **[guia de uso](./guia-de-uso.md)**, a partir da seção
**"3. Primeira configuração"**. Lá você vai:

- conectar o WhatsApp (QR Code);
- conectar sua conta de afiliado do Mercado Livre;
- informar sua etiqueta de afiliado (é o que garante sua comissão);
- colar a chave da inteligência artificial (gratuita);
- escolher em quais grupos postar.

> 💡 **A tela inicial confere tudo sozinha.** Se faltar alguma configuração,
> aparece um quadro vermelho dizendo o que é e com um link para resolver.
> Quando ficar tudo verde, está pronto.

---

## Depois que estiver funcionando

**Faça o agente ligar sozinho:** dê dois cliques em
`instalar-inicializacao.cmd`. Ele passa a iniciar junto com o Windows,
minimizado. (Para desfazer: `remover-inicializacao.cmd`.)

**Leia os avisos de segurança** na seção 5 do [guia de uso](./guia-de-uso.md). O mais
importante:

> 🚨 **Use um chip de WhatsApp dedicado, nunca o seu número pessoal.** O
> WhatsApp não autoriza este tipo de automação e existe risco real de
> banimento do número. Comece devagar: 1 grupo, poucas mensagens por dia.

---

## Resumo dos arquivos

| Arquivo | Para quê |
|---|---|
| `setup.cmd` | Instalar (uma vez só) |
| `start.cmd` | Ligar o agente (toda vez) |
| `instalar-inicializacao.cmd` | Fazer ligar sozinho com o Windows |
| `remover-inicializacao.cmd` | Desfazer o item acima |
| `docs/guia-de-uso.md` | Manual de uso do dia a dia |

---

## Precisa de ajuda?

1. Veja o quadro de diagnóstico na tela **Início** do painel
2. Consulte a seção **"6. Quando algo dá errado"** do [guia de uso](./guia-de-uso.md)
3. Se não resolver, mande um print da tela para quem te passou o sistema
