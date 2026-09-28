# Migração para Chibi Native Companion

## Reutilizado conceitualmente

- LCU read-only, lockfile e normalização de gameflow.
- Estados de fila, Ready Check, partida, reconexão e pós-jogo.
- Ciclo de sessão e foco do jogador.
- Qt, system tray e PyInstaller.

## Refatorado

- Novo contexto/event bus, modelos independentes e dados em `%APPDATA%\\ChibiNative`.
- Telemetria baseada em fontes e confiança explícita; o valor só é selecionado quando `VERIFIED`.

## Não usado em runtime

- `overlay-python/`, bridge WebSocket e snapshots de revisão antigos.
- `overwolf-companion/`, GEP e qualquer integração Overwolf.

O projeto nativo não lê memória, não injeta código e não intercepta tráfego.
