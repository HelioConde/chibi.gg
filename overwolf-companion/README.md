# Chibi Overwolf Companion (debug scaffold)

Este app Overwolf é um background controller de debug. Ele pede apenas `me`, `match_info`, `board`, `bench` e `store`, registra quais features foram aceitas e envia envelopes sanitizados para `ws://127.0.0.1:8765`.

Ele não usa augments, dados de adversários, recomendações, automação nem UI de jogo. O bridge Python aceita somente loopback e continua opcional: o Companion abre normalmente sem Overwolf.

## Desenvolvimento

```text
npm install
npm run typecheck
npm test
npm run build
```

`npm run build` cria uma extensão desempacotada pronta em `dist/`: `manifest.json`, `index.html`, JavaScript compilado e `assets/icon.png`. Nenhum TypeScript é necessário em runtime. `npm run dev` e `npm run package:dev` preparam a mesma pasta; `npm run debug:reset` limpa somente `overwolf-companion/debug/`.

## Teste local no Overwolf

1. Instale o Overwolf e habilite **Development Options**.
2. Na pasta `overwolf-companion`, execute `npm ci` e `npm run build`.
3. Use **Load unpacked extension** e selecione `overwolf-companion/dist/` (a pasta que contém `manifest.json`).
4. Abra o Chibi Companion Python com `python app.py --debug`.
5. Abra League/TFT e entre em uma partida TFT.
6. Confira o console do background controller e `%APPDATA%\\ChibiOverlay\\debug\\overwolf-status.json`.

O manifesto usa o ID compartilhado League/TFT (`5426`) para `game_targeting` e `game_events`. A identificação de TFT acontece pelo `game_mode` recebido do GEP, não por um ID inventado no manifesto.

Para logs detalhados no controlador background, no DevTools execute `localStorage.setItem("DEBUG_GEP", "true")` e recarregue a extensão. Os primeiros payloads sanitizados e os relatórios de validação ficam em `%APPDATA%\\ChibiOverlay\\debug`; o reset local não toca em configurações do Companion.

## Política

Antes de liberar um recurso TFT a jogadores, é necessário contato/aprovação da Riot. Dados de augments são proibidos pela documentação GEP. Esta base não habilita dados live no overlay até haver um payload real registrado, revisão de política e validação específica da feature.
