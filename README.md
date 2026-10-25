<div align="center">

<h1>🎯 chibi.gg</h1>

<strong>Seu coach de decisões para Teamfight Tactics — baseado no que suas partidas mostram</strong>

<p>Entenda o que aconteceu, encontre padrões e escolha uma melhoria para tentar no próximo jogo.</p>

<a href="https://github.com/HelioConde/chibi.gg"><img alt="TFT Analysis" src="https://img.shields.io/badge/TFT-AN%C3%81LISE%20PESSOAL-7c3aed?style=for-the-badge"></a>

<p><a href="#o-que-a-plataforma-oferece"><strong>Recursos</strong></a> · <a href="#desenvolvimento"><strong>Instalação</strong></a> · <a href="#fontes-e-limites"><strong>Limites de dados</strong></a></p>

</div>

---

## O problema que queremos resolver

Trackers tradicionais entregam muitos dados. O **chibi.gg** organiza as estatísticas de **Teamfight Tactics** em perguntas práticas: *o que deu errado, o que eu deveria revisar e quais partidas sustentam essa leitura?*

O produto é uma aplicação independente, com áreas de análise já implementadas e validações de plataforma ainda necessárias. O objetivo não é prever a próxima partida ou substituir o julgamento do jogador.

## A jornada de análise

```text
     AGORA
       ↓
 O QUE ACONTECEU
       ↓
 O QUE REVISAR
       ↓
 DADOS / PROVAS
       ↓
 DETALHES
```

## O que a plataforma oferece

| Área | O que faz |
| --- | --- |
| **Perfil e histórico** | Busca por Riot ID, rank e partidas recentes |
| **Chibi DNA** | Leitura de estilo e padrões do jogador |
| **Action Center** | Sugestões de revisão orientadas pela própria amostra |
| **Review** | Revisão guiada de partidas e decisões |
| **Comps e estatísticas** | Composições, filtros e análises com contexto |
| **Journal** | Registros pessoais e acompanhamento |
| **Board / Team Builder** | Ferramentas para explorar alternativas |
| **Companion** | Experimentos de overlay e aplicativo desktop em Python |

O código também contém experiências como *Lobby Autopsy*, comparações contrafactuais e uma base de referência chamada **Chibi Dataset**.

## Desenvolvimento

**Stack:** React, TypeScript, Vite, Supabase e integrações Riot. Há um companion Python/PySide6 em `overlay-python/`.

```bash
git clone https://github.com/HelioConde/chibi.gg.git
cd chibi.gg
npm install
npm run dev
```

Para validar o frontend:

```bash
npm run typecheck
npm run build
```

O build inclui rotinas de geração/otimização dos recursos e partes de QA específicas do repositório.

## Fontes e limites

- Consultas dependem da disponibilidade e das permissões da Riot API.
- A análise de uma amostra pessoal **não prova** que uma unidade, item ou augment causou um resultado.
- Metadados globais e recomendações precisam ter suas fontes e períodos identificados.
- O produto não é oficialmente afiliado ou endossado pela Riot Games.
- Aprovação, lançamento amplo e serviços sociais dependem de requisitos externos que não são resolvidos apenas pelo frontend.

## Guias e histórico

[Documentação técnica anterior](docs/README_HISTORY_2026-10-25.md) · [Repositório](https://github.com/HelioConde/chibi.gg)

---

<div align="center"><strong>Desenvolvido por <a href="https://github.com/HelioConde">Hélio Conde</a></strong></div>
