@echo off
setlocal
REM ===========================================================================
REM remover-inicializacao.cmd — desfaz o "ligar junto com o Windows"
REM
REM Dê dois cliques. O agente para de iniciar sozinho; você continua podendo
REM ligá-lo quando quiser pelo start.cmd.
REM ===========================================================================

cd /d "%~dp0"
title Agente de Afiliados - Remover inicializacao automatica

set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Agente de Afiliados.lnk"

echo.
if exist "%LNK%" (
    del "%LNK%"
    echo  OK - O agente nao vai mais ligar sozinho com o Windows.
) else (
    echo  O agente ja nao estava configurado para ligar sozinho.
)

if exist "%~dp0.iniciar-oculto.vbs" del "%~dp0.iniciar-oculto.vbs"

echo.
echo  Voce ainda pode ligar o agente quando quiser,
echo  dando dois cliques em start.cmd
echo.
pause
