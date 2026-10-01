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
import { useI18n } from "../i18n";
import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";
import ArtworkRibbon from "./ArtworkRibbon";
import { saveStudyShelfItem } from "../studyShelf";

export type StatisticsCategory="champions"|"traits"|"items";
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
  return staticEntry(staticData.items,id);
}

function imageFor(category:Category,id:string,staticData:TftStaticData|null){
  if(!staticData) return "";
  const entry=entryFor(category,id,staticData);
  const kind=category==="champions"
    ?"champion"
    :category==="traits"
      ?"trait"
      :"item";
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
  return [...new Set(
    match.units.flatMap(unit=>unit.itemNames).filter(Boolean)
  )];
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

function sampleBand(games:number){
  if(games>=50)return {
    labelKey:"stats.sample.high.label",
    tone:"high",
    helpKey:"stats.sample.high.help",
  };
  if(games>=20)return {
    labelKey:"stats.sample.medium.label",
    tone:"medium",
    helpKey:"stats.sample.medium.help",
  };
  return {
    labelKey:"stats.sample.low.label",
    tone:"low",
    helpKey:"stats.sample.low.help",
  };
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
  const { t } = useI18n();
  const [category,setCategory]=useState<Category>(initialCategory);
  const [view,setView]=useState<ViewMode>(initialView);
  const [queueId,setQueueId]=useState<number|null>(1100);
  const [stats,setStats]=useState<TftGlobalStats|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState(initialQuery);
  const [selectedEntityId,setSelectedEntityId]=useState<string|null>(null);
  const [shelfSavedId,setShelfSavedId]=useState<string>("");

  useEffect(()=>{
    setCategory(initialCategory);
    setQuery(initialQuery);
    setView(initialView);
    setSelectedEntityId(null);
  },[initialCategory,initialQuery,initialView]);

  useEffect(()=>{
    setSelectedEntityId(null);
  },[category,queueId]);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError("");

    fetchTftStats(0,queueId,2,150)
      .then(data=>{if(!cancelled)setStats(data);})
      .catch(err=>{
        if(cancelled)return;
        setStats(null);
        setError(err instanceof Error?err.message:t("stats.errorLoad"));
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


  const selectedRow=useMemo(
    ()=>selectedEntityId?rows.find(row=>row.id===selectedEntityId)||null:null,
    [selectedEntityId,rows],
  );

  const quickRows=useMemo(()=>rows.slice(0,3),[rows]);

  function openQuickRow(id:string){
    setSelectedEntityId(id);
    requestAnimationFrame(()=>requestAnimationFrame(()=>
      document.getElementById("statistics-detail")?.scrollIntoView({behavior:"smooth",block:"start"})
    ));
  }

  const selectedInterpretation=useMemo(()=>{
    if(!selectedRow)return null;
    const personalRow=selectedRow.personal;

    if(!personalRow){
      return {
        tone:"neutral",
        title:t("stats.interpret.none.title"),
        body:t("stats.interpret.none.body"),
      };
    }

    if(personalRow.games<3||selectedRow.games<20){
      return {
        tone:"neutral",
        title:t("stats.interpret.early.title"),
        body:t("stats.interpret.early.body"),
      };
    }

    const delta=personalRow.averagePlacement-selectedRow.averagePlacement;
    if(delta<=-.5){
      return {
        tone:"good",
        title:t("stats.interpret.better.title"),
        body:t("stats.interpret.better.body",{delta:Math.abs(delta).toFixed(2)}),
      };
    }

    if(delta>=.5){
      return {
        tone:"warning",
        title:t("stats.interpret.worse.title"),
        body:t("stats.interpret.worse.body",{delta:delta.toFixed(2)}),
      };
    }

    return {
      tone:"neutral",
      title:t("stats.interpret.close.title"),
      body:t("stats.interpret.close.body"),
    };
  },[selectedRow,t]);

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
    champions:t("stats.category.champions"),
    traits:t("stats.category.traits"),
    items:t("stats.category.items"),
  }[category];

  function saveStatToShelf(row:typeof rows[number]){
    saveStudyShelfItem({
      type:"stat",
      label:labelFor(category,row.id,staticData),
      subtitle:t("stats.shelfSubtitle",{category:categoryLabel,games:row.games,average:row.averagePlacement}),
      category,
      entityId:row.id,
    });
    setShelfSavedId(category+":"+row.id);
  }

  return <main className="statistics-page">
    <section className="statistics-hero page-hero-with-reference">
      <AdaptiveArtwork className="page-reference-art page-reference-stats" src={SITE_IMAGES.ui.augments} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>{t("common.backProfile")}</button>}
        <span className="eyebrow">CHIBI STATISTICS</span>
        <h1>{t("stats.hero.title1")}<br/><em>{t("stats.hero.title2")}</em></h1>
        <p>{t("stats.hero.desc")}</p>
        <DDragonArt
          staticData={staticData}
          setNumber={stats?.context.setNumber}
          championIds={stats?.champions.slice(0,6).map(row=>row.id)||[]}
          variant="ribbon"
          label={t("stats.riotVisual")}
        />
      </div>

      <div className={"meta-dataset-card "+maturity}>
        <span>{t("meta.currentBase")}</span>
        <strong>{stats?.sampleParticipants??0}</strong>
        <small>{t("meta.observedParticipants")}</small>
        <b>{t(maturity==="robusta"?"common.maturity.robust":maturity==="crescendo"?"common.maturity.growing":"common.maturity.initial")}</b>
      </div>
    </section>

    <ArtworkRibbon images={[10,18,4]} className="stats-art-ribbon"/>

    <section className="statistics-toolbar">
      <div className="statistics-categories">
        {(["champions","traits","items"] as Category[]).map(id=>(
          <button className={category===id?"active":""} onClick={()=>setCategory(id)} key={id}>
            {{champions:t("stats.category.champions"),traits:t("stats.category.traits"),items:t("stats.category.items")}[id]}
          </button>
        ))}
      </div>

      <div className="statistics-view-switch">
        <button className={view==="stats"?"active":""} onClick={()=>setView("stats")}>{t("stats.statistics")}</button>
        <button
          className={view==="tier"?"active":""}
          onClick={()=>setView("tier")}
        >Tier List</button>
      </div>
    </section>

    <section className="statistics-filters">
      <input
        value={query}
        onChange={event=>setQuery(event.target.value)}
        placeholder={t("stats.search",{category:categoryLabel.toLowerCase()})}
      />
      <div>
        <button className={queueId===1100?"active":""} onClick={()=>setQueueId(1100)}>{t("common.rankQueue")}</button>
        <button className={queueId==null?"active":""} onClick={()=>setQueueId(null)}>{t("stats.all")}</button>
      </div>
      <span>{stats?.context.setNumber?"Set "+stats.context.setNumber:t("stats.currentSet")}</span>
    </section>

    {!loading&&!error&&stats&&quickRows.length>0&&<section className="statistics-quick-read">
      <div className="statistics-quick-head">
        <div>
          <span>CHIBI QUICK READ</span>
          <h2>{t("stats.quick.title")}</h2>
          <p>{t("stats.quick.desc")}</p>
        </div>
      </div>

      <div className="statistics-quick-grid">
        {quickRows.map((row,index)=>{
          const label=labelFor(category,row.id,staticData);
          const image=imageFor(category,row.id,staticData);
          return <button
            className={"statistics-quick-card "+(selectedEntityId===row.id?"active":"")}
            type="button"
            onClick={()=>openQuickRow(row.id)}
            key={row.id}
          >
            <span className="statistics-quick-rank">{String(index+1).padStart(2,"0")}</span>
            <span className={"statistics-quick-icon "+category}>
              {image&&<img src={image} alt="" loading="lazy" decoding="async"/>}
            </span>
            <span className="statistics-quick-copy">
              <small>{categoryLabel}</small>
              <strong>{label}</strong>
              <em>{t("stats.quick.sample",{games:row.games})} · {t("stats.quick.average",{average:row.averagePlacement})}</em>
            </span>
            <span className="statistics-quick-metrics">
              <b>Top 4 {row.top4Rate}%</b>
              <small>Pick {row.pickRate}%</small>
            </span>
            <i>{t("stats.quick.open")} →</i>
          </button>;
        })}
      </div>
    </section>}

    <details className="statistics-sample-guide">
      <summary>
        <span><b>{t("stats.sampleGuide.title")}</b><small>{t("stats.sampleGuide.subtitle")}</small></span>
        <em>{t("stats.sampleGuide.guide")}</em>
      </summary>
      <div>
        <article className="low">
          <strong>&lt; 20</strong>
          <span>{t("stats.sample.low.label")}</span>
          <p>{t("stats.sample.low.desc")}</p>
        </article>
        <article className="medium">
          <strong>20–49</strong>
          <span>{t("stats.sample.medium.label")}</span>
          <p>{t("stats.sample.medium.desc")}</p>
        </article>
        <article className="high">
          <strong>50+</strong>
          <span>{t("stats.sample.high.label")}</span>
          <p>{t("stats.sample.high.desc")}</p>
        </article>
        {hasProfile&&<article className="personal">
          <strong>3+</strong>
          <span>{t("stats.sample.personal.label")}</span>
          <p>{t("stats.sample.personal.desc")}</p>
        </article>}
      </div>
    </details>

    {!loading&&!error&&selectedRow&&<section className={"panel statistics-entity-detail "+(selectedInterpretation?.tone||"neutral")} id="statistics-detail">
      <div className="statistics-detail-head">
        <div className="statistics-detail-identity">
          <span className={"statistics-detail-icon "+category}>
            {imageFor(category,selectedRow.id,staticData)&&<img src={imageFor(category,selectedRow.id,staticData)} alt=""/>}
          </span>
          <div>
            <span>{t("stats.contextual")}</span>
            <h2>{labelFor(category,selectedRow.id,staticData)}</h2>
            <small>{selectedRow.id}</small>
          </div>
        </div>
        <button onClick={()=>setSelectedEntityId(null)}>{t("stats.close")}</button>
      </div>

      <div className="statistics-detail-grid">
        <article>
          <span>{t("stats.chibiBase")}</span>
          <strong>{selectedRow.averagePlacement}</strong>
          <small>{t("stats.averageGamesBand",{games:selectedRow.games,band:t(sampleBand(selectedRow.games).labelKey)})}</small>
          <div><b>Top 4 {selectedRow.top4Rate}%</b><b>Pick {selectedRow.pickRate}%</b><b>Win {selectedRow.winRate}%</b></div>
        </article>

        <article>
          <span>{t("stats.yourHistory")}</span>
          {selectedRow.personal?<>
            <strong>{selectedRow.personal.averagePlacement}</strong>
            <small>{t("stats.yourAverage",{games:selectedRow.personal.games})}</small>
            <div>
              <b>Top 4 {selectedRow.personal.top4Rate}%</b>
              <b>Win {selectedRow.personal.winRate}%</b>
              <b>Δ {signed(selectedRow.personal.averagePlacement-selectedRow.averagePlacement)}</b>
            </div>
          </>:<>
            <strong>—</strong>
            <small>{t("stats.noPersonalMatches")}</small>
          </>}
        </article>

        <article className={"statistics-detail-reading "+(selectedInterpretation?.tone||"neutral")}>
          <span>{t("stats.meaning")}</span>
          <strong>{selectedInterpretation?.title}</strong>
          <p>{selectedInterpretation?.body}</p>
          {selectedRow.personal&&<button onClick={()=>onEvidence(
            selectedRow.personal!.matchIds,
            categoryLabel+" · "+labelFor(category,selectedRow.id,staticData),
           )}>{t("stats.openEvidence")}</button>}
          <button className="statistics-shelf-button" onClick={()=>saveStatToShelf(selectedRow)}>
            {shelfSavedId===category+":"+selectedRow.id?t("stats.savedShelf"):t("stats.saveShelf")}
          </button>
        </article>
      </div>
    </section>}

    {loading&&<section className="panel meta-page-state">{t("stats.loading")}</section>}
    {!loading&&error&&<section className="panel meta-page-state error">{t("stats.loadFailed")}</section>}


    {!loading&&!error&&stats&&view==="stats"&&<section className="panel statistics-table-panel">
      <div className="statistics-table-head">
        <div><span>{t("stats.rank")}</span><span>{categoryLabel}</span></div>
        <span>{t("common.sample")}</span>
        <span>PICK</span>
        <span>{t("common.average")}</span>
        <span>TOP 4</span>
        <span>WIN</span>
        {hasProfile&&<span>{t("stats.you")}</span>}
      </div>

      <div className="statistics-table">
        {rows.map((row,index)=>{
          const label=labelFor(category,row.id,staticData);
          const image=imageFor(category,row.id,staticData);
          const personalRow=row.personal;
          const delta=personalRow?personalRow.averagePlacement-row.averagePlacement:null;

          return <article
            className={selectedEntityId===row.id?"selected":""}
            role="button"
            tabIndex={0}
            onClick={()=>setSelectedEntityId(row.id)}
            onKeyDown={event=>{
              if(event.key==="Enter"||event.key===" "){
                event.preventDefault();
                setSelectedEntityId(row.id);
              }
            }}
            key={row.id}
          >
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

            <span className={"statistics-sample "+sampleBand(row.games).tone} title={t(sampleBand(row.games).helpKey)}>
              <b>{row.games}</b><small>{t(sampleBand(row.games).labelKey)}</small>
            </span>
            <span><b>{row.pickRate}%</b><small>{t("stats.observed")}</small></span>
            <span><b>{row.averagePlacement}</b><small>{t("stats.placement")}</small></span>
            <span><b>{row.top4Rate}%</b><small>Top 4</small></span>
            <span><b>{row.winRate}%</b><small>{t("stats.victory")}</small></span>

            {hasProfile&&<div className="statistics-personal">
              {personalRow?<>
                <div>
                  <b>{personalRow.averagePlacement}</b>
                  <small>{personalRow.games} suas · Δ {signed(delta||0)}</small>
                </div>
                <button onClick={event=>{
                  event.stopPropagation();
                  onEvidence(personalRow.matchIds,categoryLabel+" · "+label);
                }}>{t("stats.view")}</button>
              </>:<small>{t("stats.noPersonalSample")}</small>}
            </div>}
          </article>;
        })}
      </div>

      {!rows.length&&<div className="meta-page-state">{t("stats.noResults")}</div>}

      <p className="global-meta-disclaimer">{t("stats.datasetDisclaimer")}</p>
    </section>}

    {!loading&&!error&&stats&&view==="tier"&&<section className="tier-list-shell">
      {(["S","A","B","C"] as const).map(tier=>(
        <article className={"tier-row tier-"+tier.toLowerCase()} key={tier}>
          <div className="tier-badge">{tier}</div>
          <div className="tier-entities">
            {tiers[tier].length?tiers[tier].map(row=>{
              const label=labelFor(category,row.id,staticData);
              const image=imageFor(category,row.id,staticData);
              return <button
                className="tier-entity"
                title={t("stats.tierTitle",{label,average:row.averagePlacement,games:row.games})}
                onClick={()=>{
                  setSelectedEntityId(row.id);
                  setView("stats");
                }}
                key={row.id}
              >
                <span>{image&&<img src={image} alt=""/>}</span>
                <strong>{label}</strong>
                <small>{t("stats.tierSmall",{average:row.averagePlacement,games:row.games,personal:row.personal?t("stats.tierPersonal",{average:row.personal.averagePlacement}):""})}</small>
              </button>;
            }):<span className="tier-empty">{t("stats.tierEmpty")}</span>}
          </div>
        </article>
      ))}

      <p className="global-meta-disclaimer">{t("stats.tierDisclaimer")}</p>
    </section>}
  </main>;
}
