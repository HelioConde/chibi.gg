# Chibi Native Companion

Aplicativo Windows standalone para acompanhar o ciclo da partida TFT sem Overwolf, extensão ou automação de jogo.

## Recursos atuais

- LCU local read-only: Riot ID, lobby, fila, Ready Check, partida e pós-jogo.
- Sessão Chibi e foco de estudo persistidos em `%APPDATA%\\ChibiNative`.
- Janela desktop e system tray.
- Sem telemetria live inventada: campos permanecem `UNAVAILABLE` até uma fonte legítima ser comprovada.
- Após a partida, consulta somente as Edge Functions públicas existentes do Chibi para localizar o resultado pessoal e abrir a análise no perfil web.

## Executar

```text
python app.py
python app.py --demo
python app.py --telemetry-report
```

`CHIBI_API_BASE` pode substituir a base das Edge Functions para desenvolvimento. O desktop não contém `RIOT_API_KEY`, service role ou qualquer chave privada.

O aplicativo não lê memória, não injeta DLLs, não intercepta tráfego e não envia ações ao cliente Riot.
