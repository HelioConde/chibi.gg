import { useEffect, useMemo, useState } from "react";
import { fetchTftMeta, TftGlobalMeta, TftGlobalTraitStat } from "../api/tft";
import { staticEntry, TftStaticData } from "../tftStatic";
import DDragonArt from "./DDragonArt";
import { useI18n } from "../i18n";

type Props={
  staticData:TftStaticData|null;
  hasProfile:boolean;
  onBack:()=>void;
  onOpenComps?:()=>void;
  onOpenStats?:()=>void;
  onOpenTier?:()=>void;
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

function traitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.traits,id)?.name||clean(id);
}

function confidence(games:number){
  if(games>=50) return {label:"alta",className:"high"};
  if(games>=20) return {label:"média",className:"medium"};
  return {label:"inicial",className:"low"};
}

function score(row:TftGlobalTraitStat){
  const sample=Math.min(1,row.games/50);
  const placement=Math.max(0,Math.min(1,(8.5-row.averagePlacement)/7.5));
  const top4=Math.max(0,Math.min(1,row.top4Rate/100));
  return placement*.45+top4*.35+sample*.2;
}

export default function GlobalMetaPage({
  staticData,
  hasProfile,
  onBack,
  onOpenComps,
  onOpenStats,
  onOpenTier,
}:Props){
  const { t } = useI18n();
  const [queueId,setQueueId]=useState<number|null>(1100);
  const [meta,setMeta]=useState<TftGlobalMeta|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError("");

    fetchTftMeta(0,queueId,2,50)
      .then(data=>{if(!cancelled)setMeta(data);})
      .catch(err=>{
        if(!cancelled){
          setMeta(null);
          setError(err instanceof Error?err.message:t("meta.errorLoad"));
        }
      })
      .finally(()=>{if(!cancelled)setLoading(false);});

    return ()=>{cancelled=true;};
  },[queueId]);

  const rows=useMemo(
    ()=>meta?.traits.slice().sort((a,b)=>score(b)-score(a)||b.games-a.games)||[],
    [meta]
  );

  const mostObserved=useMemo(
    ()=>rows.slice().sort((a,b)=>b.games-a.games)[0]||null,
    [rows]
  );

  const established=useMemo(
    ()=>rows.filter(row=>row.games>=20).sort((a,b)=>a.averagePlacement-b.averagePlacement||b.games-a.games)[0]||null,
    [rows]
  );

  const emerging=useMemo(
    ()=>rows.filter(row=>row.games>=5&&row.games<20).sort((a,b)=>a.averagePlacement-b.averagePlacement||b.top4Rate-a.top4Rate)[0]||null,
    [rows]
  );

  const maturity=meta
    ? meta.sampleParticipants>=1000?"robusta"
      : meta.sampleParticipants>=250?"crescendo"
      : "inicial"
    : "inicial";

  return <main className="global-meta-page">
    <div className="global-meta-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>{t("common.backProfile")}</button>}
        <span className="eyebrow">CHIBI DATASET</span>
        <h1>{t("meta.hero.title1")}<br/><em>{t("meta.hero.title2")}</em></h1>
        <p>{t("meta.hero.desc")}</p>
        <DDragonArt
          staticData={staticData}
          setNumber={meta?.context.setNumber}
          variant="ribbon"
          label={t("meta.riotAssets")}
        />
      </div>

      <div className={"meta-dataset-card "+maturity}>
        <span>{t("meta.currentBase")}</span>
        <strong>{meta?.sampleParticipants??0}</strong>
        <small>{t("meta.observedParticipants")}</small>
        <b>{t(maturity==="robusta"?"common.maturity.robust":maturity==="crescendo"?"common.maturity.growing":"common.maturity.initial")}</b>
      </div>
    </div>

    <section className="meta-hub-links">
      <button className="active">
        <span>{t("meta.overview")}</span>
        <strong>{t("meta.now")}</strong>
        <small>{t("meta.datasetSignals")}</small>
      </button>
      <button onClick={onOpenComps}>
        <span>COMPS</span>
        <strong>{t("meta.observedBoards")}</strong>
        <small>{t("meta.personalCompatibility")}</small>
      </button>
      <button onClick={onOpenStats}>
        <span>{t("meta.statistics")}</span>
        <strong>{t("meta.statsTitle")}</strong>
        <small>{t("meta.statsDesc")}</small>
      </button>
      <button onClick={onOpenTier}>
        <span>{t("meta.tierList")}</span>
        <strong>S / A / B / C</strong>
        <small>{t("meta.tierDesc")}</small>
      </button>
    </section>

    <div className="meta-toolbar">
      <div>
        <button className={queueId===1100?"active":""} onClick={()=>setQueueId(1100)}>{t("common.rankQueue")}</button>
        <button className={queueId==null?"active":""} onClick={()=>setQueueId(null)}>{t("common.allQueues")}</button>
      </div>
      <span>{meta?.context.setNumber?("Set "+meta.context.setNumber):t("common.waitingData")}</span>
    </div>

    {loading&&<section className="panel meta-page-state">{t("meta.loading")}</section>}
    {!loading&&error&&<section className="panel meta-page-state error">{t("meta.loadFailed")}</section>}

    {!loading&&!error&&meta&&<>
      <section className="meta-signal-grid">
        <article className="panel">
          <span>{t("meta.mostObserved")}</span>
          <h2>{mostObserved?traitName(mostObserved.id,staticData):t("common.noSample")}</h2>
          <p>{mostObserved?t("meta.rowSummary",{games:mostObserved.games,average:mostObserved.averagePlacement,top4:mostObserved.top4Rate}):t("meta.datasetStarting")}</p>
        </article>

        <article className="panel established">
          <span>{t("meta.established")}</span>
          <h2>{established?traitName(established.id,staticData):t("common.notAvailableYet")}</h2>
          <p>{established?t("meta.rowSummary",{games:established.games,average:established.averagePlacement,top4:established.top4Rate}):t("meta.need20")}</p>
        </article>

        <article className="panel emerging">
          <span>{t("meta.emerging")}</span>
          <h2>{emerging?traitName(emerging.id,staticData):t("common.notAvailableYet")}</h2>
          <p>{emerging?t("meta.rowSummary",{games:emerging.games,average:emerging.averagePlacement,top4:emerging.top4Rate}):t("meta.noEmerging")}</p>
        </article>
      </section>

      <section className="panel meta-explorer">
        <div className="meta-explorer-head">
          <div>
            <span>{t("meta.explorer")}</span>
            <h2>{t("meta.observedTraits")}</h2>
          </div>
          <small>{t("meta.sortedComposite")}</small>
        </div>

        <div className="meta-table-head">
          <span>{t("meta.trait")}</span><span>{t("common.sample")}</span><span>{t("common.average")}</span><span>{t("meta.top4")}</span><span>{t("common.win")}</span><span>{t("common.level")}</span><span>{t("common.confidence")}</span>
        </div>

        <div className="meta-table">
          {rows.map(row=>{
            const conf=confidence(row.games);
            return <article key={row.id}>
              <div className="meta-trait-name">
                <strong>{traitName(row.id,staticData)}</strong>
                <small>{row.id}</small>
              </div>
              <b>{row.games}</b>
              <b>{row.averagePlacement}</b>
              <b>{row.top4Rate}%</b>
              <b>{row.winRate}%</b>
              <b>{row.averageLevel}</b>
              <span className={"meta-confidence "+conf.className}>{t(conf.className==="high"?"common.confidence.high":conf.className==="medium"?"common.confidence.medium":"common.confidence.low")}</span>
            </article>;
          })}
        </div>

        {!rows.length&&<div className="meta-page-state">{t("meta.notEnough")}</div>}

        <p className="global-meta-disclaimer">
          {t("meta.disclaimer")}
        </p>
      </section>
    </>}
  </main>;
}
