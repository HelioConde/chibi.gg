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

O `manifest.json` usa o ID compartilhado League/TFT (`5426`), conforme a documentação Overwolf de game events; valide o manifesto e o app desempacotado na ferramenta oficial antes de distribuição. O ícone de pacote deve ser fornecido em `assets/icon.png` para carregamento no cliente Overwolf.

## Política

Antes de liberar um recurso TFT a jogadores, é necessário contato/aprovação da Riot. Dados de augments são proibidos pela documentação GEP. Esta base não habilita dados live no overlay até haver um payload real registrado, revisão de política e validação específica da feature.
