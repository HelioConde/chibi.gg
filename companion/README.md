# Chibi Companion — GM1.2

Primeira versão desktop do **Chibi Overlay**.

## Estado atual

Esta etapa é propositalmente um **modo demo local**. Ela ainda não lê dados do TFT.

Já implementado:

- janela Tauri transparente;
- sem moldura;
- always-on-top;
- fora da taskbar;
- overlay compacto/expandido;
- quatro estados de demonstração;
- click-through;
- hotkeys globais.

## Hotkeys

| Hotkey | Ação |
| --- | --- |
| `Ctrl + Shift + Space` | Mostrar / ocultar overlay |
| `Ctrl + Shift + L` | Ativar / desativar click-through |

O botão **Liberar mouse** ativa click-through depois de 1 segundo. Depois disso, use `Ctrl + Shift + L` para voltar a interagir com a janela.

## Rodar no Windows

Pré-requisitos do Tauri:

- Node.js;
- Rust stable;
- Microsoft C++ Build Tools;
- WebView2.

Na pasta do repositório:

```powershell
cd companion
npm install
npm run desktop
```

Para validar apenas a interface web do companion:

```powershell
npm run dev
```

Para gerar instalador quando a etapa estiver pronta:

```powershell
npm run desktop:build
```

O Tauri está configurado para gerar instaladores Windows MSI/NSIS.

## Limites desta etapa

Ainda não existe:

- leitura de HUD;
- OCR;
- captura de board;
- reconhecimento de unidades;
- leitura de posições;
- scouting;
- conexão automática com o jogo.

Essas partes entram somente depois que a janela, o tamanho, a legibilidade e os atalhos forem validados em uma partida real.

## Filosofia

O companion deve **assistir decisão**, nunca executar inputs.

A interface recebe um estado de análise e apresenta:

1. estado atual;
2. até três ações;
3. principal problema;
4. próximo spike.

A lógica de análise e a camada visual permanecem separadas.
