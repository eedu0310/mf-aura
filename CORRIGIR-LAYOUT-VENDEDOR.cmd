@echo off
setlocal
cd /d "%~dp0"

set "TARGET=%CD%\src\app\(vendedor)\layout.tsx"

if not exist "%CD%\src\app\(vendedor)" (
  echo ERRO: Pasta nao encontrada: %CD%\src\app\(vendedor)
  echo Coloque este arquivo na raiz do projeto AURA.
  pause
  exit /b 1
)

(
  echo import type { ReactNode } from "react";
  echo.
  echo interface VendedorLayoutProps {
  echo   children: ReactNode;
  echo }
  echo.
  echo export default function VendedorLayout^({ children }: VendedorLayoutProps^) {
  echo   return children;
  echo }
)> "%TARGET%"

findstr /N /I "globals.css fontsource UserProfileProvider PwaRegister" "%TARGET%" >nul
if not errorlevel 1 (
  echo ERRO: O layout ainda contem imports que deveriam estar apenas no layout raiz.
  type "%TARGET%"
  pause
  exit /b 1
)

if exist ".next" rmdir /s /q ".next"

echo.
echo Layout corrigido com sucesso:
echo %TARGET%
echo.
type "%TARGET%"
echo.
echo A pasta .next foi removida.
echo Execute agora: npx next build
pause
