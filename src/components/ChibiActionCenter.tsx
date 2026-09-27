import { useEffect, useMemo, useState } from "react";
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
        <span>SEU FOCO AGORA</span>
        <h2>O que importa antes da próxima fila</h2>
      </div>
      <small>{matches.length} partidas analisadas</small>
    </div>

    <div className="focus-hero">
      <article className="focus-problem">
        <span className="focus-kicker">O QUE ESTÁ SEGURANDO SEU RESULTADO</span>
        <div className="focus-title-row">
          <h3>{plan.problem.title}</h3>
          <em>{plan.problem.confidence}</em>
        </div>
        <p>{plan.problem.body}</p>
        <div className="focus-evidence">
          <strong>{plan.problem.evidence}</strong>
          {plan.problem.matchIds.length>0&&<button onClick={()=>onEvidence(plan.problem.matchIds,"Foco atual · problema principal")}>Ver partidas relacionadas</button>}
        </div>
      </article>

      <article className="focus-next">
        <span className="focus-kicker">FAÇA ISSO AGORA</span>
        <h3>{plan.action.title}</h3>
        <ol>
          {plan.action.steps.map((step,index)=><li key={index}><span>{index+1}</span><p>{step}</p></li>)}
        </ol>
        <details className="focus-avoid">
          <summary>O que evitar</summary>
          <p>{plan.action.avoid}</p>
        </details>
      </article>
    </div>

    <div className="focus-measure">
      <div>
        <span>COMO SABER SE MELHOROU</span>
        <h3>{plan.success.title}</h3>
        <p>{plan.success.metric}</p>
      </div>

      {goal?(
        <div className="focus-goal-progress">
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
    </div>
  </section>;
}
