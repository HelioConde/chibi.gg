# Grande mudança 1 — Chibi Overlay

## Objetivo

O Chibi Overlay deve responder em poucos segundos:

1. **Qual é o estado atual da partida?**
2. **O que merece atenção agora?**
3. **Quais são as opções razoáveis?**
4. **Qual é o próximo spike ou janela de decisão?**

O overlay não deve jogar pelo usuário, automatizar inputs ou remover decisões. O produto deve destacar contexto e oferecer múltiplos caminhos.

## Overlay v1

Quatro blocos obrigatórios:

### Estado atual
- stage
- HP
- ouro
- nível
- streak
- força relativa do board

### Faça agora
- no máximo 3 ações
- ações ordenadas por prioridade
- linguagem curta
- nenhuma ação apresentada como certeza quando o sinal for fraco

### O que está dando errado
- problema principal
- sinais secundários
- contestação quando observável
- confiança da leitura

### Próximo spike
- próxima janela de nível/rolldown/transição
- upgrades relevantes
- risco de gastar demais ou greedar demais

## Estados de UX

O protótipo deve suportar inicialmente:

- `stable`
- `weak`
- `contested`
- `spike`

O companion pode adicionar estados depois, mas a UI deve continuar priorizando apenas um estado dominante por vez.

## Arquitetura proposta

### Web
Responsável por:
- configuração do overlay
- perfil e preferências
- histórico
- análises pós-jogo
- demonstração do overlay
- sincronização opcional

### Companion desktop
Direção inicial: **Tauri**.

Responsável por:
- janela transparente always-on-top
- hotkey mostrar/ocultar
- captura local permitida
- leitura de HUD/snapshots
- armazenamento temporário da sessão
- envio opcional de snapshots permitidos ao backend

### Analyzer
Entrada:

```ts
type LiveSnapshot = {
  stage?: string;
  hp?: number;
  gold?: number;
  level?: number;
  streak?: string;
  board?: LiveUnit[];
  bench?: LiveUnit[];
  items?: LiveItem[];
  opponents?: LiveOpponentSnapshot[];
};
```

Saída:

```ts
type OverlayDecision = {
  state: "stable" | "weak" | "contested" | "spike";
  confidence: "low" | "medium" | "high";
  boardScore?: number;
  actions: string[];
  mainProblem?: string;
  secondarySignals: string[];
  nextSpike?: {
    label: string;
    detail: string;
  };
};
```

A camada visual não deve conter lógica de decisão. Ela apenas renderiza `OverlayDecision`.

## Board / posições

A API pública de histórico usada pelo site não fornece as posições históricas das unidades no tabuleiro.

Portanto:

- o site não deve inventar posições;
- o componente hexagonal pode existir como UI;
- posições reais só devem ser mostradas quando o companion tiver um snapshot local que sustente essas coordenadas;
- caso contrário, mostrar board sem posição ou marcar explicitamente como estimado.

## Integração com o Chibi atual

O overlay deve reaproveitar:

- Action Center
- Ask Chibi
- Chibi Memory
- Review Queue
- personal meta
- comps
- journal

Exemplo:

```
durante a partida
      ↓
overlay detecta sinal
      ↓
usuário marca snapshot importante
      ↓
fim da partida
      ↓
Lobby Autopsy + Review Queue
      ↓
Chibi Memory compara evolução
```

## Regras de produto

1. Máximo de 3 ações no painel “Faça agora”.
2. Uma única prioridade principal.
3. Confiança explícita em leituras incertas.
4. Múltiplas escolhas quando existirem rotas válidas.
5. Nunca executar inputs pelo jogador.
6. Nunca afirmar causalidade que os dados não sustentem.
7. Modo compacto deve caber sem cobrir parte relevante do tabuleiro.
8. Nenhum anúncio dentro do overlay.
9. Mudanças relevantes do companion devem ser revisadas contra as políticas vigentes da Riot antes de distribuição pública.

## Roadmap

### GM1.1 — atual
- página Overlay no web
- demo interativa
- estados stable/weak/contested/spike
- modo compacto
- board hexagonal demonstrativo
- arquitetura documentada

### GM1.2
- workspace do companion
- janela transparente
- always-on-top
- hotkey
- seletor de monitor
- modo demo local sem leitura do jogo

### GM1.3
- captura local
- detector de HUD
- stage / HP / gold / level
- confiança por campo

### GM1.4
- leitura do board por snapshot
- coordenadas reais
- itens/unidades
- scouting suportado

### GM1.5
- personalização pelo perfil Chibi
- Journal durante partida
- snapshots importantes
- integração completa com Review Queue e Memory
