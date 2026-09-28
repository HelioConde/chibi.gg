import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { buildLeakMap, buildSessionCoach } from "../analysis/chibiProduct";
import { buildRankedReviewSignals } from "../analysis/chibiReviewRanking";
import { getJournalEntries, JOURNAL_TAGS } from "../journal";
import { staticEntry, TftStaticData } from "../tftStatic";
import DDragonArt from "./DDragonArt";

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

function relevanceLabel(priority:number){
  if(priority>=72)return "relevância alta";
  if(priority>=52)return "relevância média";
  return "sinal inicial";
}

export default function ChibiReview({matches,staticData,journalVersion,onEvidence}:Props){
  const leaks=useMemo(()=>buildLeakMap(matches),[matches]);
  const session=useMemo(()=>buildSessionCoach(matches),[matches]);
  const rankedSignals=useMemo(()=>buildRankedReviewSignals(matches),[matches]);

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
    const primary=leaks.primary;

    if(primary?.id==="conversion"){
      return {
        title:"Converta um Top 4 em vitória",
        body:"Nas próximas 5 partidas, marque quando chegar ao Top 4 e depois compare board final, nível, estrelas e itens. O objetivo é encontrar uma diferença observável antes de mudar toda a sua linha.",
        metric:"Meta: pelo menos 1 vitória entre seus próximos Top 4.",
        ids:top4.map(match=>match.id),
      };
    }

    if(primary?.id==="bottom2"){
      const bottom2=matches.filter(match=>match.placement>=7);
      return {
        title:"Proteja o piso da próxima sessão",
        body:"Revise primeiro os 7º/8º e observe se existe um padrão de board final fraco, nível sem conversão ou linha forçada. O experimento é evitar decisões que repetem esse padrão.",
        metric:"Meta: reduzir a frequência de Bottom 2 nas próximas 5 partidas.",
        ids:bottom2.map(match=>match.id),
      };
    }

    if(primary?.id==="dominance"){
      return {
        title:"Teste uma segunda linha quando o jogo oferecer",
        body:"Não abandone sua linha forte. Apenas registre uma partida em que o lobby e os itens apontem para uma alternativa viável e compare o resultado.",
        metric:"Meta: concluir pelo menos 1 partida com uma segunda identidade de board.",
        ids:primary.matchIds,
      };
    }

    if(primary?.id==="level-conversion"){
      return {
        title:"Pare de usar nível como explicação única",
        body:"Compare os boards finais em que nível foi parecido, mas o resultado foi diferente. Procure diferenças de unidades, estrelas, itens e traits.",
        metric:"Meta: identificar uma diferença observável em pelo menos 2 partidas.",
        ids:primary.matchIds,
      };
    }

    return {
      title:session.focus,
      body:session.reason,
      metric:"Use a próxima sessão para testar só uma mudança de cada vez.",
      ids:session.matchIds,
    };
  },[leaks,session,top4,matches]);

  return <section className="panel chibi-review coach-review">
    <div className="review-head coach-review-head">
      <div className="coach-review-copy">
        <span>CHIBI REVIEW</span>
        <h2>3 descobertas sobre o seu jogo</h2>
        <p>O Chibi compara vários sinais do seu histórico e mostra apenas os 3 mais relevantes agora, sempre com evidência e confiança.</p>
        <DDragonArt
          staticData={staticData}
          championIds={visualChampionIds}
          variant="compact"
          label="Seu pool recente · Riot Data Dragon"
        />
      </div>
      <small>{matches.length} partidas</small>
    </div>

    <div className="coach-signal-row ranked-review-signals">
      {rankedSignals.map((signal,index)=>(
        <article className={"coach-signal "+signal.tone} key={signal.id}>
          <div className="review-signal-rank">
            <span>{index+1}</span>
            <small>{relevanceLabel(signal.priority)}</small>
          </div>
          <span>{signal.eyebrow}</span>
          {signal.subjectId&&<strong className="review-signal-subject">{traitName(signal.subjectId,staticData)}</strong>}
          <h3>{signal.title}</h3>
          <p>{signal.body}</p>
          <small className="review-signal-evidence">{signal.evidence}</small>
          <div>
            <em>confiança {signal.confidence}</em>
            {signal.matchIds.length>0&&<button onClick={()=>onEvidence(
              signal.matchIds,
              "Chibi Review · "+(signal.subjectId?traitName(signal.subjectId,staticData)+" · ":"")+signal.title,
            )}>Ver evidências</button>}
          </div>
        </article>
      ))}
    </div>

    {sessionComparison&&<section className={"coach-session-review "+sessionComparison.tone}>
      <div className="coach-session-review-head">
        <div>
          <span>SESSION REVIEW</span>
          <h3>Últimas {sessionComparison.window} vs {sessionComparison.window} anteriores</h3>
          <p>Uma leitura rápida para entender se sua sessão mudou de direção — sem esconder a amostra.</p>
        </div>
        <button onClick={()=>onEvidence(sessionComparison.ids,"Session Review · bloco recente vs anterior")}>Ver as {sessionComparison.window*2} partidas</button>
      </div>

      <div className="coach-session-metrics">
        <article>
          <span>COLOCAÇÃO MÉDIA</span>
          <strong>{sessionComparison.current.avg.toFixed(2)}</strong>
          <small>antes {sessionComparison.before.avg.toFixed(2)} · Δ {signed(sessionComparison.avgDelta)}</small>
        </article>
        <article>
          <span>TOP 4</span>
          <strong>{sessionComparison.current.top4}%</strong>
          <small>antes {sessionComparison.before.top4}% · Δ {signed(sessionComparison.current.top4-sessionComparison.before.top4,"%")}</small>
        </article>
        <article>
          <span>1º LUGAR</span>
          <strong>{sessionComparison.current.wins}%</strong>
          <small>antes {sessionComparison.before.wins}% · Δ {signed(sessionComparison.current.wins-sessionComparison.before.wins,"%")}</small>
        </article>
        <article className={sessionComparison.current.bottom2>sessionComparison.before.bottom2?"warning":""}>
          <span>BOTTOM 2</span>
          <strong>{sessionComparison.current.bottom2}%</strong>
          <small>antes {sessionComparison.before.bottom2}% · Δ {signed(sessionComparison.current.bottom2-sessionComparison.before.bottom2,"%")}</small>
        </article>
      </div>
    </section>}

    <article className="coach-experiment">
      <div>
        <span>PRÓXIMO EXPERIMENTO</span>
        <h3>{experiment.title}</h3>
        <p>{experiment.body}</p>
      </div>
      <aside>
        <small>COMO VALIDAR</small>
        <strong>{experiment.metric}</strong>
        {experiment.ids.length>0&&<button onClick={()=>onEvidence(experiment.ids,"Coach · próximo experimento")}>Abrir partidas relevantes</button>}
      </aside>
    </article>

    <details className="coach-evidence-layer">
      <summary>
        <span><b>Ver sinais de apoio</b><small>Journal, leitura de nível e contexto usado pelo coach</small></span>
        <em>Evidências</em>
      </summary>
      <div className="review-foot coach-evidence-body">
        <div>
          <span>SINAL DO JOURNAL</span>
          {journalSignal?(
            <>
              <strong>{journalSignal.label}</strong>
              <p>Marcado em {journalSignal.games} partidas, com colocação média {journalSignal.avg.toFixed(2)}.</p>
              <button onClick={()=>onEvidence(journalSignal.ids,"Journal · "+journalSignal.label)}>Ver partidas marcadas</button>
            </>
          ):(
            <p>Marque contexto nas partidas para o Chibi cruzar decisões percebidas com seus resultados.</p>
          )}
        </div>
        <div>
          <span>LEITURA DE NÍVEL</span>
          <strong>{top4AvgLevel!=null&&bottom4AvgLevel!=null
            ? "Top 4 "+top4AvgLevel.toFixed(1)+" · Bottom 4 "+bottom4AvgLevel.toFixed(1)
            : "Amostra insuficiente"}</strong>
          <p>Esse indicador descreve o board final; não revela quando você subiu de nível.</p>
        </div>
      </div>
    </details>
  </section>;
}
