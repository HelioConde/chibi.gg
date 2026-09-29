# Codex Handoff — chibi.gg

Checkpoint: 2026-09-29  
Branch principal: `main`

A **Etapa 1** está estável, as três prioridades da **Etapa 2** foram concluídas e o bloco de **Riot review readiness** também está pronto. A partir daqui o projeto pode continuar sem reconstruir contexto do zero.

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

## 2. Estado atual

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
- deploy automático no GitHub Pages;
- páginas públicas de Como funciona, Privacidade e Termos;
- reviewer entry point em `/review.html`;
- demo sintética em `/?demo=review`, independente de Riot dev key;
- rascunho preservado da Production Application;
- plano técnico de Riot Sign On para depois da aprovação.

A página **Comps v2 / decisão de spot** já está implementada. Não recrie do zero.

Ela já possui:

- endpoint `public-tft-comps`;
- agrupamento atual por traits centrais observadas;
- amostra, média, Top 4, win rate e volatilidade;
- unidades recorrentes e itens por unidade;
- confiança da amostra;
- familiaridade pessoal separada de sinais globais;
- lentes de Familiaridade / Confiança / Estabilidade / Popularidade;
- filtro de confiança da amostra;
- camada **Quando considerar** baseada em traits e unidades recorrentes observáveis;
- integração com histórico relacionado, Builder e Study Shelf;
- guardrails para não tratar board final como receita causal.

Importante: **estatísticas globais/recomendações de augments não são publicadas**. Augments podem aparecer apenas no histórico pós-jogo do próprio jogador, conforme os guardrails atuais do produto.

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

## 7. Etapa 2 — progresso e próxima prioridade

### Prioridade 1 — Comps v2: decisão de spot ✅

Concluída em 29/09/2026.

Entregue:

1. camada **Quando considerar**;
2. traits/unidades recorrentes que tornam a rota plausível;
3. familiaridade pessoal separada do desempenho global;
4. nenhuma mistura de “boa para o seu histórico” com “forte na amostra global”;
5. lentes/filtros simples de confiança, estabilidade e popularidade;
6. integração com Builder preservando as unidades;
7. guardrail explícito de snapshot final / sem shops, timing de roll ou scouting.

A página deve continuar tratando familiaridade como **recorrência pessoal**, não como tier.

### Prioridade 2 — Comps v2: assinatura melhor ✅ primeira iteração

Medição realizada no Set 18 / Ranqueada antes de alterar o algoritmo:

- 176 participantes observados;
- assinatura rígida de 2 traits: 104 grupos, mediana 1 jogo, apenas 15 grupos com 3+ jogos;
- adicionar um anchor unit diretamente fragmentou ainda mais a base;
- assinatura adaptativa por par de traits com fallback para trait principal: 47 grupos, mediana 3 jogos, 35 grupos com 3+ jogos;
- nos grupos com 3+ jogos, o método adaptativo por traits teve melhor presença média compartilhada de unidades do que o split por anchor unit testado.

Decisão implementada em `public-tft-comps`:

- modo `adaptive-traits-v2`;
- pares de traits só criam identidade própria quando atingem `max(3,minGames)`;
- pares raros recuam para a trait principal;
- a API expõe `signatureMode` e `signatureThreshold`;
- o frontend explica que o agrupamento é adaptativo.

A ideia de assinatura híbrida com core unit **não foi descartada**, mas foi adiada porque o teste atual reduziu a coerência média e fragmentou mais a amostra. Reavaliar quando o Chibi Dataset tiver significativamente mais partidas.

### Prioridade 3 — Ask Chibi com evidência ✅

Concluída em 29/09/2026.

Entregue:

- cada resposta mostra base/amostra usada;
- confiança continua visível;
- respostas apontam partidas relacionadas quando existem;
- a UI mostra a origem do contexto e o limite do dado;
- respostas baseadas em Riot deixam explícito que são snapshot final, sem shops, timing de roll, scouting ou HP por rodada;
- Journal / Lessons / Session são identificados como contexto local complementar;
- perguntas sobre Top 4, força de linha, estilo, Bottom 2 e causa principal foram suavizadas quando a amostra é pequena;
- perguntas genéricas sobre “por que” e “o que fazer agora” não recebem diagnóstico forte com menos de 8 partidas.

A regra permanece: se a evidência não sustenta a conclusão, o Ask Chibi deve dizer que ainda não sabe.

## 7.1 Riot review readiness ✅

Concluído em 29/09/2026.

Entregue:

- página pública **Como o Chibi funciona**;
- Privacy Policy;
- Terms;
- boilerplate legal da Riot visível;
- URLs estáveis `/about.html`, `/privacy.html` e `/terms.html`;
- reviewer entry point `/review.html`;
- demo sintética `/?demo=review` com 12 partidas fictícias e fluxo navegável sem Riot API;
- Companion público explicitamente marcado como demo/review-first, sem pseudo score live;
- `public/riot.txt` preservado para verificação;
- `docs/RIOT_REVIEW_CHECKLIST.md`;
- `docs/RIOT_APPLICATION_DRAFT.md`;
- `docs/RSO_PLAN.md`;
- metadata pública, sitemap e robots alinhados ao produto.

A demo sintética nunca deve ser apresentada como dados reais. Ela existe apenas para permitir que Riot/Overwolf avaliem UX e fluxo quando uma chave temporária estiver indisponível.

### Próximo gate — Production Application

Não expandir recursos live antes de resolver o gate externo.

Próximos passos:

1. abrir o formulário de **Production API Key / Register Product**;
2. preencher usando `docs/RIOT_APPLICATION_DRAFT.md`;
3. preservar exatamente a descrição efetivamente enviada;
4. preservar screenshots da submissão/status;
5. aguardar/reagir ao review da Riot;
6. depois da aprovação, implementar RSO seguindo `docs/RSO_PLAN.md` e as instruções provisionadas pela Riot;
7. enviar ao Overwolf screenshot da aprovação da Riot incluindo a descrição submetida.

Não inventar client ID, secret, callback URL ou scopes de RSO antes do provisionamento da Riot.

### Overwolf

O PR #16 (`feat: add public Overwolf desktop shell`) permanece aberto. **Não fazer merge desse PR sem pedido explícito do usuário.**

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

Comece pelo gate externo descrito no handoff:
Riot Production Application.

Não recrie review readiness: ela já está pronta. Se o formulário da Riot ainda não estiver disponível no contexto, preserve o build atual e faça apenas correções que reduzam risco de review; não expanda features live.

Faça mudanças pequenas e verificáveis. Depois de cada bloco relevante, rode typecheck e build.
```

## 10. Checkpoint

A Etapa 1 e a Comps v2 / Prioridade 1 devem permanecer utilizáveis mesmo se a próxima mudança for interrompida.

Próximo checkpoint recomendado: registrar a Production Application exatamente como enviada e, depois, trabalhar apenas nas pendências apontadas pela Riot. Até esse gate avançar, preserve o escopo review-first, o reviewer demo e o build verde.
