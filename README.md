# chibi.gg — entenda suas partidas de TFT

**Análises de Teamfight Tactics orientadas à melhoria: o que aconteceu, por quê e o que testar na próxima partida.**

![TFT](https://img.shields.io/badge/TFT-análise%20de%20partidas-64748b) ![React](https://img.shields.io/badge/React-frontend-149ECA?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

## Comece pelo essencial

- Pesquise um **Riot ID** para analisar perfil e histórico disponíveis.
- Use o **Action Center**, o review guiado e as comparações para identificar decisões.
- Explore composições, estatísticas e ferramentas de estudo conforme sua necessidade.
- Para desenvolver localmente, execute `npm install`, `npm run dev`, `npm run typecheck` e `npm run build`.

> **Limite importante:** análises dependem dos dados permitidos pela Riot API. Este é um projeto independente, sem afiliação com Riot Games.

A documentação abaixo detalha estado de implementação, dataset, infraestrutura e validações.

---

Tracker **TFT-first** focado em uma pergunta simples:

> **o que deu errado, o que fazer agora e quais partidas provam isso?**

O chibi.gg não tenta ser apenas mais um site de estatísticas ou uma tier list. A prioridade é transformar dados de Teamfight Tactics em uma leitura rápida, acionável e verificável.

## Estado atual

A **Etapa 1** está estável, as três prioridades da **Etapa 2** estão concluídas e o produto está preparado para a revisão da Riot.

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
- Comps v2 com decisão de spot, familiaridade pessoal separada do sinal global e filtros de confiança/estabilidade/popularidade;
- Statistics;
- Leaderboard;
- Team Builder;
- Overlay;
- Overlay desktop em Python em [`overlay-python/`](overlay-python/);
- Study / compartilhamento;
- observações anônimas no Supabase;
- GitHub Pages com deploy automático;
- reviewer entry point em `/review.html`;
- demo sintética de revisão em `/?demo=review`;
- páginas estáveis de Como funciona, Privacidade e Termos;
- plano documentado de Riot Sign On para pós-aprovação.

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

Checklist público/técnico para a revisão da Riot:

**[`docs/RIOT_REVIEW_CHECKLIST.md`](docs/RIOT_REVIEW_CHECKLIST.md)**

Rascunho preservado para a Production Application:

**[`docs/RIOT_APPLICATION_DRAFT.md`](docs/RIOT_APPLICATION_DRAFT.md)**

Plano técnico para a transição para Riot Sign On após aprovação:

**[`docs/RSO_PLAN.md`](docs/RSO_PLAN.md)**

Antes de continuar o projeto no Codex, leia esse arquivo inteiro.

As três prioridades atuais da Etapa 2 estão concluídas:

- Comps v2 — decisão de spot;
- assinatura adaptativa de comps (`adaptive-traits-v2`);
- Ask Chibi evidence-first.

O próximo gate é a **Riot Production Application**. A review readiness já está implementada.

Links públicos úteis para o reviewer:

- `/review.html` — ponto de entrada da revisão;
- `/?demo=review` — demo sintética, sem depender da Riot API;
- `/about.html` — como funciona e limites;
- `/privacy.html` — privacidade;
- `/terms.html` — termos;
- `/riot.txt` — arquivo de verificação.

Depois da aprovação, o fluxo pessoal deve avançar para Riot Sign On conforme `docs/RSO_PLAN.md` e as instruções provisionadas pela Riot.
