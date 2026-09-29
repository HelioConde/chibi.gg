import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { buildReviewQueue, ReviewQueueItem } from "../analysis/reviewQueue";
import { getReviewedMatchIds, markMatchReviewed } from "../reviewProgress";
import { useI18n } from "../i18n";

type Props={
  playerKey:string;
  matches:TftMatch[];
  onOpenMatch:(match:TftMatch,queueIds:string[],index:number)=>void;
};

export default function ReviewQueue({playerKey,matches,onOpenMatch}:Props){
  const { t }=useI18n();
  const queue=useMemo(()=>buildReviewQueue(matches,t),[matches,t]);
  const kindLabel=(item:ReviewQueueItem)=>{
    if(item.kind==="priority") return t("reviewQueue.kind.priority");
    if(item.kind==="compare") return t("reviewQueue.kind.compare");
    return t("reviewQueue.kind.reference");
  };
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
        <h2>{t("reviewQueue.ui.title")}</h2>
        <p>{t("reviewQueue.ui.desc")}</p>
      </div>
      <div className="review-queue-progress">
        <strong>{completed}/{queue.length}</strong>
        <small>{t("reviewQueue.ui.reviewed")}</small>
      </div>
    </div>

    {next&&<div className="review-next">
      <div>
        <span>{t("reviewQueue.ui.next")}</span>
        <strong>{reviewed.has(next.matchId)?t("reviewQueue.ui.done"):t("reviewQueue.ui.openPlace",{placement:next.placement,title:next.title.toLowerCase()})}</strong>
      </div>
      <button onClick={()=>open(next)}>{t("reviewQueue.ui.openAnalysis")}</button>
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
            <div className={"review-signal "+item.tone}>{item.signal}</div>
            <h3>{item.title}</h3>
            <p>{item.reason}</p>
            <div className="review-focus">
              <span>{t("reviewQueue.ui.lookFor")}</span>
              <strong>{item.focus}</strong>
            </div>
            <small>{item.evidence}</small>
          </div>

          <div className="review-item-actions">
            <button onClick={()=>open(item)}>{t("reviewQueue.ui.open")}</button>
            <button className={done?"reviewed":""} onClick={()=>toggleReviewed(item.matchId)}>
              {done?t("reviewQueue.ui.reviewedDone"):t("reviewQueue.ui.mark")}
            </button>
          </div>
        </article>;
      })}
    </div>

    <p className="review-queue-note">{t("reviewQueue.ui.note")}</p>
  </section>;
}
