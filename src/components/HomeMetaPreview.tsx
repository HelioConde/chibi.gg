import { useEffect, useState } from "react";
import {
  fetchTftComps,
  fetchTftStats,
  TftGlobalComps,
  TftGlobalStats,
} from "../api/tft";
import {
  staticEntry,
  tftAssetUrl,
  TftStaticData,
} from "../tftStatic";
import { StatisticsCategory } from "./StatisticsPage";

type Props={
  staticData:TftStaticData|null;
  onOpenMeta:()=>void;
  onOpenComps:()=>void;
  onOpenStats:(category:StatisticsCategory,query?:string)=>void;
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

function label(
  category:"champions"|"traits",
  id:string,
  staticData:TftStaticData|null,
){
  const row=category==="champions"
    ?staticEntry(staticData?.champions,id)
    :staticEntry(staticData?.traits,id);
  return row?.name||clean(id);
}

function image(
  category:"champions"|"traits",
  id:string,
  staticData:TftStaticData|null,
){
  if(!staticData)return "";
  const row=category==="champions"
    ?staticEntry(staticData.champions,id)
    :staticEntry(staticData.traits,id);
  return tftAssetUrl(staticData.version,category==="champions"?"champion":"trait",row);
}

export default function HomeMetaPreview({
  staticData,
  onOpenMeta,
  onOpenComps,
  onOpenStats,
}:Props){
  const [stats,setStats]=useState<TftGlobalStats|null>(null);
  const [comps,setComps]=useState<TftGlobalComps|null>(null);

  useEffect(()=>{
    let cancelled=false;
    Promise.allSettled([
      fetchTftStats(0,1100,2,20),
      fetchTftComps(0,1100,2,8),
    ]).then(results=>{
      if(cancelled)return;
      const [statsResult,compsResult]=results;
      if(statsResult.status==="fulfilled")setStats(statsResult.value);
      if(compsResult.status==="fulfilled")setComps(compsResult.value);
    });
    return ()=>{cancelled=true;};
  },[]);

  const topChampions=stats?.champions.slice(0,6)||[];
  const topTraits=stats?.traits.slice(0,4)||[];
  const topComps=comps?.comps.slice(0,4)||[];

  return <section className="home-meta-preview">
    <div className="home-meta-head">
      <div>
        <span>TFT AGORA</span>
        <h2>{stats?.context.setNumber?"Set "+stats.context.setNumber:"Meta observado no Chibi"}</h2>
        <p>Uma prévia rápida do dataset antes mesmo de abrir um perfil.</p>
      </div>
      <div className="home-meta-head-actions">
        <span>{staticData?.version?"Data Dragon "+staticData.version:"dados TFT"}</span>
        <button onClick={onOpenMeta}>Abrir Meta →</button>
      </div>
    </div>

    <div className="home-meta-grid">
      <article className="home-meta-card comps-card">
        <div className="home-meta-card-head">
          <div><span>COMPS</span><strong>Boards observados</strong></div>
          <button onClick={onOpenComps}>Ver todas</button>
        </div>
        <div className="home-comp-list">
          {topComps.length?topComps.map((comp,index)=>(
            <button onClick={onOpenComps} key={comp.id}>
              <b>{index+1}</b>
              <span>
                <strong>{comp.traits.slice(0,2).map(row=>label("traits",row.id,staticData)).join(" · ")||"Comp observada"}</strong>
                <small>{comp.games} jogos · média {comp.averagePlacement} · Top 4 {comp.top4Rate}%</small>
              </span>
              <em>{comp.confidence}</em>
            </button>
          )):<div className="home-meta-loading">Construindo comps observadas...</div>}
        </div>
      </article>

      <article className="home-meta-card champions-card">
        <div className="home-meta-card-head">
          <div><span>CHAMPIONS</span><strong>Destaques da base</strong></div>
          <button onClick={()=>onOpenStats("champions")}>Statistics</button>
        </div>
        <div className="home-champion-grid">
          {topChampions.length?topChampions.map(row=>{
            const name=label("champions",row.id,staticData);
            const src=image("champions",row.id,staticData);
            return <button onClick={()=>onOpenStats("champions",name)} key={row.id}>
              <span>{src&&<img src={src} alt=""/>}</span>
              <strong>{name}</strong>
              <small>{row.averagePlacement} avg · {row.top4Rate}% Top 4</small>
            </button>;
          }):<div className="home-meta-loading">Carregando champions...</div>}
        </div>
      </article>

      <article className="home-meta-card traits-card">
        <div className="home-meta-card-head">
          <div><span>TRAITS</span><strong>Synergies observadas</strong></div>
          <button onClick={()=>onOpenStats("traits")}>Statistics</button>
        </div>
        <div className="home-trait-list">
          {topTraits.length?topTraits.map(row=>{
            const name=label("traits",row.id,staticData);
            const src=image("traits",row.id,staticData);
            return <button onClick={()=>onOpenStats("traits",name)} key={row.id}>
              <span>{src&&<img src={src} alt=""/>}</span>
              <div><strong>{name}</strong><small>{row.games} jogos · média {row.averagePlacement}</small></div>
              <b>{row.top4Rate}%</b>
            </button>;
          }):<div className="home-meta-loading">Carregando traits...</div>}
        </div>
      </article>
    </div>

    <p className="home-meta-disclaimer">Prévia baseada no Chibi Dataset observado. Não representa toda a população de TFT.</p>
  </section>;
}
