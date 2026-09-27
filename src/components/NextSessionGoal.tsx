import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { clearGoal, ChibiGoal, getGoal, goalProgress, saveGoal, suggestGoal } from "../goals";

type Props={
  playerKey:string;
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
};

export default function NextSessionGoal({playerKey,matches,onEvidence}:Props){
  const [goal,setGoal]=useState<ChibiGoal|null>(()=>getGoal(playerKey));

  useEffect(()=>{
    setGoal(getGoal(playerKey));
  },[playerKey]);

  const progress=useMemo(
    ()=>goal?goalProgress(goal,matches):null,
    [goal,matches]
  );

  function start(){
    const next=suggestGoal(playerKey,matches);
    saveGoal(next);
    setGoal(next);
  }

  function reset(){
    clearGoal(playerKey);
    setGoal(null);
  }

  return <section className="panel next-goal">
    <div className="innovation-head">
      <div>
        <span>NEXT SESSION GOAL</span>
        <h2>{goal?goal.title:"Transforme análise em experimento"}</h2>
      </div>
      {progress&&<small>{progress.played}/{goal?.targetGames}</small>}
    </div>

    {!goal?(
      <>
        <p className="goal-intro">O Chibi escolhe um foco baseado no seu Leak Map e mede automaticamente as próximas 5 partidas.</p>
        <button className="goal-start" onClick={start}>Criar objetivo para a próxima sessão</button>
      </>
    ):<>
      <p className="goal-description">{goal.description}</p>

      <div className="goal-progress-track">
        <i style={{width:Math.min(100,(progress?.played||0)/(goal.targetGames||5)*100)+"%"}}/>
      </div>

      <div className="goal-stats">
        <div>
          <span>Progresso</span>
          <strong>{progress?.played}/{goal.targetGames}</strong>
        </div>
        <div>
          <span>Sinal</span>
          <strong>{progress?.score??0}%</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>
            {!progress?.finished?"Em andamento":progress.achieved?"Concluído":"Não bateu"}
          </strong>
        </div>
      </div>

      <p className="goal-detail">{progress?.detail}</p>

      <div className="goal-actions">
        {progress?.matchIds.length?<button onClick={()=>onEvidence(progress.matchIds,"Objetivo · "+goal.title)}>Ver partidas do objetivo</button>:<span>Jogue novas partidas e atualize o perfil.</span>}
        <button className="goal-secondary" onClick={reset}>Encerrar objetivo</button>
      </div>
    </>}
  </section>;
}
