import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { buildLeakMap, buildSessionCoach } from "../analysis/chibiProduct";
import { buildRankedReviewSignals } from "../analysis/chibiReviewRanking";
import { getJournalEntries, JOURNAL_TAGS } from "../journal";
import { staticEntry, TftStaticData } from "../tftStatic";
import DDragonArt from "./DDragonArt";
import { useI18n } from "../i18n";

type Props={
  matches:TftMatch[];
  staticData:TftStaticData|null;
  journalVersion:number;
  onEvidence:(ids:string[],label:string)=>void;
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

function traitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.traits,id)?.name||clean(id);
}

function avg(values:number[]){
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
}

function signed(value:number,suffix=""){
  const rounded=Math.round(value*10)/10;
  return (rounded>0?"+":"")+rounded+suffix;
}

function relevanceKey(priority:number){
  if(priority>=72)return "review.relevance.high";
  if(priority>=52)return "review.relevance.medium";
  return "review.relevance.initial";
}

function unitCopies(tier:number){
  return tier>=3?9:tier===2?3:1;
}

function estimatedBoardValue(match:TftMatch,staticData:TftStaticData|null){
  return match.units.reduce((sum,unit)=>{
    const entry=staticEntry(staticData?.champions,unit.characterId);
    const cost=Math.max(1,Math.min(5,Number(entry?.tier||unit.rarity+1||1)));
    return sum+cost*unitCopies(Math.max(1,Number(unit.tier)||1));
  },0);
}

function equippedItems(match:TftMatch){
  return match.units.reduce((sum,unit)=>sum+(unit.itemNames?.length||0),0);
}

export default function ChibiReview({matches,staticData,journalVersion,onEvidence}:Props){
  const { t }=useI18n();
  const leaks=useMemo(()=>buildLeakMap(matches),[matches]);
  const session=useMemo(()=>buildSessionCoach(matches),[matches]);
  const rankedSignals=useMemo(()=>buildRankedReviewSignals(matches),[matches]);

  const signalImpacts=useMemo(()=>{
    const byId=new Map<string,{label:string;tone:"good"|"warning"|"neutral"}>();
    for(const signal of rankedSignals){
      const ids=new Set(signal.matchIds);
      const related=matches.filter(match=>ids.has(match.id));
      const rest=matches.filter(match=>!ids.has(match.id));
      if(related.length<2||rest.length<2)continue;
      const relatedAvg=avg(related.map(match=>match.placement));
      const restAvg=avg(rest.map(match=>match.placement));
      if(relatedAvg==null||restAvg==null)continue;
      const delta=relatedAvg-restAvg;
      const magnitude=Math.abs(delta);
      if(magnitude<.25)continue;
      byId.set(signal.id,{
        label:"Impacto observado: "+magnitude.toFixed(2)+" posição "+(delta<0?"melhor":"pior")+" que o restante da amostra",
        tone:delta<0?"good":"warning",
      });
    }
    return byId;
  },[rankedSignals,matches]);

  const topBottomComparison=useMemo(()=>{
    const top=matches.filter(match=>match.placement<=4);
    const bottom=matches.filter(match=>match.placement>=7);
    if(top.length<2||bottom.length<2)return null;
    const summarize=(list:TftMatch[])=>({
      games:list.length,
      level:avg(list.map(match=>match.level))??0,
      gold:avg(list.map(match=>match.goldLeft))??0,
      board:avg(list.map(match=>estimatedBoardValue(match,staticData)))??0,
      items:avg(list.map(match=>equippedItems(match)))??0,
    });
    return {
      top:summarize(top),
      bottom:summarize(bottom),
      ids:[...top,...bottom].map(match=>match.id),
    };
  },[matches,staticData]);

  const visualChampionIds=useMemo(()=>{
    const scores=new Map<string,number>();
    matches.slice(0,10).forEach((match,matchIndex)=>{
      match.units.forEach(unit=>{
        const recency=Math.max(1,10-matchIndex);
        const upgrade=unit.tier>=3?5:unit.tier===2?2:0;
        const result=match.placement<=4?2:0;
        scores.set(unit.characterId,(scores.get(unit.characterId)||0)+recency+upgrade+result);
      });
    });
    return [...scores.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,7)
      .map(([id])=>id);
  },[matches]);

  const journalSignal=useMemo(()=>{
    void journalVersion;
    const byId=new Map(matches.map(match=>[match.id,match]));
    const entries=getJournalEntries(matches.map(match=>match.id));
    const stats=JOURNAL_TAGS.map(tag=>{
      const tagged=entries
        .filter(entry=>entry.tags.includes(tag.id))
        .map(entry=>byId.get(entry.matchId))
        .filter((match):match is TftMatch=>Boolean(match));
      if(tagged.length<2) return null;
      return {
        id:tag.id,
        label:tag.label,
        games:tagged.length,
        avg:avg(tagged.map(match=>match.placement))??0,
        ids:tagged.map(match=>match.id),
      };
    }).filter(Boolean) as Array<{id:string;label:string;games:number;avg:number;ids:string[]}>;
    return stats.sort((a,b)=>b.games-a.games||b.avg-a.avg)[0]||null;
  },[matches,journalVersion]);

  const top4=matches.filter(match=>match.placement<=4);
  const bottom4=matches.filter(match=>match.placement>=5);
  const top4AvgLevel=avg(top4.map(match=>match.level));
  const bottom4AvgLevel=avg(bottom4.map(match=>match.level));

  const sessionComparison=useMemo(()=>{
    const window=Math.min(5,Math.floor(matches.length/2));
    if(window<3) return null;

    const summarize=(list:TftMatch[])=>{
      const total=Math.max(1,list.length);
      return {
        avg:avg(list.map(match=>match.placement))??0,
        top4:Math.round(list.filter(match=>match.placement<=4).length/total*100),
        wins:Math.round(list.filter(match=>match.placement===1).length/total*100),
        bottom2:Math.round(list.filter(match=>match.placement>=7).length/total*100),
      };
    };

    const recent=matches.slice(0,window);
    const previous=matches.slice(window,window*2);
    const current=summarize(recent);
    const before=summarize(previous);
    const avgDelta=+(current.avg-before.avg).toFixed(2);

    return {
      window,
      current,
      before,
      avgDelta,
      tone:avgDelta<-.25?"good":avgDelta>.25?"bad":"neutral",
      ids:[...recent,...previous].map(match=>match.id),
    };
  },[matches]);

  const experiment=useMemo(()=>{
    const focus=rankedSignals.find(signal=>signal.kind==="risk")||rankedSignals[0];

    if(focus?.id==="conversion-low"){
      return {
        title:t("review.exp.conversion.title"),
        body:t("review.exp.conversion.body"),
        metric:t("review.exp.conversion.metric"),
        ids:focus.matchIds,
      };
    }

    if(focus?.id==="bottom2-risk"){
      return {
        title:t("review.exp.bottom.title"),
        body:t("review.exp.bottom.body"),
        metric:t("review.exp.bottom.metric"),
        ids:focus.matchIds,
      };
    }

    if(focus?.id==="bottom2-gold-left"){
      return {
        title:t("review.exp.gold.title"),
        body:t("review.exp.gold.body"),
        metric:t("review.exp.gold.metric"),
        ids:focus.matchIds,
      };
    }

    if(focus?.id.startsWith("trait-risk:")){
      const name=focus.subjectId?traitName(focus.subjectId,staticData):t("comps.observedComp");
      return {
        title:t("review.exp.trait.title",{name}),
        body:t("review.exp.trait.body"),
        metric:t("review.exp.trait.metric"),
        ids:focus.matchIds,
      };
    }

    if(focus?.id==="level-split"&&focus.tone==="warning"){
      return {
        title:t("review.exp.level.title"),
        body:t("review.exp.level.body"),
        metric:t("review.exp.level.metric"),
        ids:focus.matchIds,
      };
    }

    if(focus?.id.startsWith("line-dominance:")){
      return {
        title:t("review.exp.line.title"),
        body:t("review.exp.line.body"),
        metric:t("review.exp.line.metric"),
        ids:focus.matchIds,
      };
    }

    if(focus?.id==="recent-form"&&focus.tone==="warning"){
      return {
        title:t("review.exp.recent.title"),
        body:t("review.exp.recent.body"),
        metric:t("review.exp.recent.metric"),
        ids:focus.matchIds,
      };
    }

    const primary=leaks.primary;
    if(primary?.id==="conversion"){
      return {
        title:t("review.exp.conversion.title"),
        body:t("review.exp.conversionShort.body"),
        metric:t("review.exp.conversion.metric"),
        ids:top4.map(match=>match.id),
      };
    }

    return {
      title:session.focus,
      body:session.reason,
      metric:t("review.exp.default.metric"),
      ids:focus?.matchIds.length?focus.matchIds:session.matchIds,
    };
  },[rankedSignals,leaks,session,top4,staticData,t]);

  return <section className="panel chibi-review coach-review">
    <div className="review-head coach-review-head">
      <div className="coach-review-copy">
        <span>CHIBI REVIEW</span>
        <h2>{t("review.title")}</h2>
        <p>{t("review.desc")}</p>
        <DDragonArt
          staticData={staticData}
          championIds={visualChampionIds}
          variant="compact"
          label={t("review.pool")}
        />
      </div>
      <small>{t("review.matches",{count:matches.length})}</small>
    </div>

    {rankedSignals.length===0&&<div className="coach-review-empty">
      <strong>{t("review.empty.title")}</strong>
      <span>{t("review.empty.desc")}</span>
    </div>}

    <div className="coach-signal-row ranked-review-signals">
      {rankedSignals.map((signal,index)=>(
        <article className={"coach-signal "+signal.tone} key={signal.id}>
          <div className="review-signal-rank">
            <span>{index+1}</span>
            <small>{t(relevanceKey(signal.priority))}</small>
          </div>
          <span>{signal.eyebrow}</span>
          {signal.subjectId&&<strong className="review-signal-subject">{traitName(signal.subjectId,staticData)}</strong>}
          <h3>{signal.title}</h3>
          <p>{signal.body}</p>
          <small className="review-signal-evidence">{signal.evidence}</small>
          {signalImpacts.get(signal.id)&&<small className={"review-signal-impact "+signalImpacts.get(signal.id)!.tone}>
            {signalImpacts.get(signal.id)!.label}
          </small>}
          <div>
            <em>{t("review.confidence",{value:t(signal.confidence==="alta"?"common.confidence.high":signal.confidence==="média"?"common.confidence.medium":"common.confidence.low")})}</em>
            {signal.matchIds.length>0&&<button onClick={()=>onEvidence(
              signal.matchIds,
              "Chibi Review · "+(signal.subjectId?traitName(signal.subjectId,staticData)+" · ":"")+signal.title,
            )}>{t("review.viewEvidence")}</button>}
          </div>
        </article>
      ))}
    </div>

    {topBottomComparison&&<section className="coach-outcome-compare">
      <div className="coach-outcome-compare-head">
        <div>
          <span>TOP 4 × BOTTOM 2</span>
          <h3>O que muda entre suas partidas que convertem e as que quebram</h3>
          <p>Comparação automática do snapshot final. Diferenças observadas não provam causalidade.</p>
        </div>
        <button onClick={()=>onEvidence(topBottomComparison.ids,"Coach · Top 4 vs Bottom 2")}>Ver partidas comparadas</button>
      </div>
      <div className="coach-outcome-compare-grid">
        <article><span>NÍVEL FINAL</span><strong>{topBottomComparison.top.level.toFixed(1)} <i>vs</i> {topBottomComparison.bottom.level.toFixed(1)}</strong><small>Top 4 · Bottom 2</small></article>
        <article><span>OURO FINAL</span><strong>{topBottomComparison.top.gold.toFixed(1)}g <i>vs</i> {topBottomComparison.bottom.gold.toFixed(1)}g</strong><small>Top 4 · Bottom 2</small></article>
        <article><span>BOARD EST.</span><strong>{topBottomComparison.top.board.toFixed(0)}g <i>vs</i> {topBottomComparison.bottom.board.toFixed(0)}g</strong><small>custo + estrelas</small></article>
        <article><span>ITENS EQUIPADOS</span><strong>{topBottomComparison.top.items.toFixed(1)} <i>vs</i> {topBottomComparison.bottom.items.toFixed(1)}</strong><small>{topBottomComparison.top.games} Top 4 · {topBottomComparison.bottom.games} Bottom 2</small></article>
      </div>
    </section>}

    {sessionComparison&&<section className={"coach-session-review "+sessionComparison.tone}>
      <div className="coach-session-review-head">
        <div>
          <span>SESSION REVIEW</span>
          <h3>{t("review.session.title",{window:sessionComparison.window})}</h3>
          <p>{t("review.session.desc")}</p>
        </div>
        <button onClick={()=>onEvidence(sessionComparison.ids,"Session Review · bloco recente vs anterior")}>{t("review.session.view",{count:sessionComparison.window*2})}</button>
      </div>

      <div className="coach-session-metrics">
        <article>
          <span>{t("review.session.average")}</span>
          <strong>{sessionComparison.current.avg.toFixed(2)}</strong>
          <small>{t("review.session.before",{value:sessionComparison.before.avg.toFixed(2),delta:signed(sessionComparison.avgDelta)})}</small>
        </article>
        <article>
          <span>TOP 4</span>
          <strong>{sessionComparison.current.top4}%</strong>
          <small>{t("review.session.before",{value:sessionComparison.before.top4+"%",delta:signed(sessionComparison.current.top4-sessionComparison.before.top4,"%")})}</small>
        </article>
        <article>
          <span>{t("review.session.first")}</span>
          <strong>{sessionComparison.current.wins}%</strong>
          <small>{t("review.session.before",{value:sessionComparison.before.wins+"%",delta:signed(sessionComparison.current.wins-sessionComparison.before.wins,"%")})}</small>
        </article>
        <article className={sessionComparison.current.bottom2>sessionComparison.before.bottom2?"warning":""}>
          <span>BOTTOM 2</span>
          <strong>{sessionComparison.current.bottom2}%</strong>
          <small>{t("review.session.before",{value:sessionComparison.before.bottom2+"%",delta:signed(sessionComparison.current.bottom2-sessionComparison.before.bottom2,"%")})}</small>
        </article>
      </div>
    </section>}

    <article className="coach-experiment">
      <div>
        <span>{t("review.experiment")}</span>
        <h3>{experiment.title}</h3>
        <p>{experiment.body}</p>
      </div>
      <aside>
        <small>{t("review.validate")}</small>
        <strong>{experiment.metric}</strong>
        {experiment.ids.length>0&&<button onClick={()=>onEvidence(experiment.ids,"Coach · próximo experimento")}>{t("review.openRelevant")}</button>}
      </aside>
    </article>

    <details className="coach-evidence-layer">
      <summary>
        <span><b>{t("review.support.title")}</b><small>{t("review.support.desc")}</small></span>
        <em>{t("review.support.evidence")}</em>
      </summary>
      <div className="review-foot coach-evidence-body">
        <div>
          <span>{t("review.journal")}</span>
          {journalSignal?(
            <>
              <strong>{journalSignal.label}</strong>
              <p>{t("review.journal.marked",{games:journalSignal.games,average:journalSignal.avg.toFixed(2)})}</p>
              <button onClick={()=>onEvidence(journalSignal.ids,"Journal · "+journalSignal.label)}>{t("review.journal.view")}</button>
            </>
          ):(
            <p>{t("review.journal.empty")}</p>
          )}
        </div>
        <div>
          <span>{t("review.level")}</span>
          <strong>{top4AvgLevel!=null&&bottom4AvgLevel!=null
            ? t("review.level.summary",{top:top4AvgLevel.toFixed(1),bottom:bottom4AvgLevel.toFixed(1)})
            : t("review.level.insufficient")}</strong>
          <p>{t("review.level.desc")}</p>
        </div>
      </div>
    </details>
  </section>;
}
