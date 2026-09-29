import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildActionPlan } from "../analysis/actionPlan";
import { getGoal, goalProgress, saveGoal, suggestGoal, ChibiGoal } from "../goals";
import { useI18n } from "../i18n";

type Props={
  playerKey:string;
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
  onReviewQueue?:()=>void;
};

export default function ChibiActionCenter({playerKey,matches,onEvidence,onReviewQueue}:Props){
  const { t }=useI18n();
  const plan=useMemo(()=>buildActionPlan(matches,t),[matches,t]);
  const [goal,setGoal]=useState<ChibiGoal|null>(()=>getGoal(playerKey));

  useEffect(()=>{
    setGoal(getGoal(playerKey));
  },[playerKey]);

  const progress=useMemo(()=>goal?goalProgress(goal,matches):null,[goal,matches]);

  function startGoal(){
    const next=suggestGoal(playerKey,matches);
    saveGoal(next);
    setGoal(next);
  }

  return <section className="panel action-center action-center-v2">
    <div className="action-center-head">
      <div>
        <span>{t("actionCenter.focus")}</span>
        <h2>{t("actionCenter.title")}</h2>
      </div>
      <small>{t("actionCenter.matches",{count:matches.length})}</small>
    </div>

    <div className="focus-hero">
      <article className="focus-problem">
        <span className="focus-kicker">{t("actionCenter.problem")}</span>
        <div className="focus-title-row">
          <h3>{plan.problem.title}</h3>
          <em>{t(plan.problem.confidence==="alta"?"action.confidence.high":plan.problem.confidence==="média"?"action.confidence.medium":"action.confidence.low")}</em>
        </div>
        <p>{plan.problem.body}</p>
        <div className="focus-evidence">
          <strong>{plan.problem.evidence}</strong>
          {plan.problem.matchIds.length>0&&<button onClick={()=>onEvidence(plan.problem.matchIds,"Foco atual · problema principal")}>{t("actionCenter.related")}</button>}
        </div>
      </article>

      <article className="focus-next">
        <span className="focus-kicker">{t("actionCenter.doNow")}</span>
        <h3>{plan.action.title}</h3>
        <ol>
          {plan.action.steps.map((step,index)=><li key={index}><span>{index+1}</span><p>{step}</p></li>)}
        </ol>
        <details className="focus-avoid">
          <summary>{t("actionCenter.avoid")}</summary>
          <p>{plan.action.avoid}</p>
        </details>
      </article>
    </div>

    <div className="focus-measure">
      <div>
        <span>{t("actionCenter.measure")}</span>
        <h3>{plan.success.title}</h3>
        <p>{plan.success.metric}</p>
      </div>

      {goal?(
        <div className="focus-goal-progress">
          <div className="action-goal-bar"><i style={{width:Math.min(100,((progress?.played||0)/(goal.targetGames||5))*100)+"%"}}/></div>
          <div className="action-goal-meta">
            <span>{t("actionCenter.goalMatches",{played:progress?.played||0,target:goal.targetGames})}</span>
            <strong>{progress?.detail||goal.description}</strong>
          </div>
          <small>{progress?.finished?(progress.achieved?t("actionCenter.achieved"):t("actionCenter.completed")):t("actionCenter.inProgress")}</small>
        </div>
      ):(
        <button className="action-start-goal" onClick={startGoal}>{t("actionCenter.start")}</button>
      )}
    </div>
  </section>;
}
