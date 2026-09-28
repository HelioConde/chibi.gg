# Codex Handoff — chibi.gg

Checkpoint: 2026-09-28  
Branch principal: `main`

Este arquivo marca o fim da **Etapa 1**. A partir daqui o projeto pode ser continuado no Codex sem precisar reconstruir contexto do zero.

## 1. Objetivo do produto

O chibi.gg é um tracker **TFT-first**.

A regra central de produto é:

> **Resposta primeiro. Evidência depois.**

O jogador deve conseguir olhar a tela e entender rapidamente:

1. o que parece ter dado errado;
2. o que vale revisar/fazer agora;
3. quais partidas sustentam a leitura;
4. como medir se melhorou.

Evite transformar o produto em uma coleção de gráficos ou uma tier list genérica.

## 2. Estado da Etapa 1

A fundação funcional já existe:

- busca pública por Riot ID;
- perfil TFT e rank;
- histórico real de partidas via Riot;
- análise pessoal e Chibi DNA;
- Action Center / foco acionável;
- Review e evolução do jogador;
- Journal e contexto local do usuário;
- review de partida;
- Lobby Autopsy;
- Counterfactual com histórico do próprio jogador;
- Meta global usando Chibi Dataset;
- Comps usando Chibi Dataset;
- Statistics;
- Leaderboard;
- Team Builder;
- Overlay;
- Study / compartilhamento de análise;
- cache/observações anônimas no Supabase;
- deploy automático no GitHub Pages.

A página **Comps v1** já está implementada. Não recrie do zero.

Ela já possui:

- endpoint `public-tft-comps`;
- agrupamento por traits centrais observadas;
- amostra, média, Top 4, win rate e volatilidade;
- unidades recorrentes;
- itens por unidade;
- augments recorrentes;
- confiança da amostra;
- compatibilidade com o histórico do jogador;
- integração com Builder e Study Shelf;
- guardrails para não tratar board final como receita causal.

## 3. Stack

Frontend:

- React
- TypeScript
- Vite
- Supabase JS

Backend:

- Supabase Edge Functions
- PostgreSQL / REST
- Riot TFT API

Deploy:

- GitHub Actions
- GitHub Pages

## 4. Comandos obrigatórios antes de cada checkpoint

```bash
npm install
npm run typecheck
npm run build
```

Para desenvolvimento:

```bash
npm run dev
```

O workflow de Pages também executa typecheck + build.

## 5. Arquivos principais

### Entrada / navegação

- `src/App.tsx`
- `src/styles.css`
- `src/api/tft.ts`
- `src/tftStatic.ts`

### Perfil e coach

- `src/components/ChibiActionCenter.tsx`
- `src/components/ChibiReview.tsx`
- `src/components/ChibiCoachMode.tsx`
- `src/components/ChibiSessionMode.tsx`
- `src/components/PlayerEvolution.tsx`
- `src/components/ReviewQueue.tsx`
- `src/analysis/actionPlan.ts`
- `src/analysis/chibiInsights.ts`
- `src/analysis/chibiProduct.ts`

### Review de partida

- `src/components/LobbyAutopsy.tsx`
- `src/analysis/lobbyAutopsy.ts`
- `src/components/MatchStory.tsx`
- `src/components/MatchScorecard.tsx`
- `src/components/MatchBoardMap.tsx`
- `src/components/BoardCounterfactual.tsx`
- `src/components/MatchJournal.tsx`

### Produto global

- `src/components/GlobalMetaPage.tsx`
- `src/components/CompsPage.tsx`
- `src/components/StatisticsPage.tsx`
- `src/components/LeaderboardPage.tsx`
- `src/components/TeamBuilderPage.tsx`
- `src/components/OverlayPage.tsx`

### Supabase / dados

- `supabase/functions/public-tft-profile/index.ts`
- `supabase/functions/public-tft-history/index.ts`
- `supabase/functions/public-tft-match/index.ts`
- `supabase/functions/public-tft-meta/index.ts`
- `supabase/functions/public-tft-comps/index.ts`
- `supabase/functions/public-tft-stats/index.ts`
- `supabase/functions/public-tft-leaderboard/index.ts`
- `supabase/functions/_shared/observations.ts`
- `supabase/migrations/20260927143000_tft_global_observations.sql`
- `supabase/config.toml`

## 6. Regras que não podem ser quebradas

### Riot API

A API pública de partidas do TFT fornece principalmente o **estado final** da partida.

Não afirmar como fato:

- ouro exato em Stage 3;
- momento exato do roll;
- momento exato de level up;
- trajetória de HP por round;
- posicionamento em cada round;
- scouting realizado;
- decisão exata de loja;
- motivo causal de uma derrota.

Pode dizer:

- “o snapshot final mostra...”;
- “há associação...”;
- “vale investigar...”;
- “um board semelhante terminou melhor...”;
- “não há evidência suficiente...”.

### Segurança

- **Nunca** colocar Riot API key no frontend.
- Riot key fica em Supabase Edge Function secret.
- Service role também nunca vai ao browser.

### Chibi Dataset

O dataset representa somente partidas observadas pelo Chibi.

Sempre preservar:

- tamanho da amostra;
- confiança;
- wording de sinal inicial quando a amostra for pequena;
- disclaimer de que não é toda a população do TFT;
- nenhuma alegação de tier oficial.

### UX

A ordem mental deve ser:

```text
AGORA
↓
O QUE DEU ERRADO
↓
O QUE FAZER
↓
PROVA
↓
DETALHES
```

Não colocar detalhes avançados acima da conclusão principal.

## 7. Etapa 2 recomendada para o Codex

### Prioridade 1 — Comps v2: decisão de spot

Evoluir `CompsPage.tsx` sem transformar a página em tier list.

Objetivo:

> responder “quando esta comp faz sentido para mim?” em vez de apenas “qual comp tem melhor média?”.

Implementar de forma incremental:

1. criar uma camada **Quando considerar**;
2. mostrar peças/traits que tornam a rota plausível;
3. mostrar familiaridade pessoal separada de desempenho global;
4. separar “boa para o seu histórico” de “forte na amostra global”;
5. adicionar filtros simples por confiança / estabilidade / popularidade;
6. permitir abrir a comp no Builder preservando as unidades;
7. manter guardrail: dados são de boards finais e não conhecem toda a sequência de shops.

Não inventar recomendação de early game se os dados atuais não sustentarem isso.

### Prioridade 2 — Comps v2: assinatura melhor

Hoje `public-tft-comps` agrupa principalmente pelas duas traits centrais.

Melhoria futura:

- estudar assinatura híbrida de traits + core units;
- evitar juntar boards muito diferentes que compartilham apenas duas traits;
- não fragmentar demais a amostra;
- preservar compatibilidade com dados históricos existentes.

Antes de trocar o algoritmo, medir quantas comps/grupos resultam na base atual.

### Prioridade 3 — Ask Chibi com evidência

O componente já existe no projeto.

Qualquer resposta futura deve apontar para:

- partidas usadas;
- tamanho da amostra;
- confiança;
- limite do dado.

Não deixar o chatbot responder TFT genericamente quando a pergunta for sobre o histórico do jogador.

## 8. Critério de conclusão de uma mudança

Uma mudança só está pronta quando:

- TypeScript passa;
- build passa;
- não há segredo no frontend;
- mobile não quebra;
- o usuário entende a conclusão antes dos detalhes;
- análises mostram amostra/confiança quando relevante;
- afirmações não excedem o que a Riot API realmente fornece.

## 9. Prompt inicial para continuar no Codex

Cole isto no Codex:

```text
Continue o projeto chibi.gg a partir do estado atual do repositório.

Antes de editar:
1. Leia docs/CODEX_HANDOFF.md inteiro.
2. Rode npm install, npm run typecheck e npm run build.
3. Não recrie páginas ou endpoints que já existem.
4. Preserve a regra “resposta primeiro, evidência depois”.
5. Não exponha Riot API key nem Supabase service role no frontend.
6. Não faça afirmações causais que a Riot Match API não suporta.

Comece pela Etapa 2 / Prioridade 1 descrita no handoff:
Comps v2 — decisão de spot.

Faça mudanças pequenas e verificáveis. Depois de cada bloco relevante, rode typecheck e build.
```

## 10. Checkpoint

A Etapa 1 deve permanecer utilizável mesmo se a Etapa 2 for interrompida no meio.

Se uma mudança grande exigir refatoração, faça de forma incremental e mantenha o build verde entre commits.
