import { FormEvent, useMemo, useState } from "react";
import {
  fetchTftHistory,
  fetchTftMatch,
  fetchTftProfile,
  TftMatch,
  TftMatchDetail,
  TftProfile,
} from "./api/tft";

function cleanName(value:string){
  return value
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2");
}

function placementClass(value:number){
  if(value===1) return "p1";
  if(value<=4) return "p2";
  if(value>=7) return "p7";
  return "";
}

function splitRiotId(value:string){
  const cut=value.lastIndexOf("#");
  if(cut<1 || cut===value.length-1) return null;
  return {
    gameName:value.slice(0,cut).trim(),
    tagLine:value.slice(cut+1).trim(),
  };
}

function App() {
  const [riotId,setRiotId]=useState("");
  const [platform,setPlatform]=useState("br1");
  const [profile,setProfile]=useState<TftProfile|null>(null);
  const [matches,setMatches]=useState<TftMatch[]>([]);
  const [loading,setLoading]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState("");
  const [hasMore,setHasMore]=useState(true);
  const [selectedMatch,setSelectedMatch]=useState<TftMatchDetail|null>(null);
  const [matchLoading,setMatchLoading]=useState(false);
  const [matchError,setMatchError]=useState("");

  const rank=useMemo(
    ()=>profile?.ranked?.find((r)=>r.queueType==="RANKED_TFT") || profile?.ranked?.[0] || null,
    [profile]
  );

  async function searchPlayer(){
    const parsed=splitRiotId(riotId);
    if(!parsed){
      setError("Use o formato Nome#TAG.");
      return;
    }

    setLoading(true);
    setError("");
    setProfile(null);
    setMatches([]);
    setHasMore(true);
    setSelectedMatch(null);

    try{
      const data=await fetchTftProfile(parsed.gameName,parsed.tagLine,platform);
      setProfile(data);
      setMatches(data.matches || []);
      setHasMore((data.matches?.length || 0) >= 12);
    }catch(err){
      setError(err instanceof Error ? err.message : "Não foi possível consultar este jogador agora.");
    }finally{
      setLoading(false);
    }
  }

  async function handleSubmit(event:FormEvent){
    event.preventDefault();
    await searchPlayer();
  }

  async function loadMore(){
    if(!profile || loadingMore || !hasMore) return;
    const parsed=splitRiotId(riotId);
    if(!parsed) return;

    setLoadingMore(true);
    setError("");

    try{
      const result=await fetchTftHistory(
        parsed.gameName,
        parsed.tagLine,
        platform,
        matches.length,
        20,
      );

      const next=result.matches || [];
      setMatches((current)=>{
        const seen=new Set(current.map((m)=>m.id));
        return [...current,...next.filter((m)=>!seen.has(m.id))];
      });
      setHasMore(next.length >= 20);
    }catch(err){
      setError(err instanceof Error ? err.message : "Não foi possível carregar mais partidas.");
    }finally{
      setLoadingMore(false);
    }
  }

  async function openMatch(match:TftMatch){
    setMatchLoading(true);
    setMatchError("");
    setSelectedMatch(null);

    try{
      const detail=await fetchTftMatch(match.id);
      setSelectedMatch(detail);
    }catch(err){
      setMatchError(err instanceof Error ? err.message : "Não foi possível abrir esta partida.");
    }finally{
      setMatchLoading(false);
    }
  }

  function resetSearch(){
    setProfile(null);
    setMatches([]);
    setError("");
    setSelectedMatch(null);
    setMatchError("");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={resetSearch}>
          <span className="brand-mark">c</span>
          <span>chibi<span>.gg</span></span>
        </button>
        <nav>
          <a href="#meta">Meta</a>
          <a href="#comps">Comps</a>
          <a href="#leaderboard">Leaderboard</a>
        </nav>
        <button className="ghost-button">Entrar</button>
      </header>

      {!profile ? (
        <main className="landing">
          <section className="hero">
            <div className="eyebrow">TFT FIRST. DATA THAT HELPS YOU CLIMB.</div>
            <h1>Entenda suas partidas.<br /><span>Suba com intenção.</span></h1>
            <p>
              Busque qualquer Riot ID e veja rank, histórico, comps, padrões e insights
              pensados especificamente para Teamfight Tactics.
            </p>

            <form className="search-box" onSubmit={handleSubmit}>
              <select aria-label="Região" value={platform} onChange={(e)=>setPlatform(e.target.value)}>
                <option value="br1">BR</option>
                <option value="na1">NA</option>
                <option value="euw1">EUW</option>
                <option value="eun1">EUNE</option>
                <option value="kr">KR</option>
                <option value="jp1">JP</option>
                <option value="la1">LAN</option>
                <option value="la2">LAS</option>
                <option value="oc1">OCE</option>
              </select>

              <input
                value={riotId}
                onChange={(e)=>setRiotId(e.target.value)}
                placeholder="Nome#TAG"
                aria-label="Riot ID"
              />

              <button type="submit" disabled={loading}>
                {loading ? "Buscando..." : "Buscar jogador"}
              </button>
            </form>

            {error && <div className="lookup-error">{error}</div>}

            <div className="quick-stats">
              <div><strong>Sem cadastro</strong><span>perfil TFT instantâneo</span></div>
              <div><strong>Dados Riot</strong><span>rank + partidas oficiais</span></div>
              <div><strong>Insights</strong><span>o que melhorar, não só números</span></div>
            </div>
          </section>

          <section className="feature-grid">
            <article><span>01</span><h3>Seu jogo, não só o meta</h3><p>Descubra quais estilos, traits e ritmos realmente funcionam para você.</p></article>
            <article><span>02</span><h3>Partidas explicadas</h3><p>Veja colocação, board, augments, unidades e economia em contexto.</p></article>
            <article><span>03</span><h3>TFT de verdade</h3><p>Um tracker pensado primeiro para TFT, não como uma aba secundária de LoL.</p></article>
          </section>
        </main>
      ) : (
        <main className="profile-page">
          <button className="back-search" onClick={resetSearch}>← Nova busca</button>

          <section className="player-header">
            <div className="avatar">{profile.player.gameName.slice(0,1).toUpperCase()}</div>
            <div>
              <div className="eyebrow">PERFIL TFT · {profile.player.platform}</div>
              <h1>{profile.player.gameName}<span className="player-tag">#{profile.player.tagLine}</span></h1>
              <div className="rank-line">
                {rank ? rank.tier+" "+rank.rank+" · "+rank.leaguePoints+" LP" : "Sem rank TFT"}
                <span>{matches.length} partidas carregadas</span>
              </div>
            </div>
            <button className="refresh-button" onClick={searchPlayer} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </section>

          <section className="stat-grid">
            <article><span>Colocação média</span><strong>{profile.summary.averagePlacement ?? "—"}</strong><small>amostra recente</small></article>
            <article><span>Top 4</span><strong>{profile.summary.top4Rate}%</strong><small>consistência recente</small></article>
            <article><span>Win rate</span><strong>{profile.summary.winRate}%</strong><small>{profile.summary.firsts} primeiros lugares</small></article>
            <article><span>8º lugares</span><strong>{profile.summary.eighths}</strong><small>risco recente</small></article>
          </section>

          {error && <div className="profile-error">{error}</div>}

          <div className="content-grid">
            <section className="panel history">
              <div className="panel-title">
                <div><span>PARTIDAS RIOT</span><h2>Histórico recente</h2></div>
                <small>{matches.length} carregadas</small>
              </div>

              <div className="match-list">
                {matches.map((match)=>(
                  <button className="match-row match-button" key={match.id} onClick={()=>openMatch(match)}>
                    <div className={"placement "+placementClass(match.placement)}>{match.placement}º</div>

                    <div className="match-main">
                      <strong>
                        {match.traits
                          .filter((t)=>t.numUnits>0)
                          .sort((a,b)=>b.style-a.style || b.numUnits-a.numUnits)
                          .slice(0,2)
                          .map((t)=>cleanName(t.name))
                          .join(" · ") || "Board TFT"}
                      </strong>

                      <div>
                        {match.traits
                          .filter((t)=>t.numUnits>0)
                          .sort((a,b)=>b.style-a.style || b.numUnits-a.numUnits)
                          .slice(0,5)
                          .map((trait)=>(
                            <span key={trait.name}>{cleanName(trait.name)} {trait.numUnits}</span>
                          ))}
                      </div>

                      <div className="unit-row">
                        {match.units.slice(0,9).map((unit,index)=>(
                          <span className="unit-chip" key={unit.characterId+index}>
                            {cleanName(unit.characterId).slice(0,4)}
                            <b>{unit.tier}★</b>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="match-meta">
                      <span>Nível {match.level}</span>
                      <strong>{match.damageToPlayers} dano</strong>
                      <small>{match.goldLeft}g</small>
                    </div>
                  </button>
                ))}
              </div>

              {hasMore && <button className="load-more" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Carregando..." : "Carregar mais partidas"}
              </button>}
            </section>

            <aside className="panel insights">
              <div className="panel-title">
                <div><span>CHIBI INSIGHTS</span><h2>Primeira leitura</h2></div>
              </div>

              <article className="insight positive">
                <b>Consistência</b>
                <p>Top 4 em {profile.summary.top4Rate}% das partidas analisadas.</p>
              </article>

              <article className="insight neutral">
                <b>Conversão</b>
                <p>{profile.summary.firsts} vitórias na amostra recente.</p>
              </article>

              <article className="insight warning">
                <b>Próxima camada</b>
                <p>Vamos cruzar augments, itens, economia e transições para gerar insights realmente específicos.</p>
              </article>
            </aside>
          </div>
        </main>
      )}

      {(matchLoading || selectedMatch || matchError) && (
        <div className="match-overlay" onClick={()=>{setSelectedMatch(null);setMatchError("");}}>
          <section className="match-modal" onClick={(e)=>e.stopPropagation()}>
            <button className="match-close" onClick={()=>{setSelectedMatch(null);setMatchError("");}}>×</button>

            {matchLoading && <div className="match-state">Carregando detalhes da partida...</div>}
            {matchError && <div className="match-state error">{matchError}</div>}

            {selectedMatch && <>
              <div className="panel-title">
                <div>
                  <span>DETALHES DA PARTIDA</span>
                  <h2>{selectedMatch.match.setName || "Teamfight Tactics"}</h2>
                </div>
                <small>{selectedMatch.match.participants.length} jogadores</small>
              </div>

              <div className="lobby-list">
                {selectedMatch.match.participants
                  .slice()
                  .sort((a,b)=>a.placement-b.placement)
                  .map((participant,index)=>(
                    <article className="lobby-player" key={index}>
                      <div className={"placement "+placementClass(participant.placement)}>{participant.placement}º</div>
                      <div className="lobby-board">
                        <strong>Nível {participant.level}</strong>
                        <div className="unit-row">
                          {participant.units.slice(0,9).map((unit,unitIndex)=>(
                            <span className="unit-chip" key={unit.characterId+unitIndex}>
                              {cleanName(unit.characterId).slice(0,4)}
                              <b>{unit.tier}★</b>
                            </span>
                          ))}
                        </div>
                        <div className="augment-row">
                          {participant.augments.slice(0,3).map((augment)=>(
                            <span key={augment}>{cleanName(augment)}</span>
                          ))}
                        </div>
                      </div>
                      <div className="lobby-meta">
                        <strong>{participant.damageToPlayers} dano</strong>
                        <span>{participant.goldLeft}g</span>
                      </div>
                    </article>
                  ))}
              </div>
            </>}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
