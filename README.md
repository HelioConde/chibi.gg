# chibi.gg

Tracker **TFT-first** criado a partir dos aprendizados do ZeroTwo.

## Objetivo
Criar uma experiência de tracker de **Teamfight Tactics** mais profunda que os trackers genéricos focados em League of Legends.

## V1
- Busca por Riot ID sem cadastro
- Perfil TFT
- Rank, LP e evolução
- Histórico de partidas
- Composições mais jogadas
- Insights pessoais
- Meta
- Base preparada para integração com Riot API

## Diferencial
O chibi.gg não deve apenas mostrar o que aconteceu. Ele deve ajudar a explicar **por que uma partida deu certo ou errado** e quais padrões o jogador pode melhorar.

## Stack
- React
- TypeScript
- Vite
- Supabase

## Rodar localmente
```bash
npm install
npm run dev
```

## Próximos passos
1. Integrar Riot ID + PUUID.
2. Buscar dados TFT pela Riot API.
3. Criar cache no Supabase.
4. Substituir dados mockados do perfil.
5. Evoluir a análise para comps, augments, itens e tendências por patch.
