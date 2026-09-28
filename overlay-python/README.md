# Chibi Companion — Python Overlay v1

Primeira versão desktop em Python do Companion do **chibi.gg**.

O objetivo desta base é ter uma janela leve, sempre no topo e independente do navegador, preparada para receber snapshots locais do Chibi e servir como ferramenta de **captura/revisão**.

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

Na primeira execução ele cria automaticamente um snapshot de demonstração.

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

## Próximas etapas

1. conectar perfil/sessão do site ao snapshot local;
2. substituir letras do board por assets reais do Data Dragon;
3. adicionar tray icon;
4. criar presets Compacto / Coach / Completo;
5. empacotar `.exe` com PyInstaller;
6. adicionar atualização automática do aplicativo.
