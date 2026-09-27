import { FormEvent, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Profile = {
  player: { gameName:string; tagLine:string; platform:string; level:number };
  ranked: Array<{ queueType:string; tier:string; rank:string; leaguePoints:number; wins:number; losses:number }>;
  summary: { matches:number; averagePlacement:number|null; top4Rate:number; winRate:number; firsts:number; eighths:number };
  matches: Array<{
    id:string; placement:number; level:number; goldLeft:number; damageToPlayers:number;
    traits:Array<{name:string;numUnits:number;style:number}>;
    units:Array<{characterId:string;rarity:number;tier:number;itemNames:string[]}>;
    augments:string[];
  }>;
};

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

function App() {
  const [riotId,setRiotId]=useState("");
  const [platform,setPlatform]=useState("br1");
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const rank=useMemo(
    ()=>profile?.ranked?.find((r)=>r.queueType==="RANKED_TFT") || profile?.ranked?.[0] || null,
    [profile]
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cut=riotId.lastIndexOf("#");
    if(cut<1 || cut===riotId.length-1){
      setError("Use o formato Nome#TAG.");
      return;
    }

    const gameName=riotId.slice(0,cut).trim();
    const tagLine=riotId.slice(cut+1).trim();

    setLoading(true);
    setError("");
    setProfile(null);

    const {data,error:invokeError}=await supabase.functions.invoke("public-tft-profile",{
      body:{gameName,tagLine,platform}
    });

    setLoading(false);

    if(invokeError || data?.error){
      setError(data?.message || "Não foi possível consultar este jogador agora.");
      return;
    }

    setProfile(data as Profile);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={()=>{setProfile(null);setError("");}}>
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
            <article>
              <span>01</span>
              <h3>Seu jogo, não só o meta</h3>
              <p>Descubra quais estilos, traits e ritmos realmente funcionam para você.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Partidas explicadas</h3>
              <p>Veja colocação, board, augments, unidades e economia em contexto.</p>
            </article>
            <article>
              <span>03</span>
              <h3>TFT de verdade</h3>
              <p>Um tracker pensado primeiro para TFT, não como uma aba secundária de LoL.</p>
            </article>
          </section>
        </main>
      ) : (
        <main className="profile-page">
          <button className="back-search" onClick={()=>setProfile(null)}>← Nova busca</button>

          <section className="player-header">
            <div className="avatar">{profile.player.gameName.slice(0,1).toUpperCase()}</div>
            <div>
              <div className="eyebrow">PERFIL TFT · {profile.player.platform}</div>
              <h1>{profile.player.gameName}<span className="player-tag">#{profile.player.tagLine}</span></h1>
              <div className="rank-line">
                {rank ? rank.tier+" "+rank.rank+" · "+rank.leaguePoints+" LP" : "Sem rank TFT"}
                <span>{profile.summary.matches} partidas analisadas</span>
              </div>
            </div>
            <button className="refresh-button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </section>

          <section className="stat-grid">
            <article><span>Colocação média</span><strong>{profile.summary.averagePlacement ?? "—"}</strong><small>amostra recente</small></article>
            <article><span>Top 4</span><strong>{profile.summary.top4Rate}%</strong><small>consistência recente</small></article>
            <article><span>Win rate</span><strong>{profile.summary.winRate}%</strong><small>{profile.summary.firsts} primeiros lugares</small></article>
            <article><span>8º lugares</span><strong>{profile.summary.eighths}</strong><small>risco recente</small></article>
          </section>

          <div className="content-grid">
            <section className="panel history">
              <div className="panel-title">
                <div><span>PARTIDAS RIOT</span><h2>Histórico recente</h2></div>
              </div>

              <div className="match-list">
                {profile.matches.map((match)=>(
                  <article className="match-row" key={match.id}>
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
                  </article>
                ))}
              </div>
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
    </div>
  );
}

export default App;
