# Grande mudança 1 — Chibi Overlay

## Objetivo

O Chibi Companion deve transformar momentos marcados da sessão em aprendizado **pós-jogo**:

1. **Qual era o contexto deste snapshot?**
2. **Qual padrão vale investigar?**
3. **Com quais partidas do próprio jogador ele deve ser comparado?**
4. **Qual pergunta ou experimento levar para a próxima sessão?**

A versão pública não deve prescrever decisões usando o estado atual da partida, rastrear adversários ou automatizar inputs. O valor principal é captura de contexto e revisão posterior.

## Overlay v1

Quatro blocos obrigatórios:

### Estado atual
- stage
- HP
- ouro
- nível
- streak
- força relativa do board

### O que revisar
- no máximo 3 perguntas
- perguntas ordenadas por relevância
- linguagem curta
- nenhuma causalidade apresentada como certeza quando o sinal for fraco

### Padrão a investigar
- problema ou contraste principal
- sinais secundários
- comparação com o próprio histórico
- confiança da leitura

### Próximo experimento
- uma hipótese observável para a próxima sessão
- métrica simples para validar
- comparação pós-jogo

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

### GM1.2 — em andamento
- companion Tauri separado em `/companion`
- janela transparente e sem moldura
- always-on-top
- fora da taskbar
- hotkey `Ctrl+Shift+Space` para mostrar/ocultar
- hotkey `Ctrl+Shift+L` para click-through
- modo compacto/expandido
- presets Compacto / Coach / Completo
- seleção de monitor e canto do overlay
- posição e preset persistidos localmente
- quatro estados locais de demonstração
- contrato `LiveSnapshot → OverlayDecision` separado da UI
- marcador local de snapshots para futura integração com Journal/Review
- GitHub Actions próprio para frontend + Rust
- workflow manual para gerar MSI/NSIS no Windows
- próximo: calibração de HUD e provider de captura local

### GM1.3
- captura local
- detector de HUD
- stage / HP / gold / level
- confiança por campo

### GM1.4
- leitura do board por snapshot
- coordenadas reais
- itens/unidades

### GM1.5
- personalização pelo perfil Chibi
- Journal durante partida
- snapshots importantes
- integração completa com Review Queue e Memory
