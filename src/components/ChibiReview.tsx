import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { buildLeakMap, buildPersonalMeta, buildSessionCoach } from "../analysis/chibiProduct";
import { getJournalEntries, JOURNAL_TAGS } from "../journal";
import { staticEntry, TftStaticData } from "../tftStatic";

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

export default function ChibiReview({matches,staticData,journalVersion,onEvidence}:Props){
  const meta=useMemo(()=>buildPersonalMeta(matches),[matches]);
  const leaks=useMemo(()=>buildLeakMap(matches),[matches]);
  const session=useMemo(()=>buildSessionCoach(matches),[matches]);

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

  const working=meta[0]
    ? {
        title:traitName(meta[0].id,staticData),
        body:`Sua melhor média entre linhas repetidas foi ${meta[0].avgPlacement}, com Top 4 em ${meta[0].top4Rate}% de ${meta[0].games} partidas.`,
        ids:meta[0].matchIds,
      }
    : {
        title:"Amostra ainda aberta",
        body:"Ainda não há uma linha repetida o suficiente para destacar como padrão forte.",
        ids:[] as string[],
      };

  const costing=leaks.primary
    ? {
        title:leaks.primary.title,
        body:`${leaks.primary.description} ${leaks.primary.evidence}.`,
        ids:leaks.primary.matchIds,
      }
    : {
        title:"Sem vazamento dominante",
        body:"A amostra atual não mostra um padrão de perda suficientemente claro.",
        ids:[] as string[],
      };

  const change=(()=>{
    const window=Math.min(5,Math.floor(matches.length/2));
    if(window<3) return {
      title:"Poucos jogos para comparar",
      body:"Carregue mais partidas para comparar blocos recentes com segurança.",
      ids:[] as string[],
    };
    const recent=matches.slice(0,window);
    const previous=matches.slice(window,window*2);
    const a=avg(recent.map(match=>match.placement))??0;
    const b=avg(previous.map(match=>match.placement))??0;
    const diff=a-b;
    return {
      title:diff<-.25?"Seu bloco recente melhorou":diff>.25?"Seu bloco recente piorou":"Seu ritmo ficou parecido",
      body:`Últimas ${window}: média ${a.toFixed(2)}. ${window} anteriores: ${b.toFixed(2)}.`,
      ids:[...recent,...previous].map(match=>match.id),
    };
  })();

  const nextFocus={
    title:session.focus,
    body:session.reason,
    ids:session.matchIds,
  };

  return <section className="panel chibi-review">
    <div className="review-head">
      <div>
        <span>CHIBI REVIEW</span>
        <h2>O que seus jogos estão tentando te ensinar</h2>
      </div>
      <small>{matches.length} partidas</small>
    </div>

    <div className="review-grid">
      <article className="review-block positive">
        <span>O QUE ESTÁ FUNCIONANDO</span>
        <h3>{working.title}</h3>
        <p>{working.body}</p>
        {working.ids.length>0&&<button onClick={()=>onEvidence(working.ids,"Review · O que está funcionando")}>Ver evidências</button>}
      </article>

      <article className="review-block warning">
        <span>O QUE ESTÁ TE PUNINDO</span>
        <h3>{costing.title}</h3>
        <p>{costing.body}</p>
        {costing.ids.length>0&&<button onClick={()=>onEvidence(costing.ids,"Review · O que está te punindo")}>Ver evidências</button>}
      </article>

      <article className="review-block neutral">
        <span>O QUE MUDOU</span>
        <h3>{change.title}</h3>
        <p>{change.body}</p>
        {change.ids.length>0&&<button onClick={()=>onEvidence(change.ids,"Review · O que mudou")}>Comparar partidas</button>}
      </article>

      <article className="review-block focus">
        <span>PRÓXIMO FOCO</span>
        <h3>{nextFocus.title}</h3>
        <p>{nextFocus.body}</p>
        {nextFocus.ids.length>0&&<button onClick={()=>onEvidence(nextFocus.ids,"Review · Próximo foco")}>Ver sessão</button>}
      </article>
    </div>

    <div className="review-foot">
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
  </section>;
}
