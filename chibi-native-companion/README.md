# Chibi Native Companion

Aplicativo Windows standalone para acompanhar o ciclo da partida TFT sem Overwolf, extensão ou automação de jogo.

## Milestone 1

- LCU local read-only: Riot ID, lobby, fila, Ready Check, partida e pós-jogo.
- Sessão Chibi e foco de estudo persistidos em `%APPDATA%\\ChibiNative`.
- Janela desktop e system tray.
- Sem telemetria live inventada: campos permanecem `UNAVAILABLE` até uma fonte legítima ser comprovada.

## Executar

```text
python app.py
python app.py --demo
python app.py --telemetry-report
```

O aplicativo não lê memória, não injeta DLLs, não intercepta tráfego e não envia ações ao cliente Riot.
