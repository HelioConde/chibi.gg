import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildLeakMap, buildPersonalMeta } from "../analysis/chibiProduct";
import { useI18n } from "../i18n";
import { getActiveSession, sessionProgress } from "../sessionMode";
import { staticEntry, TftStaticData } from "../tftStatic";

type Props={
  playerKey:string;
  matches:TftMatch[];
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
  onOpenCoach:()=>void;
  onOpenOverview:()=>void;
};

function avg(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}

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

function problemKey(id:string|undefined){
  if(id==="bottom2") return "bottom2";
  if(id==="conversion") return "conversion";
  if(id==="dominance") return "dominance";
  if(id==="level-conversion") return "level";
  return "none";
}

export default function ChibiToday({
  playerKey,
  matches,
  staticData,
  onEvidence,
  onOpenCoach,
  onOpenOverview,
}:Props){
  const { t }=useI18n();
  const [sessionVersion,setSessionVersion]=useState(0);

  useEffect(()=>{
    const refresh=()=>setSessionVersion(value=>value+1);
    window.addEventListener("chibi:session-change",refresh);
    return ()=>window.removeEventListener("chibi:session-change",refresh);
  },[]);

  const valid=useMemo(
    ()=>matches.filter(match=>match.placement>=1&&match.placement<=8),
    [matches],
  );
  const meta=useMemo(()=>buildPersonalMeta(valid),[valid]);
  const leaks=useMemo(()=>buildLeakMap(valid),[valid]);

  const moment=useMemo(()=>{
    const recent=valid.slice(0,Math.min(5,valid.length));
    const recentAvg=avg(recent.map(match=>match.placement));
    const recentTop4=recent.filter(match=>match.placement<=4).length;
    const previous=valid.slice(recent.length,recent.length*2);
    const previousAvg=previous.length>=3?avg(previous.map(match=>match.placement)):null;
    const delta=recentAvg!=null&&previousAvg!=null?recentAvg-previousAvg:null;
    const tone=delta==null?"neutral":delta<-.25?"good":delta>.25?"bad":"neutral";
    const title=delta==null
      ? t("today.moment.initial")
      : delta<-.25
        ? t("today.moment.better")
        : delta>.25
          ? t("today.moment.worse")
          : t("today.moment.stable");
    return {
      title,
      tone,
      avg:recentAvg,
      top4:recentTop4,
      games:recent.length,
      ids:[...recent,...previous].map(match=>match.id),
      comparable:previousAvg!=null,
    };
  },[valid,t]);

  const best=meta[0]||null;
  const problem=leaks.primary;
  const problemName=t("today.problem."+problemKey(problem?.id));

  const activeSession=useMemo(()=>{
    void sessionVersion;
    return getActiveSession(playerKey);
  },[playerKey,sessionVersion]);

  const activeProgress=useMemo(
    ()=>activeSession?sessionProgress(activeSession,valid):null,
    [activeSession,valid],
  );

  const action=useMemo(()=>{
    if(activeSession){
      return {
        title:t("today.action.session"),
        body:t("today.action.sessionBody",{
          played:activeProgress?.played||0,
          target:activeSession.targetGames,
        }),
        button:t("today.action.openSession"),
        open:onOpenOverview,
      };
    }

    const id=problemKey(problem?.id);
    return {
      title:t("today.action."+id),
      body:t("today.action."+id+"Body"),
      button:t("today.action.openCoach"),
      open:onOpenCoach,
    };
  },[activeSession,activeProgress,problem,onOpenCoach,onOpenOverview,t]);

  if(!valid.length)return null;

  return <section className="today-tft" aria-labelledby="today-tft-title">
    <div className="today-tft-head">
      <div>
        <span>{t("today.kicker")}</span>
        <h2 id="today-tft-title">{t("today.title")}</h2>
        <p>{t("today.desc")}</p>
      </div>
      <small>{t("today.sample",{count:valid.length})}</small>
    </div>

    <div className="today-tft-grid">
      <article className={"today-card moment "+moment.tone}>
        <span>{t("today.moment.label")}</span>
        <h3>{moment.title}</h3>
        <p>{moment.avg==null
          ? t("today.moment.noData")
          : t("today.moment.detail",{
              average:moment.avg.toFixed(2),
              top4:moment.top4,
              games:moment.games,
            })}</p>
        {moment.ids.length>0&&<button onClick={()=>onEvidence(moment.ids,t("today.moment.evidence"))}>
          {moment.comparable?t("today.compareBlocks"):t("today.viewRecent")}
        </button>}
      </article>

      <article className="today-card strength">
        <span>{t("today.strength.label")}</span>
        <h3>{best?traitName(best.id,staticData):t("today.strength.initial")}</h3>
        <p>{best
          ? t("today.strength.detail",{
              average:best.avgPlacement,
              top4:best.top4Rate,
              games:best.games,
            })
          : t("today.strength.noData")}</p>
        {best&&<button onClick={()=>onEvidence(best.matchIds,t("today.strength.evidence"))}>{t("today.viewEvidence")}</button>}
      </article>

      <article className={"today-card attention "+(problem?"warning":"neutral")}>
        <span>{t("today.problem.label")}</span>
        <h3>{problemName}</h3>
        <p>{problem
          ? t("today.problem.detail",{
              count:problem.matchIds.length,
              confidence:t("today.confidence."+problem.confidence),
            })
          : t("today.problem.noData")}</p>
        {problem&&problem.matchIds.length>0&&<button onClick={()=>onEvidence(problem.matchIds,t("today.problem.evidence"))}>{t("today.investigate")}</button>}
      </article>

      <article className={"today-card next "+(activeSession?"active":"")}>
        <span>{activeSession?t("today.action.activeLabel"):t("today.action.label")}</span>
        <h3>{action.title}</h3>
        <p>{action.body}</p>
        <button className="primary" onClick={action.open}>{action.button}</button>
      </article>
    </div>

    <div className="today-tft-foot">
      <span>{t("today.foot")}</span>
      <button onClick={onOpenCoach}>{t("today.openFullReview")}</button>
    </div>
  </section>;
}
