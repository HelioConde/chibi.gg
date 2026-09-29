# Chibi Native Companion

Aplicativo Windows standalone para acompanhar o ciclo da partida TFT sem Overwolf, extensão ou automação de jogo.

## Recursos atuais

- LCU local read-only: Riot ID, lobby, fila, Ready Check, partida e pós-jogo.
- Sessão Chibi e foco de estudo persistidos em `%APPDATA%\\ChibiNative`.
- Janela desktop e system tray.
- Sem telemetria live inventada: campos permanecem `UNAVAILABLE` até uma fonte legítima ser comprovada.
- Tracker local read-only: heartbeat do Riot, tail incremental do `TFT.log`, checkpoints `TFTEoGStats.json` e inputs limitados a D/F/cliques nas regiões públicas da HUD. Providers publicam eventos e o reducer reconcilia o estado; não há OCR, leitura de memória nem automação.
- Após a partida, consulta somente as Edge Functions públicas existentes do Chibi para localizar o resultado pessoal e abrir a análise no perfil web.

## Executar

```text
python app.py
python app.py --demo
python app.py --telemetry-report
python app.py --vision-debug
python app.py --tracker-debug
python app.py --import-plan game-plan.example.json
```

O plano local salvo em `%APPDATA%\\ChibiNative\\game-plan.json` é uma referência estática de partida: ele não lê board, não sugere compras nem automatiza decisões.

`CHIBI_API_BASE` pode substituir a base das Edge Functions para desenvolvimento. O desktop não contém `RIOT_API_KEY`, service role ou qualquer chave privada.

O aplicativo não lê memória, não injeta DLLs, não intercepta tráfego e não envia ações ao cliente Riot.

## Tracker local

`TFTHeartbeatProvider`, `TFTLogProvider`, `TFTInputProvider` e `TFTCheckpointProvider` são independentes e toleram arquivos ausentes, rotação e JSON parcial. Eles alimentam `ChibiStateReducer`; assim a origem de cada campo permanece explícita (`source`, `confidence`, `observedAt`) e um checkpoint autoritativo pode reconciliar eventos especulativos.

Level e gold tentam primeiro a Live Client Data local (`127.0.0.1:2999`) com timeout curto e backoff; a porta é opcional e o tracker continua funcionando quando ela está indisponível. Round aceita apenas eventos do log que tragam explicitamente o formato `N-N`. Os três providers de visão usam ROIs relativas à janela TFT, são pausados fora da partida e permanecem aguardando templates/calibração até haver uma leitura visual validada — nunca preenchem o estado com valores estimados.
