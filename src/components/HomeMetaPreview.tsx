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
  const { t } = useI18n();
  const [stats,setStats]=useState<TftGlobalStats|null>(null);
  const [comps,setComps]=useState<TftGlobalComps|null>(null);

  useEffect(()=>{
    let cancelled=false;
    Promise.allSettled([
      fetchTftStats(0,1100,4,20),
      fetchTftComps(0,1100,4,8),
    ]).then(results=>{
      if(cancelled)return;
      const [statsResult,compsResult]=results;
      if(statsResult.status==="fulfilled")setStats(statsResult.value);
      if(compsResult.status==="fulfilled")setComps(compsResult.value);
    });
    return ()=>{cancelled=true;};
  },[]);

  const topTraits=stats?.traits.slice(0,3)||[];
  const topComps=comps?.comps.slice(0,3)||[];

  return <section className="home-meta-preview home-meta-preview-v2">
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
          )):<div className="home-meta-loading">{t("metaPreview.building")}</div>}
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
          }):<div className="home-meta-loading">{t("metaPreview.loadingTraits")}</div>}
        </div>
      </article>
    </div>

    <small className="home-meta-disclaimer-v2">{t("metaPreview.disclaimer")}</small>
  </section>;
}
