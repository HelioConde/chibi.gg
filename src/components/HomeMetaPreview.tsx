import { useEffect, useRef, useState } from "react";
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
import { useI18n } from "../i18n";

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
  const { t, language } = useI18n();
  const [stats,setStats]=useState<TftGlobalStats|null>(null);
  const [comps,setComps]=useState<TftGlobalComps|null>(null);
  const [loadState,setLoadState]=useState<"loading"|"ready"|"error">("loading");
  const [statsFailed,setStatsFailed]=useState(false);
  const [compsFailed,setCompsFailed]=useState(false);
  const [reloadKey,setReloadKey]=useState(0);
  const containerRef=useRef<HTMLElement|null>(null);
  const [visible,setVisible]=useState(false);

  // Data below the hero should not compete for bandwidth with the initial paint.
  useEffect(()=>{
    if(visible)return;
    const node=containerRef.current;
    if(!node)return;
    if(typeof IntersectionObserver==="undefined"){
      setVisible(true);
      return;
    }
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        setVisible(true);
        observer.disconnect();
      }
    },{rootMargin:"700px 0px"});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[visible]);

  useEffect(()=>{
    if(!visible)return;
    let cancelled=false;
    setLoadState("loading");
    setStatsFailed(false);
    setCompsFailed(false);
    setStats(null);
    setComps(null);
    Promise.allSettled([
      fetchTftStats(0,1100,4,20),
      fetchTftComps(0,1100,4,8),
    ]).then(results=>{
      if(cancelled)return;
      const [statsResult,compsResult]=results;
      if(statsResult.status==="fulfilled")setStats(statsResult.value);
      else setStatsFailed(true);
      if(compsResult.status==="fulfilled")setComps(compsResult.value);
      else setCompsFailed(true);
      setLoadState(
        statsResult.status==="rejected"&&compsResult.status==="rejected"
          ?"error"
          :"ready"
      );
    });
    return ()=>{cancelled=true;};
  },[reloadKey,visible]);

  const topTraits=stats?.traits.slice(0,3)||[];
  const topComps=comps?.comps.slice(0,3)||[];

  return <section ref={containerRef} className="home-meta-preview home-meta-preview-v2">
    <div className="home-meta-intro-v2">
      <div className="home-meta-titleblock">
        <div className="home-meta-kickerline">
          <span className="home-section-index">03</span>
          <span>{t("metaPreview.kicker")}</span>
        </div>
        <h2>{t("metaPreview.title")}</h2>
        <p>{t("metaPreview.desc")}</p>
      </div>
      <button onClick={onOpenMeta}>{t("metaPreview.open")}</button>
    </div>

    <div className="home-meta-grid-v2">
      <article className="home-meta-simple-card">
        <div className="home-meta-simple-head">
          <div>
            <span>{t("metaPreview.topComps")}</span>
            <strong>{t("metaPreview.observedBoards")}</strong>
          </div>
          <button onClick={onOpenComps}>{t("metaPreview.all")}</button>
        </div>
        <div className="home-meta-simple-list">
          {topComps.length?topComps.map((comp,index)=>(
            <button onClick={onOpenComps} key={comp.id}>
              <b>{index+1}</b>
              <span>
                <strong>{comp.traits.slice(0,2).map(row=>label("traits",row.id,staticData)).join(" · ")||t("metaPreview.observedComp")}</strong>
                <small>{t("metaPreview.gamesAverage",{games:comp.games,average:comp.averagePlacement})}</small>
              </span>
              <em>{comp.games>=8?comp.top4Rate+"%":t("metaPreview.sample")}</em>
            </button>
          )):compsFailed
            ?<div className="home-meta-error" role="alert" aria-live="assertive">
              <span>{language==="en"?"Compositions are temporarily unavailable.":"Não foi possível carregar as comps agora."}</span>
              <button onClick={()=>setReloadKey(value=>value+1)}>{language==="en"?"Try again":"Tentar novamente"}</button>
            </div>
            :loadState==="ready"
              ?<div className="home-meta-empty" role="status">{language==="en"?"No compositions recorded for this selection yet.":"Ainda não há composições observadas para esta seleção."}</div>
            :<div className="home-meta-skeleton-list" role="status" aria-live="polite" aria-label="Carregando comps observadas">
              {[0,1,2].map(index=><span className="home-meta-skeleton-row" key={index}><i/><b/><em/></span>)}
            </div>}
        </div>
      </article>

      <article className="home-meta-simple-card">
        <div className="home-meta-simple-head">
          <div>
            <span>{t("metaPreview.strongTraits")}</span>
            <strong>{t("metaPreview.observedSynergies")}</strong>
          </div>
          <button onClick={()=>onOpenStats("traits")}>{t("metaPreview.all")}</button>
        </div>
        <div className="home-meta-simple-list traits">
          {topTraits.length?topTraits.map((row,index)=>{
            const name=label("traits",row.id,staticData);
            const src=image("traits",row.id,staticData);
            return <button onClick={()=>onOpenStats("traits",name)} key={row.id}>
              <b>{index+1}</b>
              <span className="home-meta-trait-copy">
                <i>{src&&<img src={src} alt=""/>}</i>
                <span>
                  <strong>{name}</strong>
                  <small>{t("metaPreview.gamesAverage",{games:row.games,average:row.averagePlacement})}</small>
                </span>
              </span>
              <em>{row.games>=8?row.top4Rate+"%":t("metaPreview.sample")}</em>
            </button>;
          }):statsFailed
            ?<div className="home-meta-error" role="alert" aria-live="assertive">
              <span>{language==="en"?"Trait statistics are temporarily unavailable.":"Não foi possível carregar as características agora."}</span>
              <button onClick={()=>setReloadKey(value=>value+1)}>{language==="en"?"Try again":"Tentar novamente"}</button>
            </div>
            :loadState==="ready"
              ?<div className="home-meta-empty" role="status">{language==="en"?"No traits recorded for this selection yet.":"Ainda não há características observadas para esta seleção."}</div>
            :<div className="home-meta-skeleton-list" role="status" aria-live="polite" aria-label="Carregando traits">
              {[0,1,2].map(index=><span className="home-meta-skeleton-row" key={index}><i/><b/><em/></span>)}
            </div>}
        </div>
      </article>
    </div>

    <small className="home-meta-disclaimer-v2">{t("metaPreview.disclaimer")}</small>
  </section>;
}
