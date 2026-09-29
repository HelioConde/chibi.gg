import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildChibiSessionPlan } from "../analysis/chibiSessionPlan";
import {
  clearGoal,
  ChibiGoal,
  completeGoal,
  getGoal,
  getGoalHistory,
  goalOutcome,
  goalProgress,
  saveGoal,
  suggestGoal,
} from "../goals";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";
import { saveLesson } from "../lessons";
import { useI18n } from "../i18n";

type Props={
  playerKey:string;
  matches:TftMatch[];
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
  onOpenBuilder:(unitIds:string[])=>void;
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

function traitName(id:string|null,staticData:TftStaticData|null){
  if(!id)return "";
  return staticEntry(staticData?.traits,id)?.name||clean(id);
}

function unitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.name||clean(id);
}

function shortDate(value:number,locale:string){
  return new Date(value).toLocaleDateString(locale,{day:"2-digit",month:"2-digit"});
}

export default function ChibiSessionPlan({
  playerKey,
  matches,
  staticData,
  onEvidence,
  onOpenBuilder,
}:Props){
  const { t, locale }=useI18n();
  const plan=useMemo(()=>buildChibiSessionPlan(matches),[matches]);
  const [goal,setGoal]=useState<ChibiGoal|null>(()=>getGoal(playerKey));
  const [historyVersion,setHistoryVersion]=useState(0);

  useEffect(()=>{
    setGoal(getGoal(playerKey));
  },[playerKey]);

  const progress=useMemo(
    ()=>goal?goalProgress(goal,matches):null,
    [goal,matches],
  );
  const outcome=useMemo(
    ()=>goal?goalOutcome(goal,matches):null,
    [goal,matches],
  );
  const history=useMemo(()=>{
    void historyVersion;
    return getGoalHistory(playerKey);
  },[playerKey,historyVersion]);

  function startGoal(){
    const next=suggestGoal(playerKey,matches);
    saveGoal(next);
    setGoal(next);
  }

  function stopGoal(){
    clearGoal(playerKey);
    setGoal(null);
  }

  function finishGoal(){
    const record=completeGoal(playerKey,matches);
    if(!record)return;

    if(
      (record.outcome.verdict==="improved"||record.outcome.verdict==="worse")&&
      record.outcome.matchIds.length>0
    ){
      const direction=record.outcome.verdict==="improved"?"melhorou":"piorou";
      saveLesson(
        playerKey,
        record.outcome.matchIds[0],
        record.title+": "+record.outcome.metricLabel+" "+direction+" de "+record.outcome.metricBefore+" para "+record.outcome.metricAfter+". "+record.outcome.nextFocus,
        record.outcome.matchIds,
      );
    }

    setGoal(null);
    setHistoryVersion(value=>value+1);
  }

  const lineCard=(line:typeof plan.primary,kind:"primary"|"alternative")=>{
    if(!line)return <article className={"session-plan-line "+kind+" empty"}>
      <span>{kind==="primary"?t("sessionPlan.reference"):t("sessionPlan.alternative")}</span>
      <strong>{t("sessionPlan.insufficient")}</strong>
      <p>{t("sessionPlan.insufficientDesc")}</p>
    </article>;

    const title=line.traitId?traitName(line.traitId,staticData):line.label;

    return <article className={"session-plan-line "+kind}>
      <span>{kind==="primary"?t("sessionPlan.reference"):t("sessionPlan.alternativeStudy")}</span>
      <h3>{title||line.label}</h3>
      <p>{kind==="primary"?t("sessionPlan.primaryDesc"):t("sessionPlan.altDesc")}</p>

      <div className="session-plan-units">
        {line.unitIds.slice(0,6).map(id=>{
          const entry=staticEntry(staticData?.champions,id);
          const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
          return <span title={unitName(id,staticData)} key={id}>
            {image?<img src={image} alt={unitName(id,staticData)} onError={(event)=>{event.currentTarget.style.display="none";}}/>:<b>{unitName(id,staticData).slice(0,2)}</b>}
          </span>;
        })}
      </div>

      <div className="session-plan-line-stats">
        <span><small>{t("sessionPlan.games")}</small><b>{line.games}</b></span>
        <span><small>{t("sessionPlan.average")}</small><b>{line.avgPlacement??"—"}</b></span>
        <span><small>TOP 4</small><b>{line.top4Rate}%</b></span>
      </div>

      <div className="session-plan-line-actions">
        {line.matchIds.length>0&&<button onClick={()=>onEvidence(line.matchIds,"Plano da sessão · "+(title||line.label))}>{t("sessionPlan.viewHistory")}</button>}
        {line.unitIds.length>0&&<button className="primary" onClick={()=>onOpenBuilder(line.unitIds)}>{t("sessionPlan.prepareBuilder")}</button>}
      </div>
    </article>;
  };

  return <section className="panel chibi-session-plan">
    <div className="session-plan-head">
      <div>
        <span>NEXT SESSION PLAN</span>
        <h2>{t("sessionPlan.title")}</h2>
        <p>{t("sessionPlan.desc")}</p>
      </div>
      <div className="session-plan-count">
        <strong>{goal?progress?.played??0:0}/5</strong>
        <small>{goal?t("sessionPlan.tracked"):t("sessionPlan.notStarted")}</small>
      </div>
    </div>

    <article className="session-plan-focus">
      <div>
        <span>{t("sessionPlan.focus")}</span>
        <h3>{plan.focus.title}</h3>
        <p>{plan.focus.body}</p>
        <small>{t("sessionPlan.confidence",{evidence:plan.focus.evidence,confidence:t(plan.focus.confidence==="alta"?"common.confidence.high":plan.focus.confidence==="média"?"common.confidence.medium":"common.confidence.low")})}</small>
      </div>
      {plan.focus.matchIds.length>0&&<button onClick={()=>onEvidence(plan.focus.matchIds,"Plano da sessão · foco")}>{t("sessionPlan.reviewEvidence")}</button>}
    </article>

    <div className="session-plan-lines">
      {lineCard(plan.primary,"primary")}
      {lineCard(plan.alternative,"alternative")}
    </div>

    <div className="session-plan-rule">
      <strong>{t("sessionPlan.rule")}</strong>
      <span>{plan.rule}</span>
    </div>

    {outcome&&<section className={"session-outcome "+outcome.verdict}>
      <div className="session-outcome-head">
        <div>
          <span>{t("sessionPlan.result")}</span>
          <h3>{outcome.title}</h3>
          <p>{outcome.summary}</p>
        </div>
        <em>{outcome.achieved?t("sessionPlan.goalHit"):t("sessionPlan.goalMissed")}</em>
      </div>

      <div className="session-outcome-metrics">
        <article>
          <span>{t("sessionPlan.averagePlacement")}</span>
          <strong>{outcome.before.avgPlacement??"—"} <i>→</i> {outcome.after.avgPlacement??"—"}</strong>
          <small>{t("sessionPlan.beforeAfter",{before:outcome.before.sample,after:outcome.after.sample})}</small>
        </article>
        <article>
          <span>TOP 4</span>
          <strong>{outcome.before.top4Rate}% <i>→</i> {outcome.after.top4Rate}%</strong>
          <small>{t("sessionPlan.change",{value:(outcome.after.top4Rate-outcome.before.top4Rate>0?"+":"")+(outcome.after.top4Rate-outcome.before.top4Rate)+"%"})}</small>
        </article>
        <article>
          <span>BOTTOM 2</span>
          <strong>{outcome.before.bottom2Rate}% <i>→</i> {outcome.after.bottom2Rate}%</strong>
          <small>{t("sessionPlan.change",{value:(outcome.after.bottom2Rate-outcome.before.bottom2Rate>0?"+":"")+(outcome.after.bottom2Rate-outcome.before.bottom2Rate)+"%"})}</small>
        </article>
        <article className="focus">
          <span>{outcome.metricLabel}</span>
          <strong>{outcome.metricBefore} <i>→</i> {outcome.metricAfter}</strong>
          <small>Δ {outcome.metricDelta}</small>
        </article>
      </div>

      <div className="session-outcome-next">
        <div>
          <span>{t("sessionPlan.whatDo")}</span>
          <strong>{outcome.nextFocus}</strong>
          <small>{t("sessionPlan.signalNote")}</small>
        </div>
        <div>
          <button onClick={()=>onEvidence(outcome.matchIds,"Experimento · "+(goal?.title||"sessão"))}>{t("sessionPlan.reviewFive")}</button>
          <button className="primary" onClick={finishGoal}>{t("sessionPlan.finish")}</button>
        </div>
      </div>
    </section>}

    {!outcome&&<div className={"session-goal-inline "+(goal?"active":"idle")}>
      {!goal?<>
        <div>
          <span>{t("sessionPlan.tracking")}</span>
          <strong>{t("sessionPlan.makeExperiment")}</strong>
          <small>{t("sessionPlan.makeExperimentDesc")}</small>
        </div>
        <button onClick={startGoal}>{t("sessionPlan.start")}</button>
      </>:<>
        <div className="session-goal-copy">
          <span>{t("sessionPlan.active")}</span>
          <strong>{goal.title}</strong>
          <small>{goal.description}</small>
          <p>{progress?.detail}</p>
        </div>

        <div className="session-goal-progress">
          <div><i style={{width:Math.min(100,((progress?.played??0)/(goal.targetGames||5))*100)+"%"}}/></div>
          <span><b>{progress?.played??0}/{goal.targetGames}</b><small>{progress?.finished?(progress.achieved?t("sessionPlan.goalDone"):t("sessionPlan.sessionDone")):t("sessionPlan.inProgress")}</small></span>
        </div>

        <div className="session-goal-actions">
          {(progress?.matchIds?.length??0)>0&&<button onClick={()=>onEvidence(progress?.matchIds||[],"Meta da sessão · "+goal.title)}>{t("sessionPlan.viewMatches")}</button>}
          <button className="secondary" onClick={stopGoal}>{t("sessionPlan.stop")}</button>
        </div>
      </>}
    </div>}

    {history.length>0&&<details className="session-experiment-history">
      <summary>
        <span><b>{t("sessionPlan.previous")}</b><small>{t("sessionPlan.savedResults",{count:history.length})}</small></span>
        <em>{t("sessionPlan.history")}</em>
      </summary>
      <div className="session-history-list">
        {history.slice(0,5).map(record=>(
          <article className={record.outcome.verdict} key={record.id}>
            <div>
              <span>{shortDate(record.completedAt,locale)} · {record.title}</span>
              <strong>{record.outcome.title}</strong>
              <small>{record.outcome.metricLabel}: {record.outcome.metricBefore} → {record.outcome.metricAfter}</small>
            </div>
            <button onClick={()=>onEvidence(record.outcome.matchIds,t("sessionPlan.savedEvidence",{title:record.title}))}>{t("sessionPlan.viewMatches")}</button>
          </article>
        ))}
      </div>
    </details>}
  </section>;
}
