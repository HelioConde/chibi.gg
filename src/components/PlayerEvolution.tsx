import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { queueLabel, staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";
import { getRankHistory, RankSnapshot } from "../rankHistory";

type Props={
  playerKey:string;
  matches:TftMatch[];
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
};

type Aggregated={
  id:string;
  games:number;
  averagePlacement:number;
  top4Rate:number;
  matchIds:string[];
};

function clean(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\bUnique Trait\b/gi,"")
    .replace(/\bTrait\b$/i,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

function aggregate(matches:TftMatch[],kind:"champion"|"trait"){
  const map=new Map<string,TftMatch[]>();

  for(const match of matches){
    const ids=kind==="champion"
      ? [...new Set(match.units.map(unit=>unit.characterId).filter(Boolean))]
      : [...new Set(
          match.traits
            .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
            .map(trait=>trait.name)
            .filter(Boolean)
        )];

    for(const id of ids){
      const list=map.get(id)||[];
      list.push(match);
      map.set(id,list);
    }
  }

  return [...map.entries()]
    .map(([id,games])=>{
      const avg=games.reduce((sum,match)=>sum+match.placement,0)/games.length;
      return {
        id,
        games:games.length,
        averagePlacement:+avg.toFixed(2),
        top4Rate:Math.round(games.filter(match=>match.placement<=4).length/games.length*100),
        matchIds:games.map(match=>match.id),
      } satisfies Aggregated;
    })
    .filter(row=>row.games>=2)
    .sort((a,b)=>b.games-a.games||a.averagePlacement-b.averagePlacement)
    .slice(0,6);
}

function rankLabel(snapshot:RankSnapshot){
  return snapshot.tier+" "+snapshot.rank+" · "+snapshot.leaguePoints+" LP";
}

function primaryTrait(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)[0]?.name||"";
}

function blockMetrics(games:TftMatch[]){
  if(!games.length)return {
    games:0,
    average:null as number|null,
    top4Rate:0,
    bottom2Rate:0,
    lines:0,
    matchIds:[] as string[],
  };

  const average=games.reduce((sum,match)=>sum+match.placement,0)/games.length;
  const lines=new Set(games.map(primaryTrait).filter(Boolean));

  return {
    games:games.length,
    average:+average.toFixed(2),
    top4Rate:Math.round(games.filter(match=>match.placement<=4).length/games.length*100),
    bottom2Rate:Math.round(games.filter(match=>match.placement>=7).length/games.length*100),
    lines:lines.size,
    matchIds:games.map(match=>match.id),
  };
}

function normalizedLp(snapshot:RankSnapshot){
  const tierBase:Record<string,number>={
    IRON:0,BRONZE:400,SILVER:800,GOLD:1200,PLATINUM:1600,
    EMERALD:2000,DIAMOND:2400,MASTER:2800,GRANDMASTER:3200,CHALLENGER:3600,
  };
  const divisionOffset:Record<string,number>={IV:0,III:100,II:200,I:300};
  const tier=String(snapshot.tier||"").toUpperCase();
  const rank=String(snapshot.rank||"").toUpperCase();
  return (tierBase[tier]||0)+(divisionOffset[rank]||0)+snapshot.leaguePoints;
}

export default function PlayerEvolution({playerKey,matches,staticData,onEvidence}:Props){
  const [version,setVersion]=useState(0);

  useEffect(()=>{
    const refresh=()=>setVersion(value=>value+1);
    window.addEventListener("chibi:rank-history",refresh);
    return ()=>window.removeEventListener("chibi:rank-history",refresh);
  },[]);

  const history=useMemo(()=>{
    void version;
    return getRankHistory(playerKey);
  },[playerKey,version]);

  const champions=useMemo(()=>aggregate(matches,"champion"),[matches]);
  const traits=useMemo(()=>aggregate(matches,"trait"),[matches]);

  const rankDelta=useMemo(()=>{
    if(history.length<2)return null;
    return normalizedLp(history[history.length-1])-normalizedLp(history[0]);
  },[history]);

  const recentPlacements=matches.slice(0,10).map(match=>match.placement);

  const blockComparison=useMemo(()=>{
    const latest=blockMetrics(matches.slice(0,5));
    const previous=blockMetrics(matches.slice(5,10));

    const averageDelta=latest.average!=null&&previous.average!=null
      ? +(latest.average-previous.average).toFixed(2)
      : null;

    return {
      latest,
      previous,
      averageDelta,
      top4Delta:latest.top4Rate-previous.top4Rate,
      bottom2Delta:latest.bottom2Rate-previous.bottom2Rate,
      linesDelta:latest.lines-previous.lines,
    };
  },[matches]);

  const modes=useMemo(()=>{
    const map=new Map<number,TftMatch[]>();
    for(const match of matches){
      const queue=Number(match.queueId)||0;
      if(!queue) continue;
      const list=map.get(queue)||[];
      list.push(match);
      map.set(queue,list);
    }
    return [...map.entries()]
      .map(([queueId,games])=>({
        queueId,
        games:games.length,
        averagePlacement:+(games.reduce((sum,match)=>sum+match.placement,0)/games.length).toFixed(2),
        top4Rate:Math.round(games.filter(match=>match.placement<=4).length/games.length*100),
        matchIds:games.map(match=>match.id),
      }))
      .sort((a,b)=>b.games-a.games);
  },[matches]);

  return <section className="profile-depth-grid">
    {blockComparison.previous.games>=3&&<article className="panel player-depth-card evolution-block-card">
      <div className="depth-card-head">
        <div>
          <span>MUDANÇA RECENTE</span>
          <h3>Últimas 5 × 5 anteriores</h3>
        </div>
        <button onClick={()=>onEvidence(
          [...blockComparison.latest.matchIds,...blockComparison.previous.matchIds],
          "Evolução · últimas 5 vs 5 anteriores",
        )}>Ver 10 partidas</button>
      </div>

      <div className="evolution-block-grid">
        <article className={blockComparison.averageDelta==null?"":blockComparison.averageDelta<0?"better":blockComparison.averageDelta>0?"worse":""}>
          <span>COLOCAÇÃO MÉDIA</span>
          <div><b>{blockComparison.previous.average??"—"}</b><em>→</em><strong>{blockComparison.latest.average??"—"}</strong></div>
          <small>{blockComparison.averageDelta==null
            ?"sem comparação"
            :blockComparison.averageDelta<0
              ? Math.abs(blockComparison.averageDelta).toFixed(2)+" melhor"
              :blockComparison.averageDelta>0
                ? blockComparison.averageDelta.toFixed(2)+" pior"
                : "estável"}</small>
        </article>

        <article className={blockComparison.top4Delta>0?"better":blockComparison.top4Delta<0?"worse":""}>
          <span>TOP 4</span>
          <div><b>{blockComparison.previous.top4Rate}%</b><em>→</em><strong>{blockComparison.latest.top4Rate}%</strong></div>
          <small>{(blockComparison.top4Delta>0?"+":"")+blockComparison.top4Delta} pp</small>
        </article>

        <article className={blockComparison.bottom2Delta<0?"better":blockComparison.bottom2Delta>0?"worse":""}>
          <span>BOTTOM 2</span>
          <div><b>{blockComparison.previous.bottom2Rate}%</b><em>→</em><strong>{blockComparison.latest.bottom2Rate}%</strong></div>
          <small>{(blockComparison.bottom2Delta>0?"+":"")+blockComparison.bottom2Delta} pp</small>
        </article>

        <article className={blockComparison.linesDelta>0?"better":blockComparison.linesDelta<0?"worse":""}>
          <span>LINHAS PRINCIPAIS</span>
          <div><b>{blockComparison.previous.lines}</b><em>→</em><strong>{blockComparison.latest.lines}</strong></div>
          <small>{blockComparison.linesDelta===0?"estável":(blockComparison.linesDelta>0?"+":"")+blockComparison.linesDelta+" linha(s)"}</small>
        </article>
      </div>

      <p className="evolution-block-note">Blocos de 5 jogos são voláteis. Esta comparação serve para detectar direção recente e escolher partidas para revisar, não para provar melhora permanente.</p>
    </article>}

    <article className="panel player-depth-card rank-history-card">
      <div className="depth-card-head">
        <div>
          <span>EVOLUÇÃO</span>
          <h3>Rank History</h3>
        </div>
        <small>{history.length} snapshot{history.length===1?"":"s"}</small>
      </div>

      {history.length?<>
        <div className="rank-history-now">
          <strong>{rankLabel(history[history.length-1])}</strong>
          <span className={rankDelta==null?"":rankDelta>=0?"positive":"negative"}>
            {rankDelta==null?"linha de base":(rankDelta>0?"+":"")+rankDelta+" LP normalizado"}
          </span>
        </div>

        <div className="rank-history-strip" aria-label="Histórico visual de rank">
          {history.slice(-12).map((snapshot,index)=>{
            const value=normalizedLp(snapshot);
            const all=history.slice(-12).map(normalizedLp);
            const min=Math.min(...all);
            const max=Math.max(...all);
            const height=max===min?50:20+((value-min)/(max-min))*70;
            return <span
              key={snapshot.createdAt+":"+index}
              title={rankLabel(snapshot)}
              style={{height:height+"%"}}
            />;
          })}
        </div>

        <small className="rank-history-note">Snapshots são salvos quando este perfil é atualizado neste navegador.</small>
      </>:<p className="depth-empty">Atualize o perfil em visitas diferentes para construir o histórico de LP.</p>}
    </article>

    <article className="panel player-depth-card">
      <div className="depth-card-head">
        <div>
          <span>RECENTES</span>
          <h3>Últimas 10 colocações</h3>
        </div>
      </div>

      <div className="placement-depth-strip">
        {recentPlacements.map((placement,index)=>(
          <span className={placement===1?"win":placement<=4?"top4":placement>=7?"bottom":""} key={index}>
            {placement}
          </span>
        ))}
      </div>

      <p className="depth-card-copy">Leitura visual rápida do ritmo recente. Menor colocação é melhor.</p>
    </article>

    <article className="panel player-depth-card">
      <div className="depth-card-head">
        <div>
          <span>MOST CHAMPIONS</span>
          <h3>Unidades mais recorrentes</h3>
        </div>
      </div>

      <div className="depth-list">
        {champions.length?champions.map(row=>{
          const entry=staticEntry(staticData?.champions,row.id);
          const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
          const name=entry?.name||clean(row.id);
          return <button onClick={()=>onEvidence(row.matchIds,"Champion · "+name)} key={row.id}>
            <span className="depth-icon">{image&&<img src={image} alt=""/>}</span>
            <span><strong>{name}</strong><small>{row.games} jogos · média {row.averagePlacement}</small></span>
            <b>{row.top4Rate}%</b>
          </button>;
        }):<p className="depth-empty">Ainda não há champions repetidos o suficiente.</p>}
      </div>
    </article>

    <article className="panel player-depth-card">
      <div className="depth-card-head">
        <div>
          <span>OTHER MODES</span>
          <h3>Filas carregadas</h3>
        </div>
      </div>

      <div className="depth-list">
        {modes.length?modes.map(mode=>(
          <button onClick={()=>onEvidence(mode.matchIds,"Fila · "+queueLabel(staticData,mode.queueId))} key={mode.queueId}>
            <span className="depth-mode-icon">{queueLabel(staticData,mode.queueId).slice(0,2).toUpperCase()}</span>
            <span><strong>{queueLabel(staticData,mode.queueId)}</strong><small>{mode.games} jogos · média {mode.averagePlacement}</small></span>
            <b>{mode.top4Rate}%</b>
          </button>
        )):<p className="depth-empty">Nenhuma fila identificada na amostra.</p>}
      </div>
    </article>

    <article className="panel player-depth-card">
      <div className="depth-card-head">
        <div>
          <span>MOST SYNERGIES</span>
          <h3>Traits mais recorrentes</h3>
        </div>
      </div>

      <div className="depth-list">
        {traits.length?traits.map(row=>{
          const entry=staticEntry(staticData?.traits,row.id);
          const image=staticData?tftAssetUrl(staticData.version,"trait",entry):"";
          const name=entry?.name||clean(row.id);
          return <button onClick={()=>onEvidence(row.matchIds,"Trait · "+name)} key={row.id}>
            <span className="depth-icon trait">{image&&<img src={image} alt=""/>}</span>
            <span><strong>{name}</strong><small>{row.games} jogos · média {row.averagePlacement}</small></span>
            <b>{row.top4Rate}%</b>
          </button>;
        }):<p className="depth-empty">Ainda não há traits repetidas o suficiente.</p>}
      </div>
    </article>
  </section>;
}
