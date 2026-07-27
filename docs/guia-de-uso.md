# Guia de operação

Este guia é para quem vai **usar** o agente no dia a dia. Não precisa saber
programar. Siga na ordem.

> **Resumo do que o programa faz:** ele procura promoções no Mercado Livre,
> transforma em link de afiliado seu (para você ganhar a comissão), escreve a
> mensagem de venda e posta nos seus grupos de WhatsApp, aos poucos, no
> horário que você definir.

---

## Índice

1. [Instalação (uma vez só)](#1-instalação-uma-vez-só)
2. [Ligar e desligar](#2-ligar-e-desligar)
3. [Primeira configuração](#3-primeira-configuração)
4. [O dia a dia](#4-o-dia-a-dia)
5. [Regras de ouro (para não ser banido)](#5-regras-de-ouro-para-não-ser-banido)
6. [Quando algo dá errado](#6-quando-algo-dá-errado)

---

## 1. Instalação (uma vez só)

### Antes de começar, instale dois programas

| Programa | Onde baixar | Observação |
|---|---|---|
| **Node.js** | <https://nodejs.org> | Baixe a versão **LTS** (botão da esquerda). Next → Next → Instalar. |
| **Docker Desktop** | <https://www.docker.com/products/docker-desktop> | Depois de instalar, **abra o Docker Desktop** e espere o ícone da baleia ficar verde. |

> O Docker precisa estar **aberto e verde** sempre que você for usar o agente.
> Deixe ele iniciar junto com o computador (nas configurações do Docker
> Desktop, opção "Start Docker Desktop when you sign in").

### Rode o instalador

Na pasta do projeto, **dê dois cliques em `setup.cmd`**.

> No Mac ou Linux, abra o Terminal na pasta e rode `bash setup.sh`.

Ele faz tudo sozinho: verifica os programas, cria as senhas de segurança,
instala o que falta, baixa o navegador interno e prepara o banco de dados.
Leva alguns minutos na primeira vez — é normal parecer parado enquanto
instala.

Quando terminar, aparece **"Instalação concluída!"**.

> Se aparecer uma mensagem com `X`, ela diz exatamente o que fazer
> (normalmente: "abra o Docker Desktop" ou "instale o Node.js"). Resolva e
> dê dois cliques em `setup.cmd` de novo — pode rodar quantas vezes quiser,
> não estraga nada.

---

## 2. Ligar e desligar

**Para ligar:** dois cliques em **`start.cmd`**.

O painel abre sozinho no navegador em `http://localhost:3000`.

**Para desligar:** feche a janela preta que ficou aberta.

> ⚠️ **Enquanto aquela janela estiver aberta, o agente está trabalhando.**
> Se você fechar ou desligar o computador, ele para de postar.

### Fazer o agente ligar sozinho (recomendado)

Para não precisar lembrar de ligar todo dia, dê dois cliques em
**`instalar-inicializacao.cmd`**. A partir daí o agente inicia junto com o
Windows, minimizado na barra de tarefas.

Faça também isto, uma vez só:

1. Abra o **Docker Desktop**
2. Clique na **engrenagem** (Settings)
3. Marque **"Start Docker Desktop when you sign in"**

> Para desfazer depois: dois cliques em `remover-inicializacao.cmd`.

> 💡 O computador precisa estar **ligado** para o agente postar. Se ele ficar
> desligado ou dormindo, nada é enviado naquele período — as mensagens
> esperam na fila.

---

## 3. Primeira configuração

Com o painel aberto, faça estes quatro passos **na ordem**. Cada um só
precisa ser feito uma vez.

### 3.1 Conectar o WhatsApp

1. No menu, clique em **WhatsApp**.
2. Vai aparecer um **QR Code** na tela.
3. No celular: WhatsApp → Configurações → **Aparelhos conectados** →
   **Conectar um aparelho** → aponte para o QR Code.
4. O status muda para **conectado**.

> 🚨 **Use um número dedicado, nunca o seu pessoal.** Veja a
> [seção 5](#5-regras-de-ouro-para-não-ser-banido) — isso é sério.

### 3.2 Conectar a conta de afiliado

1. Menu → **Credenciais**.
2. Clique em **Conectar conta de afiliado**.
3. **Uma janela de navegador vai abrir sozinha.** Faça login no Mercado Livre
   normalmente e aprove o código de verificação (2FA) se pedir.
4. Assim que entrar, pode fechar essa janela. O painel mostra
   **sessão válida**.

> Você tem 5 minutos para completar o login. Se demorar, é só clicar em
> "Conectar" de novo.

### 3.3 Informar a etiqueta de afiliado

Ainda em **Credenciais**, preencha o campo **Etiqueta de afiliado**.

Para descobrir a sua: entre no [portal de afiliados do Mercado
Livre](https://www.mercadolivre.com.br/afiliados/hub) → procure por
"Etiqueta em uso". É um código curto de letras e números.

> ⚠️ **Sem isso, nenhum link é gerado e você não ganha comissão.** É o erro
> mais comum.

### 3.4 Colar a chave da Gemini (a IA que escreve as mensagens)

1. Acesse <https://aistudio.google.com/apikey> e faça login com sua conta
   Google.
2. Clique em **Create API key** e copie o código gerado.
3. No painel: **Credenciais** → cole no campo **Chave Gemini** → salvar.

> É gratuito para o volume que o agente usa.

### 3.5 Escolher os grupos

1. Menu → **Grupos**.
2. Clique em **Sincronizar grupos** (busca os grupos do WhatsApp conectado).
3. Todos vêm **desligados** por segurança. Ligue apenas os que você quer usar.
4. Em **máx/dia**, defina quantas mensagens por dia cada grupo recebe.
   Comece com **3 a 5**.

---

## 4. O dia a dia

### Como funciona sozinho

De 2 em 2 horas o agente procura promoções novas, escolhe as melhores, gera
os links e prepara as mensagens. Depois vai postando **uma de cada vez**, com
intervalos irregulares, só dentro do horário que você definiu.

### Telas que você vai usar

| Tela | Para quê |
|---|---|
| **Início** | Ver se está tudo certo: WhatsApp conectado, o que já foi enviado, o que vem a seguir. |
| **Aprovação** | Ler as mensagens antes de irem ao ar, editar o texto ou descartar. |
| **Fontes** | Colar links de produtos específicos que você quer divulgar. |
| **Configurações** | Horário de envio, ritmo, desconto mínimo, palavras-chave. |
| **Grupos** | Ligar/desligar grupos e o limite diário de cada um. |

### Aprovar antes de postar (recomendado no começo)

Em **Configurações**, desligue a opção **aprovação automática**. Assim, toda
mensagem espera seu "ok" na tela **Aprovação** antes de ser enviada. Depois
que confiar no resultado, pode ligar de volta.

### Divulgar um produto específico

Menu → **Fontes** → cole o link do produto → **Processar**. O agente gera o
link de afiliado, escreve a mensagem e coloca na fila.

### Pausar tudo

Na tela **Início** existe um botão de **pausar**. Nada é enviado enquanto
estiver pausado. Use sem medo — é reversível.

---

## 5. Regras de ouro (para não ser banido)

O WhatsApp **não autoriza** este tipo de automação. O programa foi feito para
imitar comportamento humano e reduzir o risco, mas o risco existe e é real.

1. **Nunca use seu número pessoal.** Use um chip separado, que você possa
   perder sem prejuízo.
2. **Aqueça o número antes.** Use ele manualmente por 1 ou 2 semanas
   (conversar, entrar em grupos) antes de ligar o agente.
3. **Vá devagar.** Comece com 1 grupo e 3 mensagens por dia. Aumente só
   depois de semanas sem problema.
4. **Só em grupos seus**, onde as pessoas querem receber ofertas. Denúncia de
   membro é a principal causa de banimento.
5. **Se cair, pare.** O agente se pausa sozinho ao detectar desconexão. Não
   force reconexão em seguida — espere algumas horas.

> Se o número for banido, você perde só aquele chip. Por isso a regra nº 1.

---

## 6. Quando algo dá errado

### Comece sempre pela tela Início

No topo da tela **Início** existe um quadro de diagnóstico que confere tudo
sozinho: WhatsApp, conta de afiliado, etiqueta, chave da Gemini, grupos
ligados e pausa.

- **Faixa verde** → está tudo certo.
- **Quadro vermelho** → falta algo que **impede** o envio. Ele diz o que é e
  tem um link direto para a tela onde se resolve.
- **Quadro amarelo** → funciona, mas vale olhar.

**Na maioria dos casos, esse quadro já responde sua dúvida.** As seções
abaixo são para o que ele não cobre.

### Faixa amarela "Agente pausado"

Aparece no topo de todas as telas. Significa que nada está sendo enviado.
Clique em **Retomar envios**.

> O agente se pausa **sozinho** quando o WhatsApp cai, por segurança. Se isso
> aconteceu, reconecte o WhatsApp **antes** de retomar.

### O painel não abre / diz "agente não alcançável"

O agente não está ligado. Dê dois cliques em `start.cmd` e espere alguns
segundos.

### "Docker não está rodando"

Abra o **Docker Desktop** e espere o ícone da baleia ficar verde. Depois dê
dois cliques em `start.cmd` de novo.

### O WhatsApp desconectou

Normal de tempos em tempos. Vá em **WhatsApp** no painel e escaneie o QR Code
de novo. Depois, na tela **Início**, tire a pausa (o agente se pausa sozinho
por segurança quando isso acontece).

### Não está gerando link / não sai comissão

Quase sempre é a **etiqueta de afiliado** vazia. Confira em **Credenciais**
(passo [3.3](#33-informar-a-etiqueta-de-afiliado)).

### "Sessão do portal expirada"

O login no Mercado Livre venceu. **Credenciais** → **Conectar conta de
afiliado** → faça login de novo.

### As mensagens não são enviadas

O quadro de diagnóstico na tela **Início** cobre as causas mais comuns. Se
ele estiver todo verde e mesmo assim nada sair, confira:

1. Está dentro do **horário de envio**? (Configurações)
2. As mensagens estão **aprovadas**? (tela Aprovação — se a aprovação
   automática estiver desligada, elas esperam seu "ok")
3. O limite de **mensagens por dia** do grupo já foi atingido? (tela Grupos)

> O agente envia **uma mensagem por vez**, com intervalos irregulares de
> propósito. É normal demorar entre uma e outra — isso é o que reduz o risco
> de banimento.

### Nada acima resolveu

Na tela **Início**, o quadro de **execuções recentes** mostra os erros com a
mensagem exata. Mande um print para quem te passou o sistema.
