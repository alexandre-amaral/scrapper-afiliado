@echo off
setlocal enabledelayedexpansion
REM ===========================================================================
REM setup.cmd — instalação em um clique (Windows)
REM
REM Dê dois cliques neste arquivo.
REM
REM Não depende do Git Bash: usa só comandos nativos do Windows e o próprio
REM Node.js para gerar os segredos.
REM ===========================================================================

cd /d "%~dp0"
title Agente de Afiliados - Instalacao

echo.
echo  ====================================================
echo    Agente de Afiliados - Instalacao
echo  ====================================================
echo.

REM --- 1. Node.js -----------------------------------------------------------
echo  [1/6] Verificando o Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  X Node.js nao encontrado.
    echo.
    echo    1. Baixe em https://nodejs.org ^(botao da esquerda, versao LTS^)
    echo    2. Instale aceitando as opcoes padrao
    echo    3. FECHE esta janela, abra o setup.cmd de novo
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODEMAJOR=%%v
if !NODEMAJOR! LSS 20 (
    echo.
    echo  X Seu Node.js e antigo demais ^(precisa ser 20 ou maior^).
    echo    Atualize em https://nodejs.org e rode o setup.cmd de novo.
    echo.
    pause
    exit /b 1
)
echo        OK - Node.js instalado

REM --- 2. Docker ------------------------------------------------------------
echo  [2/6] Verificando o Docker...
where docker >nul 2>&1
if errorlevel 1 (
    echo.
    echo  X Docker Desktop nao encontrado.
    echo.
    echo    1. Baixe em https://www.docker.com/products/docker-desktop
    echo    2. Instale e REINICIE o computador
    echo    3. ABRA o Docker Desktop e espere o icone ficar verde
    echo    4. Rode o setup.cmd de novo
    echo.
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo  X O Docker esta instalado mas nao esta rodando.
    echo.
    echo    Abra o Docker Desktop, espere o icone da baleia ficar verde
    echo    e rode o setup.cmd de novo.
    echo.
    pause
    exit /b 1
)
echo        OK - Docker rodando

REM --- 3. pnpm --------------------------------------------------------------
echo  [3/6] Preparando o gerenciador de pacotes...
call corepack enable >nul 2>&1
call corepack prepare pnpm@11.16.0 --activate >nul 2>&1
where pnpm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  X Nao consegui preparar o pnpm.
    echo    Tente abrir o Prompt de Comando COMO ADMINISTRADOR e rodar:
    echo        corepack enable
    echo    Depois rode o setup.cmd de novo.
    echo.
    pause
    exit /b 1
)
echo        OK - pnpm pronto

REM --- 4. Arquivos de configuracao -----------------------------------------
REM Sao DOIS arquivos e o AGENT_TOKEN precisa ser identico nos dois,
REM senao o painel recebe 401 do agente em toda requisicao.
echo  [4/6] Criando os arquivos de configuracao...

if exist "apps\agent\.env" (
    echo        OK - configuracao do agente ja existe, preservada
) else (
    node -e "const fs=require('fs'),c=require('crypto');const r=()=>c.randomBytes(32).toString('hex');let t=fs.readFileSync('.env.example','utf8');for(const k of ['AGENT_TOKEN','SESSION_ENCRYPTION_KEY','EVOLUTION_API_KEY'])t=t.replace(new RegExp('^'+k+'=.*$','m'),k+'='+r());fs.writeFileSync('apps/agent/.env',t)"
    if errorlevel 1 (
        echo  X Falha ao criar a configuracao do agente.
        pause
        exit /b 1
    )
    echo        OK - configuracao do agente criada
)

if exist "apps\dashboard\.env.local" (
    echo        OK - configuracao do painel ja existe, preservada
) else (
    node -e "const fs=require('fs');const m=fs.readFileSync('apps/agent/.env','utf8').match(/^AGENT_TOKEN=(.*)$/m);fs.writeFileSync('apps/dashboard/.env.local','AGENT_URL=http://localhost:3001\nAGENT_TOKEN='+(m?m[1].trim():'')+'\n')"
    echo        OK - configuracao do painel criada
)

REM --- 5. Dependencias ------------------------------------------------------
echo  [5/6] Instalando dependencias ^(pode levar varios minutos^)...
call pnpm install --silent
if errorlevel 1 (
    echo.
    echo  X Falha ao instalar as dependencias. Verifique sua internet
    echo    e rode o setup.cmd de novo.
    echo.
    pause
    exit /b 1
)
echo        OK - dependencias instaladas

echo        Baixando o navegador interno ^(Chromium^)...
call pnpm --filter @ml-agent/agent exec playwright install chromium >nul 2>&1
if errorlevel 1 (
    echo        ! Nao consegui baixar o Chromium agora.
    echo          O agente funciona, mas o login do portal de afiliados
    echo          vai falhar. Rode depois:
    echo          pnpm --filter @ml-agent/agent exec playwright install chromium
) else (
    echo        OK - navegador pronto
)

REM --- 6. Evolution + banco -------------------------------------------------
echo  [6/6] Subindo o WhatsApp e criando o banco...

if not exist "docker-compose.override.yml" (
    > docker-compose.override.yml echo # Gerado pelo setup.cmd - expoe a Evolution so nesta maquina.
    >> docker-compose.override.yml echo services:
    >> docker-compose.override.yml echo   evolution:
    >> docker-compose.override.yml echo     ports:
    >> docker-compose.override.yml echo       - "127.0.0.1:8080:8080"
)

docker compose up -d evolution >nul 2>&1
if errorlevel 1 (
    echo.
    echo  X Nao consegui subir o servico de WhatsApp.
    echo    Confirme que o Docker Desktop esta aberto e verde.
    echo.
    pause
    exit /b 1
)

call pnpm db:generate >nul 2>&1
call pnpm db:migrate >nul 2>&1
if errorlevel 1 (
    echo  X Falha ao criar o banco de dados.
    pause
    exit /b 1
)
echo        OK - tudo pronto

echo.
echo  ====================================================
echo    Instalacao concluida!
echo.
echo    Agora de dois cliques em:  start.cmd
echo.
echo    Para o agente ligar sozinho com o computador,
echo    de dois cliques em:        instalar-inicializacao.cmd
echo.
echo    O guia de uso esta no arquivo docs/guia-de-uso.md
echo  ====================================================
echo.
pause
