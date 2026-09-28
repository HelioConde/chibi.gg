# Chibi Session Companion — Python Overlay V3

Primeira versão desktop em Python do Companion do **chibi.gg**.

O objetivo desta base é acompanhar a intenção antes da partida, o estado confiável durante a sessão e a revisão depois dela — sem inventar um HUD de TFT.

## Sessões, foco e fontes

Ao entrar em `MATCHMAKING`, o Companion cria uma `ChibiSession` local com Riot ID, PUUID, fila, tipo ranqueado, participantes e foco selecionado. A sessão acompanha ready check, início de jogo, pós-partida e consulta de resultado em intervalos graduais. Registros ficam em `%APPDATA%\ChibiOverlay\sessions\` e são retidos nas últimas 30 sessões.

No lobby, selecione um foco: Economia, Posicionamento, Flexibilidade, Itens, Tempo de decisão ou Personalizado. O foco aparece no game mode compacto durante a partida.

As fontes continuam separadas:

- `RIOT LIVE`: estado, Riot ID, queue, modo, ranked e participantes fornecidos pelo cliente local;
- `REVIEW SNAPSHOT`: contexto de revisão somente em lobby/pós-partida;
- `CHIBI PROFILE`: reservado para a futura API Chibi.

Não existe fonte local verificada para stage, HP, gold, level, streak, board, bench, shop, itens, traits, augments, oponente ou resultado de combate. Nenhum desses dados é mostrado em estados live.

## Presets

- `REVIEW`: lobby e pós-partida;
- `SESSION`: fila, preparação e partida;
- `MINIMAL`: ready check, aceite e recusa.

Com `auto_compact_in_game` ativo, o conteúdo e tamanho mudam sem alterar a posição X/Y escolhida pelo jogador.

## O que já funciona

- janela sem borda e sempre no topo;
- fundo translúcido;
- arrastar a janela pela tela;
- posição persistida;
- modo compacto / expandido;
- opacidade ajustável;
- lock de posição;
- click-through no Windows;
- hotkeys globais quando o pacote `keyboard` está disponível;
- leitura automática de um `snapshot.json` local;
- atualização do conteúdo quando o JSON muda;
- board de 28 slots;
- papéis visuais de tank / carry / utility;
- até 3 perguntas de revisão;
- configuração salva em `%APPDATA%\ChibiOverlay\settings.json`.
- detecção local, somente leitura, do ciclo Riot: lobby, fila, confirmação, aceite/recusa, seleção e partida;
- reconexão automática do cliente Riot e status visual compacto;
- menu na bandeja do sistema quando disponível.

## Instalação rápida no Windows

Requer **Python 3.11+**.

Abra esta pasta e execute `run.bat`.

Na primeira execução o script cria `.venv`, instala as dependências e abre o overlay.

Instalação manual:

    py -3 -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt
    python app.py

Para depurar transições do cliente:

    python app.py --debug

Para investigação segura do LCU, sem valores sensíveis:

    python app.py --debug-lcu
    python app.py --debug-lcu-schema

O primeiro salva uma cópia sanitizada da sessão. O segundo grava apenas paths, tipos, tamanhos de listas e diffs entre capturas em `%APPDATA%\ChibiOverlay\debug\`. Esses comandos consultam somente `/lol-gameflow/v1/session`; não fazem varredura de portas ou rotas desconhecidas.

Para desenvolver sem o Riot Client:

    python app.py --demo

No modo demo, `Ctrl + Shift + D` avança o fluxo simulado.

## Hotkeys

| Atalho | Ação |
| --- | --- |
| `Ctrl + Shift + Space` | mostrar / ocultar |
| `Ctrl + Shift + C` | compacto / expandido |
| `Ctrl + Shift + L` | ativar / desativar click-through |
| `Ctrl + Shift + ↑` | aumentar opacidade |
| `Ctrl + Shift + ↓` | reduzir opacidade |

O click-through deve ser alternado pela hotkey porque, quando ativo, o mouse passa através da janela.

## Snapshot local

Por padrão o app usa `%APPDATA%\ChibiOverlay\snapshot.json`.

Na execução normal ele cria um snapshot de revisão vazio. Valores de demonstração existem apenas com `--demo`.

Também é possível iniciar apontando para outro arquivo:

    python app.py --snapshot snapshot.example.json

O overlay verifica alterações no JSON a cada 1 segundo. Isso permite que uma futura integração do Chibi atualize o arquivo sem reiniciar o app.

Slots do board vão de `0` a `27`.

Papéis aceitos visualmente:

- `tank`
- `carry`
- `utility`

## Limites intencionais do v1

Esta versão **não**:

- captura a tela do TFT;
- lê shop automaticamente;
- rastreia adversários;
- envia inputs para o jogo;
- prescreve decisões em tempo real;
- tenta inferir informações que a Riot API não fornece.

O Companion apenas lê a LCU local: ele nunca aceita partidas, envia requests de aceite ou simula input no cliente Riot. O gameflow ao vivo e o `snapshot.json` de revisão são fontes independentes.

A integração futura deve preferir dados do próprio Chibi e snapshots explicitamente registrados, mantendo o Companion útil para contexto e revisão.

## API Chibi e build

`ChibiApiClient` separa a UI de uma futura API do chibi.gg. A implementação atual é local/mock e não inventa URLs, endpoints nem resultados. Quando houver contrato HTTP real, ela poderá fornecer perfil e resultado de sessão sem alterar o GameflowMonitor.

Para gerar o executável Windows:

    python -m PyInstaller --noconfirm --clean --noconsole --name ChibiCompanion app.py

O workflow `build-python-overlay.yml` valida testes e envia o artifact `ChibiCompanion-Windows`; não há release automática.
