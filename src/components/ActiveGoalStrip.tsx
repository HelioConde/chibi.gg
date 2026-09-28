import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { getGoal, goalProgress } from "../goals";

type Props={
  playerKey:string;
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
  onOpenCoach:()=>void;
};

export default function ActiveGoalStrip({playerKey,matches,onEvidence,onOpenCoach}:Props){
  const goal=useMemo(()=>getGoal(playerKey),[playerKey,matches]);
  const progress=useMemo(()=>goal?goalProgress(goal,matches):null,[goal,matches]);

  if(!goal||!progress)return null;

  const pct=Math.min(100,Math.round(progress.played/Math.max(1,goal.targetGames)*100));
  const status=progress.finished
    ? progress.achieved?"Meta concluída":"Sessão concluída"
    : progress.played?"Em andamento":"Aguardando novas partidas";

  return <section className={"active-goal-strip "+(progress.finished?(progress.achieved?"success":"finished"):"")}>
    <div className="active-goal-copy">
      <span>PLANO DA PRÓXIMA SESSÃO</span>
      <strong>{goal.title}</strong>
      <small>{progress.detail}</small>
    </div>

    <div className="active-goal-meter">
      <div><i style={{width:pct+"%"}}/></div>
      <span>{progress.played}/{goal.targetGames}</span>
      <small>{status}</small>
    </div>

    <div className="active-goal-actions">
      {progress.matchIds.length>0&&<button onClick={()=>onEvidence(progress.matchIds,"Meta ativa · "+goal.title)}>Ver partidas</button>}
      <button className="secondary" onClick={onOpenCoach}>Abrir plano</button>
    </div>
  </section>;
}
