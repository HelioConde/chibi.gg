import { useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildActionPlan } from "../analysis/actionPlan";
import { getGoal, goalProgress, saveGoal, suggestGoal, ChibiGoal } from "../goals";

type Props={
  playerKey:string;
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
};

export default function ChibiActionCenter({playerKey,matches,onEvidence}:Props){
  const plan=useMemo(()=>buildActionPlan(matches),[matches]);
  const [goal,setGoal]=useState<ChibiGoal|null>(()=>getGoal(playerKey));
  const progress=useMemo(()=>goal?goalProgress(goal,matches):null,[goal,matches]);

  function startGoal(){
    const next=suggestGoal(playerKey,matches);
    saveGoal(next);
    setGoal(next);
  }

  return <section className="panel action-center">
    <div className="action-center-head">
      <div>
        <span>CHIBI ACTION CENTER</span>
        <h2>O que deu errado e o que fazer agora</h2>
      </div>
      <small>{matches.length} partidas</small>
    </div>

    <div className="action-center-grid">
      <article className="action-problem">
        <div className="action-step-label">
          <b>1</b>
          <span>O QUE DEU ERRADO</span>
        </div>
        <div className="action-title-row">
          <h3>{plan.problem.title}</h3>
          <em>{plan.problem.confidence}</em>
        </div>
        <p>{plan.problem.body}</p>
        <div className="action-evidence">
          <strong>{plan.problem.evidence}</strong>
          {plan.problem.matchIds.length>0&&<button onClick={()=>onEvidence(plan.problem.matchIds,"Action Center · problema principal")}>Ver partidas</button>}
        </div>
      </article>

      <article className="action-now">
        <div className="action-step-label">
          <b>2</b>
          <span>FAÇA ISSO AGORA</span>
        </div>
        <h3>{plan.action.title}</h3>
        <ol>
          {plan.action.steps.map((step,index)=><li key={index}><span>{index+1}</span><p>{step}</p></li>)}
        </ol>
        <div className="action-avoid">
          <span>EVITE</span>
          <p>{plan.action.avoid}</p>
        </div>
      </article>

      <article className="action-measure">
        <div className="action-step-label">
          <b>3</b>
          <span>COMO SABER SE MELHOROU</span>
        </div>
        <h3>{plan.success.title}</h3>
        <p className="action-metric">{plan.success.metric}</p>

        {goal?(
          <div className="action-goal-progress">
            <div className="action-goal-bar"><i style={{width:Math.min(100,((progress?.played||0)/(goal.targetGames||5))*100)+"%"}}/></div>
            <div className="action-goal-meta">
              <span>{progress?.played||0}/{goal.targetGames} partidas</span>
              <strong>{progress?.detail||goal.description}</strong>
            </div>
            <small>{progress?.finished?(progress.achieved?"Objetivo atingido":"Objetivo concluído sem bater a meta"):"Objetivo em andamento"}</small>
          </div>
        ):(
          <button className="action-start-goal" onClick={startGoal}>Acompanhar nas próximas 5 partidas</button>
        )}
      </article>
    </div>
  </section>;
}
