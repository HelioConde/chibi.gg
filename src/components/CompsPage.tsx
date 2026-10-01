import { useEffect, useMemo, useState } from "react";
import { fetchTftComps, TftGlobalComp, TftGlobalComps, TftMatch } from "../api/tft";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";
import DDragonArt from "./DDragonArt";
import { saveStudyShelfItem } from "../studyShelf";
import { useI18n } from "../i18n";
import { SITE_IMAGES } from "../siteAssets";
import AdaptiveArtwork from "./AdaptiveArtwork";
import ArtworkRibbon from "./ArtworkRibbon";
import V2PanelAccent from "./V2PanelAccent";

type Props={
  staticData:TftStaticData|null;
  matches:TftMatch[];
  hasProfile:boolean;
  onBack:()=>void;
  onEvidence:(ids:string[],label:string)=>void;
  onOpenBuilder?:(unitIds:string[])=>void;
};

type ExploreMode="familiarity"|"confidence"|"stability"|"popularity";
type ConfidenceFilter="all"|"medium"|"high";

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

function traitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.traits,id)?.name||clean(id);
}

function unitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.name||clean(id);
}

function itemName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.items,id)?.name||clean(id);
}

function activeTraitIds(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,4)
    .map(trait=>trait.name);
}

function compName(comp:TftGlobalComp,staticData:TftStaticData|null,fallback:string){
  const names=comp.traits.slice(0,2).map(trait=>traitName(trait.id,staticData)).filter(Boolean);
  return names.join(" · ")||fallback;
}

function personalFit(comp:TftGlobalComp,matches:TftMatch[]){
  if(!matches.length) return {score:0,traitOverlap:0,unitOverlap:0,matchIds:[] as string[]};

  const personalTraitCounts=new Map<string,number>();
  const personalUnitCounts=new Map<string,number>();

  for(const match of matches){
    for(const trait of activeTraitIds(match)){
      personalTraitCounts.set(trait,(personalTraitCounts.get(trait)||0)+1);
    }
    for(const unit of match.units){
      personalUnitCounts.set(unit.characterId,(personalUnitCounts.get(unit.characterId)||0)+1);
    }
  }

  const traitOverlap=comp.traits.reduce(
    (sum,trait)=>sum+Math.min(1,(personalTraitCounts.get(trait.id)||0)/Math.max(1,matches.length*.25)),
    0,
  )/Math.max(1,comp.traits.length);

  const unitOverlap=comp.units.reduce(
    (sum,unit)=>sum+Math.min(1,(personalUnitCounts.get(unit.id)||0)/Math.max(1,matches.length*.2)),
    0,
  )/Math.max(1,comp.units.length);

  const matchIds=matches
    .filter(match=>{
      const traits=new Set(activeTraitIds(match));
      const units=new Set(match.units.map(unit=>unit.characterId));
      const sharedTraits=comp.traits.filter(row=>traits.has(row.id)).length;
      const sharedUnits=comp.units.filter(row=>units.has(row.id)).length;
      return sharedTraits>=1||sharedUnits>=3;
    })
    .map(match=>match.id);

  return {
    score:Math.round((traitOverlap*.68+unitOverlap*.32)*100),
    traitOverlap:Math.round(traitOverlap*100),
    unitOverlap:Math.round(unitOverlap*100),
    matchIds,
  };
}

function confidenceRank(value:TftGlobalComp["confidence"]){
  return value==="alta"?3:value==="média"?2:1;
}

function coreTraits(comp:TftGlobalComp){
  const strong=comp.traits.filter(row=>row.rate>=55).slice(0,3);
  return strong.length?strong:comp.traits.slice(0,2);
}

function coreUnits(comp:TftGlobalComp){
  const strong=comp.units.filter(row=>row.rate>=45).slice(0,5);
  return strong.length>=3?strong:comp.units.slice(0,5);
}

function median(values:number[]){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}

export default function CompsPage({
  staticData,
  matches,
  hasProfile,
  onBack,
  onEvidence,
  onOpenBuilder,
}:Props){
  const { t } = useI18n();
  const compLabel=(comp:TftGlobalComp)=>compName(comp,staticData,t("comps.observedComp"));
  const confidenceText=(value:TftGlobalComp["confidence"])=>t(
    value==="alta"?"common.confidence.high":value==="média"?"common.confidence.medium":"common.confidence.low"
  );
  const [queueId,setQueueId]=useState<number|null>(1100);
  const [data,setData]=useState<TftGlobalComps|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selectedCompId,setSelectedCompId]=useState<string|null>(null);
  const [shelfSavedId,setShelfSavedId]=useState<string>("");
  const [exploreMode,setExploreMode]=useState<ExploreMode>(hasProfile?"familiarity":"popularity");
  const [confidenceFilter,setConfidenceFilter]=useState<ConfidenceFilter>("all");

  useEffect(()=>{
    if(!hasProfile&&exploreMode==="familiarity")setExploreMode("popularity");
  },[hasProfile,exploreMode]);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError("");

    fetchTftComps(0,queueId,2,18)
      .then(result=>{if(!cancelled)setData(result);})
      .catch(err=>{
        if(!cancelled){
          setData(null);
          setError(err instanceof Error?err.message:t("comps.errorLoad"));
        }
      })
      .finally(()=>{if(!cancelled)setLoading(false);});

    return ()=>{cancelled=true;};
  },[queueId]);

  const enriched=useMemo(()=>{
    return (data?.comps||[]).map(comp=>({
      ...comp,
      fit:personalFit(comp,matches),
    }));
  },[data,matches]);

  const stabilityCutoff=useMemo(
    ()=>median(enriched.map(comp=>comp.volatility).filter(value=>value>0)),
    [enriched]
  );

  const popularityCutoff=useMemo(
    ()=>median(enriched.map(comp=>comp.games).filter(value=>value>0)),
    [enriched]
  );

  const explored=useMemo(()=>{
    let rows=enriched.filter(comp=>{
      if(confidenceFilter==="high")return comp.confidence==="alta";
      if(confidenceFilter==="medium")return comp.confidence==="alta"||comp.confidence==="média";
      return true;
    });

    rows=[...rows].sort((a,b)=>{
      if(exploreMode==="familiarity"){
        return b.fit.score-a.fit.score
          ||b.fit.matchIds.length-a.fit.matchIds.length
          ||confidenceRank(b.confidence)-confidenceRank(a.confidence)
          ||b.games-a.games;
      }
      if(exploreMode==="confidence"){
        return confidenceRank(b.confidence)-confidenceRank(a.confidence)
          ||b.games-a.games
          ||a.averagePlacement-b.averagePlacement;
      }
      if(exploreMode==="stability"){
        return a.volatility-b.volatility
          ||confidenceRank(b.confidence)-confidenceRank(a.confidence)
          ||b.games-a.games;
      }
      return b.games-a.games
        ||confidenceRank(b.confidence)-confidenceRank(a.confidence)
        ||a.averagePlacement-b.averagePlacement;
    });

    return rows;
  },[enriched,exploreMode,confidenceFilter]);

  const mostFamiliar=useMemo(
    ()=>hasProfile
      ?[...enriched].sort((a,b)=>b.fit.score-a.fit.score||b.fit.matchIds.length-a.fit.matchIds.length||b.games-a.games)[0]||null
      :null,
    [enriched,hasProfile]
  );

  const mostStable=useMemo(
    ()=>enriched.slice().sort((a,b)=>a.volatility-b.volatility||b.games-a.games)[0]||null,
    [enriched]
  );

  const mostPopular=useMemo(
    ()=>enriched.slice().sort((a,b)=>b.games-a.games)[0]||null,
    [enriched]
  );

  const emerging=useMemo(
    ()=>enriched.filter(comp=>comp.games>=3&&comp.games<20)
      .sort((a,b)=>a.averagePlacement-b.averagePlacement||b.top4Rate-a.top4Rate)[0]||null,
    [enriched]
  );

  const hero=mostFamiliar||mostPopular;
  const selectedComp=enriched.find(comp=>comp.id===selectedCompId)||hero||enriched[0]||null;
  const maturity=data
    ? data.sampleParticipants>=1000?"robusta"
      : data.sampleParticipants>=250?"crescendo"
      : "inicial"
    : "inicial";

  function saveCompToShelf(comp:typeof enriched[number]){
    saveStudyShelfItem({
      type:"comp",
      label:compLabel(comp),
      subtitle:t("comps.shelfSubtitle",{games:comp.games,average:comp.averagePlacement,top4:comp.top4Rate}),
      unitIds:comp.units.slice(0,8).map(unit=>unit.id),
    });
    setShelfSavedId(comp.id);
  }

  function familiarityCopy(comp:typeof enriched[number]){
    if(!hasProfile)return t("comps.familiar.noneProfile");
    if(!matches.length)return t("comps.familiar.noHistory");
    if(comp.fit.score>=60){
      return t("comps.familiar.high");
    }
    if(comp.fit.score>=30){
      return t("comps.familiar.medium");
    }
    return t("comps.familiar.low");
  }

  function spotCopy(comp:typeof enriched[number]){
    const traits=coreTraits(comp).slice(0,2).map(row=>traitName(row.id,staticData));
    const units=coreUnits(comp).slice(0,3).map(row=>unitName(row.id,staticData));
    const traitText=traits.filter(Boolean).join(" + ");
    const unitText=units.filter(Boolean).join(", ");

    if(traitText&&unitText){
      return t("comps.spot.both",{traits:traitText,units:unitText});
    }
    if(traitText){
      return t("comps.spot.traits",{traits:traitText});
    }
    return t("comps.spot.fallback");
  }

  function selectDecisionComp(comp:typeof enriched[number] | null){
    if(!comp)return;
    setSelectedCompId(comp.id);
    requestAnimationFrame(()=>requestAnimationFrame(()=>
      document.getElementById("comp-guide")?.scrollIntoView({behavior:"smooth",block:"start"})
    ));
  }

  return <main className="comps-page comps-page-v2">
    <section className="comps-hero page-hero-with-reference">
      <AdaptiveArtwork className="v2-hero-emblem v2-hero-emblem-comps" src={SITE_IMAGES.v2.icons[0]} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
      <AdaptiveArtwork className="page-reference-art page-reference-comps page-reference-v2-piece" src={SITE_IMAGES.v2.frames.squareSecondary} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>{t("common.backProfile")}</button>}
        <span className="eyebrow">{t("comps.eyebrow")}</span>
        <h1>{hasProfile?t("comps.hero.profile"):t("comps.hero.public")}<br/><em>{t("comps.hero.em")}</em></h1>
        <p>{hasProfile?t("comps.hero.profileDesc"):t("comps.hero.publicDesc")}</p>
        <DDragonArt
          staticData={staticData}
          setNumber={data?.context.setNumber}
          championIds={hero?.units.map(unit=>unit.id)||[]}
          variant="ribbon"
          label="Champions · Data Dragon"
        />
      </div>

      <div className={"meta-dataset-card "+maturity}>
        <V2PanelAccent kind="comps"/>
        <span>{t("meta.currentBase")}</span>
        <strong>{data?.sampleParticipants??0}</strong>
        <small>{t("meta.observedParticipants")}</small>
        <b>{t(maturity==="robusta"?"common.maturity.robust":maturity==="crescendo"?"common.maturity.growing":"common.maturity.initial")}</b>
      </div>
    </section>

    <ArtworkRibbon sources={[SITE_IMAGES.v2.icons[0],SITE_IMAGES.v2.mascots.boardAlt,SITE_IMAGES.v2.frames.squareSecondary]} className="comps-art-ribbon"/>

    <div className="meta-toolbar">
      <div>
        <button className={queueId===1100?"active":""} onClick={()=>setQueueId(1100)}>{t("common.rankQueue")}</button>
        <button className={queueId==null?"active":""} onClick={()=>setQueueId(null)}>{t("common.allQueues")}</button>
      </div>
      <span>{data?.context.setNumber
        ? t("comps.adaptiveGroups",{set:data.context.setNumber})
        : t("common.waitingData")}</span>
    </div>

    {loading&&<section className="panel meta-page-state">{t("comps.loading")}</section>}
    {!loading&&error&&<section className="panel meta-page-state error">{t("comps.loadFailed")}</section>}

    {!loading&&!error&&data&&<>
      {hero&&<section className="panel comp-answer-card comp-answer-card-v2">
        <V2PanelAccent kind="comps" className="v2-panel-accent-feature"/>
        <div className="comp-answer-copy">
          <span>{hasProfile?t("comps.mostFamiliar"):t("comps.mostObserved")}</span>
          <h2>{compLabel(hero)}</h2>
          <p>{hasProfile?familiarityCopy(hero):t("comps.observedBoardsCount",{games:hero.games})}</p>
          {data.sampleParticipants<250&&<div className="comp-sample-warning">
            {t("comps.smallSample")}
          </div>}

          <div className="comp-answer-actions">
            {hasProfile&&hero.fit.matchIds.length>0&&<button onClick={()=>onEvidence(hero.fit.matchIds,t("comps.familiarity")+" · "+compLabel(hero))}>{t("comps.relatedMatches")}</button>}
            {onOpenBuilder&&<button className="secondary" onClick={()=>onOpenBuilder(hero.units.slice(0,8).map(unit=>unit.id))}>{t("comps.openBuilder")}</button>}
          </div>
        </div>

        <div className="comp-answer-metrics comp-answer-metrics-v2">
          {hasProfile&&<div className="fit"><span>{t("comps.familiarity")}</span><strong>{hero.fit.score}</strong><small>{t("comps.relatedCount",{count:hero.fit.matchIds.length})}</small></div>}
          <div><span>{t("comps.globalSample")}</span><strong>{hero.games}</strong><small>{t("comps.observedBoards")}</small></div>
          <div><span>{t("common.average")}</span><strong>{hero.averagePlacement}</strong><small>{t("comps.finalSnapshot")}</small></div>
          <div><span>{t("comps.confidence")}</span><strong className="textual">{confidenceText(hero.confidence)}</strong><small>{t("comps.bySample")}</small></div>
        </div>

        <div className="comp-core-units">
          {hero.units.slice(0,8).map(unit=>{
            const entry=staticEntry(staticData?.champions,unit.id);
            const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
            return <div title={unitName(unit.id,staticData)} key={unit.id}>
              {image&&<img src={image} alt={unitName(unit.id,staticData)} loading="lazy" decoding="async"/>}
              <span>{Math.round(unit.rate)}%</span>
            </div>;
          })}
        </div>

        <div className="comp-guardrail">
          <strong>{t("comps.guardrail.title")}</strong>
          <span>{t("comps.guardrail.desc")}</span>
        </div>
      </section>}

      <section className="comp-decision-strip" aria-label={t("comps.quick.title")}>
        <div className="comp-decision-strip-head">
          <div>
            <span>CHIBI QUICK READ</span>
            <h2>{t("comps.quick.title")}</h2>
            <p>{t("comps.quick.desc")}</p>
          </div>
        </div>
        <div className="comp-decision-cards">
          {([
            {id:"stable",label:t("comps.quick.stable"),comp:mostStable,metric:mostStable?mostStable.volatility.toFixed(2):"—",hint:t("comps.stability")},
            {id:"popular",label:t("comps.quick.popular"),comp:mostPopular,metric:mostPopular?String(mostPopular.games):"—",hint:t("comps.games")},
            {id:"emerging",label:t("comps.quick.emerging"),comp:emerging,metric:emerging?String(emerging.averagePlacement):"—",hint:t("common.average")},
          ] as const).map(card=>(
            <button
              className={"comp-decision-card "+card.id+(selectedComp?.id===card.comp?.id?" active":"")}
              type="button"
              onClick={()=>selectDecisionComp(card.comp)}
              disabled={!card.comp}
              key={card.id}
            >
              <span>{card.label}</span>
              <strong>{card.comp?compLabel(card.comp):t("comps.noSignal")}</strong>
              <div><b>{card.metric}</b><small>{card.hint}</small></div>
              <em>{t("comps.quick.open")} →</em>
            </button>
          ))}
        </div>
      </section>

      {selectedComp&&<section className="panel comp-guide-panel comp-guide-panel-v2" id="comp-guide">
        <div className="comp-guide-head">
          <div>
            <span>{t("comps.guide")}</span>
            <h2>{compLabel(selectedComp)}</h2>
            <p>{t("comps.guide.desc")}</p>
          </div>
          <div className="comp-guide-context">
            <span>{t("comps.averageLevel")}</span><strong>{selectedComp.averageLevel}</strong>
            <span>{t("comps.finalGold")}</span><strong>{selectedComp.averageGold}g</strong>
            <button className="comp-shelf-button" onClick={()=>saveCompToShelf(selectedComp)}>
              {shelfSavedId===selectedComp.id?t("comps.savedShelf"):t("comps.saveShelf")}
            </button>
          </div>
        </div>

        <div className="comp-split-evidence">
          {hasProfile&&<article className="personal">
            <span>{t("comps.yourHistory")}</span>
            <strong>{t("comps.familiarScore",{score:selectedComp.fit.score})}</strong>
            <p>{familiarityCopy(selectedComp)}</p>
            <div>
              <small>{t("comps.knownTraits")} <b>{selectedComp.fit.traitOverlap}%</b></small>
              <small>{t("comps.knownUnits")} <b>{selectedComp.fit.unitOverlap}%</b></small>
              <small>{t("comps.related")} <b>{selectedComp.fit.matchIds.length}</b></small>
            </div>
          </article>}

          <article className="global">
            <span>{t("comps.globalSampleUpper")}</span>
            <strong>{t("comps.globalConfidence",{games:selectedComp.games,confidence:confidenceText(selectedComp.confidence)})}</strong>
            <p>{t("comps.globalSummary",{average:selectedComp.averagePlacement,top4:selectedComp.top4Rate,volatility:selectedComp.volatility})}</p>
            <small>{t("comps.globalDisclaimer")}</small>
          </article>
        </div>

        <div className="comp-guide-grid">
          <article>
            <span>{t("comps.routePieces")}</span>

            <div className="comp-spot-signals">
              <div>
                <small>{t("comps.coreTraits")}</small>
                <div>
                  {coreTraits(selectedComp).map(trait=>(
                    <span className="trait" key={trait.id}>
                      {traitName(trait.id,staticData)}
                      <b>{Math.round(trait.rate)}%</b>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <small>{t("comps.recurringUnits")}</small>
                <div>
                  {coreUnits(selectedComp).map(unit=>(
                    <span className="unit" key={unit.id}>
                      {unitName(unit.id,staticData)}
                      <b>{Math.round(unit.rate)}%</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="comp-guide-units">
              {selectedComp.units.slice(0,8).map(unit=>{
                const entry=staticEntry(staticData?.champions,unit.id);
                const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
                const unitItems=selectedComp.unitItems.find(row=>row.unitId===unit.id)?.items||[];
                return <div className="comp-guide-unit" key={unit.id}>
                  <span className="comp-guide-portrait">{image&&<img src={image} alt="" loading="lazy" decoding="async"/>}</span>
                  <div>
                    <strong>{unitName(unit.id,staticData)}</strong>
                    <small>{t("comps.presentRate",{rate:Math.round(unit.rate)})}</small>
                    <div className="comp-guide-items">
                      {unitItems.length?unitItems.map(itemStat=>{
                        const itemEntry=staticEntry(staticData?.items,itemStat.id);
                        const src=staticData?tftAssetUrl(staticData.version,"item",itemEntry):"";
                        return <span title={itemName(itemStat.id,staticData)+" · "+Math.round(itemStat.rate)+"%"} key={itemStat.id}>
                          {src&&<img src={src} alt="" loading="lazy" decoding="async"/>}
                        </span>;
                      } ):<em>{t("comps.noRecurringItem")}</em>}
                    </div>
                  </div>
                </div>;
              })}
            </div>
          </article>

          <article className="comp-guide-decision">
            <span>{t("comps.whenConsider")}</span>
            <strong>{spotCopy(selectedComp)}</strong>
            <p>{hasProfile?t("comps.profileUse"):t("comps.noProfileUse")}</p>

            <span className="avoid">{t("comps.whenNotForce")}</span>
            <strong>{t("comps.notForceTitle")}</strong>
            <p>{t("comps.notForceDesc")}</p>

            <div className="comp-guide-buttons">
              {hasProfile&&selectedComp.fit.matchIds.length>0&&<button onClick={()=>onEvidence(
                selectedComp.fit.matchIds,
                "Comp Guide · "+compLabel(selectedComp),
               )}>{t("comps.compareMine")}</button>}
              {onOpenBuilder&&<button className="secondary" onClick={()=>onOpenBuilder(selectedComp.units.slice(0,8).map(unit=>unit.id))}>
                {t("comps.testBuilder")}
              </button>}
            </div>
          </article>
        </div>
      </section>}

      <section className="panel comp-explorer comp-explorer-v2">
        <div className="meta-explorer-head">
          <div>
            <span>{t("comps.explore")}</span>
            <h2>{hasProfile?t("comps.chooseLens"):t("comps.compareSignals")}</h2>
          </div>
          <small>{t("comps.identities",{count:explored.length})}</small>
        </div>

        <div className="comp-explore-controls">
          <div className="comp-mode-tabs">
            {hasProfile&&<button className={exploreMode==="familiarity"?"active":""} onClick={()=>setExploreMode("familiarity")}>{t("comps.familiarity")}</button>}
            <button className={exploreMode==="confidence"?"active":""} onClick={()=>setExploreMode("confidence")}>{t("comps.confidence")}</button>
            <button className={exploreMode==="stability"?"active":""} onClick={()=>setExploreMode("stability")}>
              {t("comps.stability")}
              {stabilityCutoff>0&&<small>≤ {stabilityCutoff.toFixed(2)}</small>}
            </button>
            <button className={exploreMode==="popularity"?"active":""} onClick={()=>setExploreMode("popularity")}>
              {t("comps.popularity")}
              {popularityCutoff>0&&<small>{t("comps.median",{value:Math.round(popularityCutoff)})}</small>}
            </button>
          </div>

          <div className="comp-confidence-filter">
            <span>{t("comps.sample")}</span>
            <button className={confidenceFilter==="all"?"active":""} onClick={()=>setConfidenceFilter("all")}>{t("comps.all")}</button>
            <button className={confidenceFilter==="medium"?"active":""} onClick={()=>setConfidenceFilter("medium")}>{t("comps.mediumPlus")}</button>
            <button className={confidenceFilter==="high"?"active":""} onClick={()=>setConfidenceFilter("high")}>{t("comps.high")}</button>
          </div>
        </div>

        <div className="comp-list">
          {explored.map((comp,index)=>(
            <article className={"comp-row "+(selectedComp?.id===comp.id?"selected":"")} key={comp.id}>
              <div className="comp-rank">{index+1}</div>
              <div className="comp-row-main">
                <strong>{compLabel(comp)}</strong>
                <div className="trait-row">
                  {comp.traits.slice(0,3).map(trait=><span className="trait-chip" key={trait.id}>{traitName(trait.id,staticData)} {Math.round(trait.rate)}%</span>)}
                </div>
              </div>

              <div className="comp-row-metrics">
                {hasProfile&&<span className="fit"><small>{t("comps.familiarity")}</small><b>{comp.fit.score}</b></span>}
                <span><small>{t("common.average")}</small><b>{comp.averagePlacement}</b></span>
                <span><small>{t("comps.games")}</small><b>{comp.games}</b></span>
                <span><small>{t("comps.volatility")}</small><b>{comp.volatility}</b></span>
              </div>

              <div className="comp-row-actions">
                <div className={"meta-confidence "+(comp.confidence==="alta"?"high":comp.confidence==="média"?"medium":"low")}>{confidenceText(comp.confidence)}</div>
                <button onClick={()=>setSelectedCompId(comp.id)}>{t("comps.details")}</button>
              </div>
            </article>
          ))}
        </div>

        {!explored.length&&<div className="meta-page-state">
          {t("comps.filterEmpty")}
        </div>}

        <p className="global-meta-disclaimer">
          {t("comps.disclaimer")}
        </p>
      </section>
    </>}
  </main>;
}
