import { useEffect, useMemo, useState } from "react";
import {
  fetchTftStats,
  TftGlobalEntityStat,
  TftGlobalStats,
  TftMatch,
} from "../api/tft";
import {
  staticEntry,
  tftAssetUrl,
  TftStaticData,
} from "../tftStatic";
import DDragonArt from "./DDragonArt";

export type StatisticsCategory="champions"|"traits"|"items"|"augments";
type Category=StatisticsCategory;
type ViewMode="stats"|"tier";

type Props={
  staticData:TftStaticData|null;
  matches:TftMatch[];
  hasProfile:boolean;
  onBack:()=>void;
  onEvidence:(ids:string[],label:string)=>void;
  initialCategory?:Category;
  initialQuery?:string;
  initialView?:ViewMode;
};

type PersonalStat={
  id:string;
  games:number;
  averagePlacement:number;
  top4Rate:number;
  winRate:number;
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

function entryFor(category:Category,id:string,staticData:TftStaticData|null){
  if(!staticData) return undefined;
  if(category==="champions") return staticEntry(staticData.champions,id);
  if(category==="traits") return staticEntry(staticData.traits,id);
  if(category==="items") return staticEntry(staticData.items,id);
  return staticEntry(staticData.augments,id);
}

function imageFor(category:Category,id:string,staticData:TftStaticData|null){
  if(!staticData) return "";
  const entry=entryFor(category,id,staticData);
  const kind=category==="champions"
    ?"champion"
    :category==="traits"
      ?"trait"
      :category==="items"
        ?"item"
        :"augment";
  return tftAssetUrl(staticData.version,kind,entry);
}

function labelFor(category:Category,id:string,staticData:TftStaticData|null){
  return entryFor(category,id,staticData)?.name||clean(id);
}

function idsFor(match:TftMatch,category:Category){
  if(category==="champions"){
    return [...new Set(match.units.map(unit=>unit.characterId).filter(Boolean))];
  }
  if(category==="traits"){
    return [...new Set(
      match.traits
        .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
        .map(trait=>trait.name)
        .filter(Boolean)
    )];
  }
  if(category==="items"){
    return [...new Set(
      match.units.flatMap(unit=>unit.itemNames).filter(Boolean)
    )];
  }
  return [...new Set(match.augments.filter(Boolean))];
}

function buildPersonal(matches:TftMatch[],category:Category){
  const map=new Map<string,TftMatch[]>();

  for(const match of matches){
    if(match.placement<1||match.placement>8) continue;
    for(const id of idsFor(match,category)){
      const list=map.get(id)||[];
      list.push(match);
      map.set(id,list);
    }
  }

  const result=new Map<string,PersonalStat>();
  for(const [id,games] of map){
    const placements=games.map(match=>match.placement);
    const average=placements.reduce((sum,value)=>sum+value,0)/games.length;
    const top4=games.filter(match=>match.placement<=4).length;
    const wins=games.filter(match=>match.placement===1).length;
    result.set(id,{
      id,
      games:games.length,
      averagePlacement:+average.toFixed(2),
      top4Rate:Math.round(top4/games.length*100),
      winRate:Math.round(wins/games.length*100),
      matchIds:games.map(match=>match.id),
    });
  }
  return result;
}

function globalScore(row:TftGlobalEntityStat){
  const placement=Math.max(0,Math.min(1,(8.5-row.averagePlacement)/7.5));
  const top4=Math.max(0,Math.min(1,row.top4Rate/100));
  const win=Math.max(0,Math.min(1,row.winRate/35));
  const sample=Math.min(1,row.games/40);
  return placement*.42+top4*.28+win*.12+sample*.18;
}

function tierFor(score:number){
  if(score>=.72) return "S";
  if(score>=.59) return "A";
  if(score>=.47) return "B";
  return "C";
}

function signed(value:number,digits=2){
  const rounded=+value.toFixed(digits);
  return (rounded>0?"+":"")+rounded;
}

export default function StatisticsPage({
  staticData,
  matches,
  hasProfile,
  onBack,
  onEvidence,
  initialCategory="champions",
  initialQuery="",
  initialView="stats",
}:Props){
  const [category,setCategory]=useState<Category>(initialCategory);
  const [view,setView]=useState<ViewMode>(initialView);
  const [queueId,setQueueId]=useState<number|null>(1100);
  const [stats,setStats]=useState<TftGlobalStats|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState(initialQuery);

  useEffect(()=>{
    setCategory(initialCategory);
    setQuery(initialQuery);
    setView(initialView);
  },[initialCategory,initialQuery,initialView]);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError("");

    fetchTftStats(0,queueId,2,150)
      .then(data=>{if(!cancelled)setStats(data);})
      .catch(err=>{
        if(cancelled)return;
        setStats(null);
        setError(err instanceof Error?err.message:"Não foi possível carregar as estatísticas.");
      })
      .finally(()=>{if(!cancelled)setLoading(false);});

    return ()=>{cancelled=true;};
  },[queueId]);

  const personal=useMemo(
    ()=>buildPersonal(matches,category),
    [matches,category],
  );

  const rows=useMemo(()=>{
    const source=stats?.[category]||[];
    const normalized=query.trim().toLowerCase();

    return source
      .map(row=>({
        ...row,
        score:globalScore(row),
        personal:personal.get(row.id)||null,
      }))
      .filter(row=>{
        if(!normalized)return true;
        return labelFor(category,row.id,staticData).toLowerCase().includes(normalized)
          || row.id.toLowerCase().includes(normalized);
      })
      .sort((a,b)=>b.score-a.score||b.games-a.games);
  },[stats,category,personal,query,staticData]);

  const augmentCatalogue=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return Object.entries(staticData?.augments||{})
      .map(([id,entry])=>({
        id,
        name:String(entry?.name||clean(id)),
        image:staticData?tftAssetUrl(staticData.version,"augment",entry):"",
      }))
      .filter(row=>!normalized||row.name.toLowerCase().includes(normalized)||row.id.toLowerCase().includes(normalized))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .slice(0,80);
  },[staticData,query]);

  const tiers=useMemo(()=>{
    const map:{S:typeof rows;A:typeof rows;B:typeof rows;C:typeof rows}={
      S:[],A:[],B:[],C:[],
    };
    for(const row of rows){
      map[tierFor(row.score)].push(row);
    }
    return map;
  },[rows]);

  const maturity=stats
    ? stats.sampleParticipants>=1000?"robusta"
      :stats.sampleParticipants>=250?"crescendo"
      :"inicial"
    :"inicial";

  const categoryLabel={
    champions:"Champions",
    traits:"Traits",
    items:"Items",
    augments:"Augments",
  }[category];

  return <main className="statistics-page">
    <section className="statistics-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">CHIBI STATISTICS</span>
        <h1>Meta global.<br/><em>E o que ele significa para você.</em></h1>
        <p>Champions, traits, items e augments com desempenho observado, amostra explícita e comparação pessoal quando um perfil está aberto.</p>
        <DDragonArt
          staticData={staticData}
          setNumber={stats?.context.setNumber}
          championIds={stats?.champions.slice(0,6).map(row=>row.id)||[]}
          variant="ribbon"
          label="Visual oficial · Data Dragon"
        />
      </div>

      <div className={"meta-dataset-card "+maturity}>
        <span>BASE ATUAL</span>
        <strong>{stats?.sampleParticipants??0}</strong>
        <small>participantes observados</small>
        <b>{maturity}</b>
      </div>
    </section>

    <section className="statistics-toolbar">
      <div className="statistics-categories">
        {(["champions","traits","items","augments"] as Category[]).map(id=>(
          <button className={category===id?"active":""} onClick={()=>{
            setCategory(id);
            if(id==="augments")setView("stats");
          }} key={id}>
            {{champions:"Champions",traits:"Traits",items:"Items",augments:"Augments"}[id]}
          </button>
        ))}
      </div>

      <div className="statistics-view-switch">
        <button className={view==="stats"?"active":""} onClick={()=>setView("stats")}>Estatísticas</button>
        <button
          className={view==="tier"?"active":""}
          onClick={()=>setView("tier")}
          disabled={category==="augments"}
          title={category==="augments"?"Augments ficam em catálogo enquanto a amostra de partidas não os expõe.":""}
        >Tier List</button>
      </div>
    </section>

    <section className="statistics-filters">
      <input
        value={query}
        onChange={event=>setQuery(event.target.value)}
        placeholder={"Pesquisar "+categoryLabel.toLowerCase()+"..."}
      />
      <div>
        <button className={queueId===1100?"active":""} onClick={()=>setQueueId(1100)}>Ranqueada</button>
        <button className={queueId==null?"active":""} onClick={()=>setQueueId(null)}>Todas</button>
      </div>
      <span>{stats?.context.setNumber?"Set "+stats.context.setNumber:"Set atual"}</span>
    </section>

    {loading&&<section className="panel meta-page-state">Carregando estatísticas...</section>}
    {!loading&&error&&<section className="panel meta-page-state error">Não foi possível carregar as estatísticas agora.</section>}

    {!loading&&!error&&stats&&view==="stats"&&category==="augments"&&!rows.length&&<section className="panel augment-catalogue-panel">
      <div className="augment-catalogue-head">
        <div>
          <span>CATÁLOGO DATA DRAGON</span>
          <h2>Augments visuais, sem estatística inventada</h2>
          <p>Nenhuma observação atual do Chibi Dataset trouxe augments pela Match-v1. Enquanto isso, esta aba usa apenas os assets estáticos oficiais para consulta visual.</p>
        </div>
        <strong>{augmentCatalogue.length}</strong>
      </div>

      <div className="augment-catalogue-grid">
        {augmentCatalogue.map(augment=>(
          <article key={augment.id}>
            <span>{augment.image&&<img src={augment.image} alt=""/>}</span>
            <div><strong>{augment.name}</strong><small>{augment.id}</small></div>
          </article>
        ))}
      </div>

      {!augmentCatalogue.length&&<div className="meta-page-state">Nenhum augment encontrado no catálogo para esta busca.</div>}
    </section>}

    {!loading&&!error&&stats&&view==="stats"&&(category!=="augments"||rows.length>0)&&<section className={"panel statistics-table-panel "+(category==="augments"?"no-win":"")}>
      <div className="statistics-table-head">
        <div><span>RANK</span><span>{categoryLabel}</span></div>
        <span>AMOSTRA</span>
        <span>PICK</span>
        <span>MÉDIA</span>
        <span>TOP 4</span>
        {category!=="augments"&&<span>WIN</span>}
        {hasProfile&&<span>VOCÊ</span>}
      </div>

      <div className="statistics-table">
        {rows.map((row,index)=>{
          const label=labelFor(category,row.id,staticData);
          const image=imageFor(category,row.id,staticData);
          const personalRow=row.personal;
          const delta=personalRow?personalRow.averagePlacement-row.averagePlacement:null;

          return <article key={row.id}>
            <div className="statistics-entity">
              <b>{index+1}</b>
              <span className={"statistics-icon "+category}>
                {image&&<img src={image} alt="" onError={event=>{event.currentTarget.style.display="none";}}/>}
              </span>
              <div>
                <strong>{label}</strong>
                <small>{row.id}</small>
              </div>
            </div>

            <span><b>{row.games}</b><small>jogos</small></span>
            <span><b>{row.pickRate}%</b><small>observado</small></span>
            <span><b>{row.averagePlacement}</b><small>colocação</small></span>
            <span><b>{row.top4Rate}%</b><small>Top 4</small></span>
            {category!=="augments"&&<span><b>{row.winRate}%</b><small>vitória</small></span>}

            {hasProfile&&<div className="statistics-personal">
              {personalRow?<>
                <div>
                  <b>{personalRow.averagePlacement}</b>
                  <small>{personalRow.games} suas · Δ {signed(delta||0)}</small>
                </div>
                <button onClick={()=>onEvidence(personalRow.matchIds,categoryLabel+" · "+label)}>Ver</button>
              </>:<small>sem amostra pessoal</small>}
            </div>}
          </article>;
        })}
      </div>

      {!rows.length&&<div className="meta-page-state">Nenhum resultado encontrado.</div>}

      <p className="global-meta-disclaimer">Os números representam apenas o Chibi Dataset observado. Quanto menor a amostra, mais experimental deve ser a leitura.</p>
    </section>}

    {!loading&&!error&&stats&&view==="tier"&&category!=="augments"&&<section className="tier-list-shell">
      {(["S","A","B","C"] as const).map(tier=>(
        <article className={"tier-row tier-"+tier.toLowerCase()} key={tier}>
          <div className="tier-badge">{tier}</div>
          <div className="tier-entities">
            {tiers[tier].length?tiers[tier].map(row=>{
              const label=labelFor(category,row.id,staticData);
              const image=imageFor(category,row.id,staticData);
              return <button
                className="tier-entity"
                title={label+" · média "+row.averagePlacement+" · "+row.games+" jogos"}
                onClick={()=>{
                  if(row.personal?.matchIds.length){
                    onEvidence(row.personal.matchIds,"Tier "+tier+" · "+label);
                  }
                }}
                key={row.id}
              >
                <span>{image&&<img src={image} alt=""/>}</span>
                <strong>{label}</strong>
                <small>{row.averagePlacement} · {row.games}j{row.personal?" · você "+row.personal.averagePlacement:""}</small>
              </button>;
            }):<span className="tier-empty">Sem sinal suficiente nesta faixa.</span>}
          </div>
        </article>
      ))}

      <p className="global-meta-disclaimer">A Tier List do Chibi é uma visualização do sinal composto do dataset, não uma classificação oficial da Riot. Amostra e colocação continuam visíveis para evitar falsa precisão.</p>
    </section>}
  </main>;
}
