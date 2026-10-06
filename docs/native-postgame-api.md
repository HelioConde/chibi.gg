# Pós-partida do Chibi Native Companion

O Companion chama exclusivamente as Edge Functions públicas já usadas pelo site. A base padrão é `https://bieihhaobdztjyoweewa.supabase.co/functions/v1` e pode ser substituída por `CHIBI_API_BASE` em desenvolvimento.

## Chamadas

- `POST /public-tft-history` recebe `gameName`, `tagLine`, `platform`, `start` e `count`. A resposta fornece a lista pessoal normalizada, usada para encontrar uma partida nova.
- `POST /public-tft-match` recebe `matchId`. Ela confirma a existência e fornece o detalhe global, mas não é usada para identificar o jogador, pois participantes globais não carregam PUUID.
- `POST /public-tft-profile` está disponível para uma integração futura de perfil; o Milestone 3 não a usa para decidir resultado.

O cliente desktop nunca envia credenciais Riot, token do LCU, PUUID, `RIOT_API_KEY`, service role ou chaves privadas. O User-Agent é `ChibiNativeCompanion/0.1`.

## Correlação e tentativas

Antes da partida, o app memoriza os IDs recentes. Após `POST_GAME`, procura no histórico um ID ausente, com a queue TFT esperada e horário compatível com a sessão. Se o app iniciou no meio da partida, a comparação temporal ainda é exigida; ele nunca escolhe simplesmente o primeiro resultado da lista.

As tentativas usam 5, 10, 15, 30, 30 e 30 segundos. Respostas 429 aguardam a próxima tentativa; falhas transitórias 404, 502 e 503 também não encerram a sessão. Ao terminar, é salvo um relatório sanitizado em `%APPDATA%\ChibiNative\debug\postgame-report.json` sem PUUID nem tokens.
