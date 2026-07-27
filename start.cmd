@echo off
setlocal enabledelayedexpansion
REM ===========================================================================
REM start.cmd — liga o agente (Windows)
REM
REM Dê dois cliques. O painel abre sozinho no navegador.
REM Para desligar: feche esta janela.
REM ===========================================================================

cd /d "%~dp0"
title Agente de Afiliados - EM EXECUCAO (nao feche esta janela)

if not exist "apps\agent\.env" (
    echo.
    echo  X A instalacao ainda nao foi feita.
    echo    De dois cliques em setup.cmd primeiro.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo.
    echo  X As dependencias nao foram instaladas.
    echo    De dois cliques em setup.cmd primeiro.
    echo.
    pause
    exit /b 1
)

REM --- Docker ---------------------------------------------------------------
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo  X O Docker Desktop nao esta rodando.
    echo.
    echo    Abra o Docker Desktop, espere o icone da baleia ficar verde
    echo    e de dois cliques em start.cmd de novo.
    echo.
    pause
    exit /b 1
)

REM O agente e o painel guardam o mesmo AGENT_TOKEN em arquivos separados.
REM Se divergirem, o painel fica vazio sem explicacao - checar aqui evita
REM um diagnostico impossivel para quem nao e tecnico.
if exist "apps\dashboard\.env.local" (
    node -e "const fs=require('fs');const g=f=>{const m=fs.readFileSync(f,'utf8').match(/^AGENT_TOKEN=(.*)$/m);return m?m[1].trim():''};process.exit(g('apps/agent/.env')===g('apps/dashboard/.env.local')?0:1)" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo  X A senha interna do agente e a do painel estao diferentes.
        echo.
        echo    Apague o arquivo apps\dashboard\.env.local
        echo    e rode o setup.cmd de novo.
        echo.
        pause
        exit /b 1
    )
) else (
    echo.
    echo  X Falta a configuracao do painel. Rode o setup.cmd primeiro.
    echo.
    pause
    exit /b 1
)

echo  Ligando o servico de WhatsApp...
docker compose up -d evolution >nul 2>&1

echo.
echo  ====================================================
echo    Agente de Afiliados - LIGADO
echo.
echo    Painel: http://localhost:3000
echo    ^(abre sozinho em alguns segundos^)
echo.
echo    DEIXE ESTA JANELA ABERTA enquanto estiver usando.
echo    Para desligar: feche esta janela.
echo  ====================================================
echo.

REM Abre o navegador assim que o painel responder, sem travar o console.
start "" /b cmd /c "for /l %%i in (1,1,60) do (curl -s -o nul -m 1 http://localhost:3000 >nul 2>&1 && (start "" http://localhost:3000 & exit) || timeout /t 1 /nobreak >nul)"

call pnpm dev
