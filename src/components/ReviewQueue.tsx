import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildReviewQueue, ReviewQueueItem } from "../analysis/reviewQueue";
import { getReviewedMatchIds, markMatchReviewed } from "../reviewProgress";

type Props={
  playerKey:string;
  matches:TftMatch[];
  onOpenMatch:(match:TftMatch,queueIds:string[],index:number)=>void;
};

function kindLabel(item:ReviewQueueItem){
  if(item.kind==="priority") return "PRIORIDADE";
  if(item.kind==="compare") return "COMPARAR";
  return "REFERÊNCIA";
}

export default function ReviewQueue({playerKey,matches,onOpenMatch}:Props){
  const queue=useMemo(()=>buildReviewQueue(matches),[matches]);
  const [reviewed,setReviewed]=useState<Set<string>>(()=>getReviewedMatchIds(playerKey));

  useEffect(()=>{
    const refresh=()=>setReviewed(getReviewedMatchIds(playerKey));
    refresh();
    window.addEventListener("chibi:reviewed",refresh);
    return ()=>window.removeEventListener("chibi:reviewed",refresh);
  },[playerKey]);

  const completed=queue.filter(item=>reviewed.has(item.matchId)).length;
  const next=queue.find(item=>!reviewed.has(item.matchId))||queue[0]||null;

  function toggleReviewed(matchId:string){
    const next=markMatchReviewed(playerKey,matchId,!reviewed.has(matchId));
    setReviewed(new Set(next));
  }

  function open(item:ReviewQueueItem){
    const match=matches.find(match=>match.id===item.matchId);
    const index=queue.findIndex(row=>row.matchId===item.matchId);
    if(match) onOpenMatch(match,queue.map(row=>row.matchId),Math.max(0,index));
  }

  if(!queue.length) return null;

  return <section className="panel review-queue" id="review-queue">
    <div className="review-queue-head">
      <div>
        <span>REVIEW QUEUE</span>
        <h2>Revise só o que importa</h2>
        <p>O Chibi escolheu três partidas com papéis diferentes: problema, contraste e referência.</p>
      </div>
      <div className="review-queue-progress">
        <strong>{completed}/{queue.length}</strong>
        <small>revisadas</small>
      </div>
    </div>

    {next&&<div className="review-next">
      <div>
        <span>PRÓXIMA AÇÃO</span>
        <strong>{reviewed.has(next.matchId)?"Fila concluída — reveja se quiser":"Abra "+next.placement+"º lugar · "+next.title.toLowerCase()}</strong>
      </div>
      <button onClick={()=>open(next)}>Abrir análise →</button>
    </div>}

    <div className="review-queue-list">
      {queue.map((item,index)=>{
        const done=reviewed.has(item.matchId);
        return <article className={"review-queue-item "+item.kind+(done?" done":"")} key={item.matchId}>
          <div className="review-index">{done?"✓":index+1}</div>

          <div className="review-item-main">
            <div className="review-item-top">
              <span>{kindLabel(item)}</span>
              <b>{item.placement}º</b>
            </div>
            <h3>{item.title}</h3>
            <p>{item.reason}</p>
            <small>{item.evidence}</small>
          </div>

          <div className="review-item-actions">
            <button onClick={()=>open(item)}>Abrir</button>
            <button className={done?"reviewed":""} onClick={()=>toggleReviewed(item.matchId)}>
              {done?"Revisada ✓":"Marcar revisada"}
            </button>
          </div>
        </article>;
      })}
    </div>

    <p className="review-queue-note">A fila usa somente o snapshot disponível das partidas. Marcar como revisada fica salvo neste navegador.</p>
  </section>;
}
