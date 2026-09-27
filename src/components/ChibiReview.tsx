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

  const strength=meta[0]
    ? {
        title:traitName(meta[0].id,staticData),
        body:`Sua melhor média entre linhas repetidas foi ${meta[0].avgPlacement}, com Top 4 em ${meta[0].top4Rate}% de ${meta[0].games} partidas.`,
        confidence:meta[0].confidence,
        ids:meta[0].matchIds,
      }
    : {
        title:"Ainda sem força recorrente",
        body:"A amostra não repetiu uma linha o suficiente para destacar um padrão confiável.",
        confidence:"baixa" as const,
        ids:[] as string[],
      };

  const problem=leaks.primary
    ? {
        title:leaks.primary.title,
        body:`${leaks.primary.description} ${leaks.primary.evidence}.`,
        confidence:leaks.primary.confidence,
        ids:leaks.primary.matchIds,
      }
    : {
        title:"Nenhum problema dominante",
        body:"A amostra atual não mostra um vazamento suficientemente claro para virar prioridade.",
        confidence:"baixa" as const,
        ids:[] as string[],
      };

  const change=useMemo(()=>{
    const window=Math.min(5,Math.floor(matches.length/2));
    if(window<3) return {
      title:"Ainda cedo para comparar blocos",
      body:"Carregue mais partidas para comparar mudança recente com segurança.",
      tone:"neutral",
      ids:[] as string[],
    };
    const recent=matches.slice(0,window);
    const previous=matches.slice(window,window*2);
    const a=avg(recent.map(match=>match.placement))??0;
    const b=avg(previous.map(match=>match.placement))??0;
    const diff=a-b;
    return {
      title:diff<-.25?"Seu bloco recente melhorou":diff>.25?"Seu bloco recente piorou":"Seu ritmo ficou parecido",
      body:`Últimas ${window}: média ${a.toFixed(2)} · ${window} anteriores: ${b.toFixed(2)}.`,
      tone:diff<-.25?"good":diff>.25?"bad":"neutral",
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
      <div>
        <span>CHIBI COACH</span>
        <h2>O que repetir, corrigir e testar</h2>
        <p>Primeiro o que repetir, depois o que corrigir. O resto fica como evidência.</p>
      </div>
      <small>{matches.length} partidas</small>
    </div>

    <div className="coach-signal-row">
      <article className="coach-signal positive">
        <span>FORÇA</span>
        <h3>{strength.title}</h3>
        <p>{strength.body}</p>
        <div><em>confiança {strength.confidence}</em>{strength.ids.length>0&&<button onClick={()=>onEvidence(strength.ids,"Coach · força")}>Ver evidências</button>}</div>
      </article>

      <article className="coach-signal warning">
        <span>PROBLEMA</span>
        <h3>{problem.title}</h3>
        <p>{problem.body}</p>
        <div><em>confiança {problem.confidence}</em>{problem.ids.length>0&&<button onClick={()=>onEvidence(problem.ids,"Coach · problema")}>Ver evidências</button>}</div>
      </article>

      <article className={"coach-signal change "+change.tone}>
        <span>MUDANÇA RECENTE</span>
        <h3>{change.title}</h3>
        <p>{change.body}</p>
        <div>{change.ids.length>0&&<button onClick={()=>onEvidence(change.ids,"Coach · mudança recente")}>Comparar blocos</button>}</div>
      </article>
    </div>

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
