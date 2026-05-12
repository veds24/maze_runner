@echo off
REM =====================================================
REM  run.bat — Maze Runner: Compile + Launch
REM  Run this from VS Code Terminal (Ctrl+`) or directly
REM =====================================================

echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║        MAZE RUNNER — Build Script         ║
echo  ╚═══════════════════════════════════════════╝
echo.

REM ── Step 1: Activate Emscripten environment ──────────
echo [1/3] Activating Emscripten...

REM Update this path to where you installed emsdk
SET EMSDK_PATH=%USERPROFILE%\emsdk

IF NOT EXIST "%EMSDK_PATH%\emsdk_env.bat" (
  echo ERROR: emsdk not found at %EMSDK_PATH%
  echo Please update EMSDK_PATH in this script.
  pause
  exit /b 1
)

call "%EMSDK_PATH%\emsdk_env.bat" >nul 2>&1
echo  Emscripten activated.

REM ── Step 2: Compile C to WebAssembly ─────────────────
echo [2/3] Compiling maze.c to WebAssembly...

emcc maze.c ^
  -o maze.js ^
  -s WASM=1 ^
  -s EXPORTED_FUNCTIONS="['_js_startGame','_js_movePlayer','_js_checkWin','_js_getMoves','_js_getElapsed','_js_getRows','_js_getCols','_js_getMazeCell','_js_isGameWon']" ^
  -s EXPORTED_RUNTIME_METHODS="['cwrap']" ^
  -s ALLOW_MEMORY_GROWTH=1 ^
  -s MODULARIZE=0 ^
  -s ENVIRONMENT=web ^
  -O2

IF %ERRORLEVEL% NEQ 0 (
  echo.
  echo ERROR: Compilation failed. Check maze.c for errors.
  pause
  exit /b 1
)

echo  Compiled successfully! (maze.js + maze.wasm created)

REM ── Step 3: Start local server and open browser ──────
echo [3/3] Starting local server ^& opening browser...

REM Check if Python is available
where python >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
  echo  Using Python HTTP server on http://localhost:8080
  start "" "http://localhost:8080"
  python -m http.server 8080
) ELSE (
  where python3 >nul 2>&1
  IF %ERRORLEVEL% EQU 0 (
    echo  Using Python3 HTTP server on http://localhost:8080
    start "" "http://localhost:8080"
    python3 -m http.server 8080
  ) ELSE (
    echo  Python not found. Trying Node http-server...
    where npx >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
      start "" "http://localhost:8080"
      npx http-server -p 8080
    ) ELSE (
      echo.
      echo  Could not start a server automatically.
      echo  Please open index.html via a live server manually.
      pause
    )
  )
)
