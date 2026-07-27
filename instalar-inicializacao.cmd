@echo off
setlocal
REM ===========================================================================
REM instalar-inicializacao.cmd — faz o agente ligar junto com o Windows
REM
REM Dê dois cliques. Cria um atalho na pasta "Inicializar" do seu usuário,
REM que roda o agente minimizado toda vez que você faz login.
REM
REM Por que a pasta Inicializar (e não um Serviço do Windows): o login no
REM portal de afiliados precisa ABRIR UMA JANELA de navegador, e serviços do
REM Windows rodam sem sessão gráfica — o login simplesmente não funcionaria.
REM Também não exige permissão de administrador.
REM
REM Para desfazer: rode remover-inicializacao.cmd
REM ===========================================================================

cd /d "%~dp0"
title Agente de Afiliados - Iniciar com o Windows

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS=%~dp0.iniciar-oculto.vbs"

echo.
echo  ====================================================
echo    Ligar o agente junto com o Windows
echo  ====================================================
echo.

if not exist "apps\agent\.env" (
    echo  X A instalacao ainda nao foi feita.
    echo    De dois cliques em setup.cmd primeiro.
    echo.
    pause
    exit /b 1
)

REM Script intermediario: roda o start.cmd sem piscar janela de console.
REM A janela do agente fica minimizada na barra de tarefas.
> "%VBS%" echo ' Gerado por instalar-inicializacao.cmd - nao edite.
>> "%VBS%" echo Set sh = CreateObject("WScript.Shell")
>> "%VBS%" echo sh.CurrentDirectory = "%~dp0"
>> "%VBS%" echo sh.Run "cmd /c start.cmd", 7, False

REM Atalho na pasta Inicializar apontando para o VBS.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%STARTUP%\Agente de Afiliados.lnk');" ^
  "$s.TargetPath='wscript.exe';" ^
  "$s.Arguments='\"%VBS%\"';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.Description='Agente de Afiliados ML - inicia com o Windows';" ^
  "$s.Save()"

if errorlevel 1 (
    echo  X Nao consegui criar o atalho de inicializacao.
    echo.
    pause
    exit /b 1
)

echo  OK - Pronto!
echo.
echo  O agente vai ligar sozinho toda vez que voce entrar no Windows.
echo  A janela fica minimizada na barra de tarefas.
echo.
echo  IMPORTANTE: o Docker Desktop tambem precisa iniciar sozinho.
echo  Abra o Docker Desktop, va em Settings ^(engrenagem^) e marque
echo  "Start Docker Desktop when you sign in".
echo.
echo  Para desfazer: de dois cliques em remover-inicializacao.cmd
echo.
pause
