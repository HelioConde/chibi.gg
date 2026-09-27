import { FormEvent, useMemo, useState } from "react";

type Match = {
  placement: number;
  comp: string;
  traits: string[];
  avg: string;
  lp: string;
};

const matches: Match[] = [
  { placement: 1, comp: "Fast 8 AP", traits: ["Arcanist", "Bastion"], avg: "4.2", lp: "+42 LP" },
  { placement: 3, comp: "Flex AD", traits: ["Duelist", "Strategist"], avg: "4.7", lp: "+18 LP" },
  { placement: 7, comp: "Reroll", traits: ["Bruiser", "Invoker"], avg: "5.9", lp: "-36 LP" },
  { placement: 2, comp: "Fast 9", traits: ["Legendary", "Bastion"], avg: "3.8", lp: "+31 LP" },
];

function App() {
  const [riotId, setRiotId] = useState("");
  const [searched, setSearched] = useState(false);

  const playerName = useMemo(() => riotId.trim() || "Conde#BR1", [riotId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!riotId.trim()) return;
    setSearched(true);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setSearched(false)}>
          <span className="brand-mark">c</span>
          <span>chibi<span>.gg</span></span>
        </a>
        <nav>
          <a href="#meta">Meta</a>
          <a href="#comps">Comps</a>
          <a href="#leaderboard">Leaderboard</a>
        </nav>
        <button className="ghost-button">Entrar</button>
      </header>

      {!searched ? (
        <main className="landing">
          <section className="hero">
            <div className="eyebrow">TFT FIRST. DATA THAT HELPS YOU CLIMB.</div>
            <h1>Entenda suas partidas.<br /><span>Suba com intenção.</span></h1>
            <p>
              Busque qualquer Riot ID e veja rank, histórico, comps, padrões e insights
              pensados especificamente para Teamfight Tactics.
            </p>
            <form className="search-box" onSubmit={handleSubmit}>
              <select aria-label="Região" defaultValue="BR">
                <option>BR</option>
                <option>NA</option>
                <option>EUW</option>
              </select>
              <input
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                placeholder="Nome#TAG"
                aria-label="Riot ID"
              />
              <button type="submit">Buscar jogador</button>
            </form>
            <div className="quick-stats">
              <div><strong>Sem cadastro</strong><span>perfil público instantâneo</span></div>
              <div><strong>TFT-first</strong><span>dados sem ruído de LoL</span></div>
              <div><strong>Insights</strong><span>o que melhorar, não só números</span></div>
            </div>
          </section>

          <section className="feature-grid">
            <article>
              <span>01</span>
              <h3>Seu jogo, não só o meta</h3>
              <p>Descubra quais estilos, comps e ritmos realmente funcionam para você.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Partidas explicadas</h3>
              <p>Veja colocação, comp, traits, economia e padrões de performance em contexto.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Meta sem planilha</h3>
              <p>Informação visual e prática para decidir quando forçar, flexionar ou pivotar.</p>
            </article>
          </section>
        </main>
      ) : (
        <main className="profile-page">
          <section className="player-header">
            <div className="avatar">C</div>
            <div>
              <div className="eyebrow">PERFIL TFT</div>
              <h1>{playerName}</h1>
              <div className="rank-line">Diamond II · 43 LP <span>+127 LP / 7 dias</span></div>
            </div>
            <button className="refresh-button">Atualizar</button>
          </section>

          <section className="stat-grid">
            <article><span>Colocação média</span><strong>4.18</strong><small>↑ 0.34 neste patch</small></article>
            <article><span>Top 4</span><strong>56%</strong><small>42 de 75 partidas</small></article>
            <article><span>Win rate</span><strong>14%</strong><small>11 vitórias</small></article>
            <article><span>Partidas</span><strong>75</strong><small>Patch atual</small></article>
          </section>

          <div className="content-grid">
            <section className="panel history">
              <div className="panel-title">
                <div><span>ÚLTIMAS PARTIDAS</span><h2>Histórico</h2></div>
                <button>Ver todas</button>
              </div>
              <div className="match-list">
                {matches.map((match, index) => (
                  <article className="match-row" key={index}>
                    <div className={"placement p" + match.placement}>{match.placement}º</div>
                    <div className="match-main">
                      <strong>{match.comp}</strong>
                      <div>{match.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
                    </div>
                    <div className="match-meta"><span>Avg {match.avg}</span><strong>{match.lp}</strong></div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="panel insights">
              <div className="panel-title">
                <div><span>CHIBI INSIGHTS</span><h2>Seu padrão</h2></div>
              </div>
              <article className="insight positive">
                <b>Melhor caminho</b>
                <p>Seu Top 4 com linhas AP está acima do seu desempenho médio.</p>
              </article>
              <article className="insight warning">
                <b>Ponto de atenção</b>
                <p>Suas piores partidas concentram perda de HP antes do Stage 4.</p>
              </article>
              <article className="insight neutral">
                <b>Estilo detectado</b>
                <p>Você performa melhor jogando flex e convertendo para boards de custo alto.</p>
              </article>
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
