# chibi.gg

Tracker **TFT-first** focado em uma pergunta simples:

> **o que deu errado, o que fazer agora e quais partidas provam isso?**

O chibi.gg não tenta ser apenas mais um site de estatísticas ou uma tier list. A prioridade é transformar dados de Teamfight Tactics em uma leitura rápida, acionável e verificável.

## Estado atual

A **Etapa 1** da base do produto está pronta.

Principais áreas já implementadas:

- busca pública por Riot ID;
- perfil TFT e rank;
- histórico de partidas;
- Chibi DNA e análise pessoal;
- Action Center;
- Review e evolução do jogador;
- Journal;
- review guiado de partida;
- Lobby Autopsy;
- Counterfactual usando o próprio histórico;
- Meta global baseado no Chibi Dataset;
- Comps observadas;
- Statistics;
- Leaderboard;
- Team Builder;
- Overlay;
- Overlay desktop em Python em [`overlay-python/`](overlay-python/);
- Study / compartilhamento;
- observações anônimas no Supabase;
- GitHub Pages com deploy automático.

## Filosofia de produto

A hierarquia de informação deve ser:

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

Dados avançados não devem competir com a resposta principal.

## Stack

- React
- TypeScript
- Vite
- Supabase
- Riot TFT API
- GitHub Actions
- GitHub Pages
- Python + PySide6 para o Companion desktop

## Desenvolvimento local

```bash
npm install
npm run dev
```

Validação obrigatória:

```bash
npm run typecheck
npm run build
```

## Deploy

O workflow em `.github/workflows/deploy-pages.yml` executa:

1. checkout;
2. Node 22;
3. instalação das dependências;
4. TypeScript check;
5. build;
6. geração do artifact;
7. deploy no GitHub Pages quando o push é feito em `main`.

## Backend

As integrações com Riot ficam em Supabase Edge Functions.

Nunca colocar Riot API key ou Supabase service role no frontend.

Principais funções:

- `public-tft-profile`
- `public-tft-history`
- `public-tft-match`
- `public-tft-meta`
- `public-tft-comps`
- `public-tft-stats`
- `public-tft-leaderboard`

## Chibi Dataset

O dataset é formado por observações anônimas das partidas consultadas no produto.

Ele **não representa toda a população de TFT**.

As telas devem manter visíveis, quando relevante:

- tamanho da amostra;
- confiança;
- linguagem cautelosa para amostras pequenas;
- distinção entre observação e causalidade.

## Limitação importante da Riot API

O Match API público fornece principalmente o estado final da partida.

Não tratar como conhecido:

- timing exato de roll;
- ouro em stages específicos;
- trajetória de HP;
- shops;
- scouting;
- posicionamento round a round;
- motivo causal de uma derrota.

## Continuar no Codex

O checkpoint técnico e o plano da próxima etapa estão em:

**[`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md)**

Antes de continuar o projeto no Codex, leia esse arquivo inteiro.

A primeira prioridade recomendada da Etapa 2 é:

> **Comps v2 — decisão de spot**, evoluindo a página atual sem transformá-la em uma tier list genérica.
