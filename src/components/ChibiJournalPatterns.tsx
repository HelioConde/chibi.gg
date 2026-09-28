import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { getJournalEntries, JOURNAL_TAGS, JournalTag } from "../journal";

type Props={
  matches:TftMatch[];
  journalVersion:number;
  onEvidence:(ids:string[],label:string)=>void;
};

type PatternRow={
  id:JournalTag;
  label:string;
  help:string;
  mentions:number;
  top4Rate:number;
  bottom4Rate:number;
  avgPlacement:number;
  overallBottom4Rate:number;
  deltaBottom4:number;
  tone:"warning"|"good"|"neutral";
  confidence:"alta"|"média"|"inicial";
  ids:string[];
  notes:string[];
};

function pct(n:number,d:number){
  return d?Math.round(n/d*100):0;
}

function confidence(mentions:number):PatternRow["confidence"]{
  if(mentions>=5)return "alta";
  if(mentions>=3)return "média";
  return "inicial";
}

export default function ChibiJournalPatterns({matches,journalVersion,onEvidence}:Props){
  const rows=useMemo(()=>{
    void journalVersion;

    const byId=new Map(matches.map(match=>[match.id,match]));
    const entries=getJournalEntries(matches.map(match=>match.id))
      .filter(entry=>entry.tags.length>0||entry.note.trim()||(entry.reviewedAreas?.length||0)>0);

    if(!entries.length)return [] as PatternRow[];

    const journaledMatches=entries
      .map(entry=>byId.get(entry.matchId))
      .filter((match):match is TftMatch=>Boolean(match));

    const overallBottom4Rate=pct(
      journaledMatches.filter(match=>match.placement>=5).length,
      journaledMatches.length,
    );

    return JOURNAL_TAGS.map(tag=>{
      const tagged=entries.filter(entry=>entry.tags.includes(tag.id));
      const taggedMatches=tagged
        .map(entry=>byId.get(entry.matchId))
        .filter((match):match is TftMatch=>Boolean(match));

      const mentions=taggedMatches.length;
      if(!mentions)return null;

      const top4=taggedMatches.filter(match=>match.placement<=4).length;
      const bottom4=taggedMatches.filter(match=>match.placement>=5).length;
      const avgPlacement=taggedMatches.reduce((sum,match)=>sum+match.placement,0)/mentions;
      const bottom4Rate=pct(bottom4,mentions);
      const top4Rate=pct(top4,mentions);
      const deltaBottom4=bottom4Rate-overallBottom4Rate;

      const positiveTag=tag.id==="good-scout"||tag.id==="pivoted";
      let tone:PatternRow["tone"]="neutral";

      if(positiveTag&&mentions>=2&&top4Rate>=60)tone="good";
      else if(!positiveTag&&mentions>=2&&bottom4Rate>=60&&deltaBottom4>=10)tone="warning";
      else if(!positiveTag&&mentions>=3&&avgPlacement>=5)tone="warning";

      return {
        id:tag.id,
        label:tag.label,
        help:tag.help,
        mentions,
        top4Rate,
        bottom4Rate,
        avgPlacement:+avgPlacement.toFixed(2),
        overallBottom4Rate,
        deltaBottom4,
        tone,
        confidence:confidence(mentions),
        ids:taggedMatches.map(match=>match.id),
        notes:tagged
          .filter(entry=>entry.note.trim())
          .sort((a,b)=>b.updatedAt-a.updatedAt)
          .slice(0,2)
          .map(entry=>entry.note.trim()),
      } satisfies PatternRow;
    })
      .filter((row):row is PatternRow=>Boolean(row))
      .sort((a,b)=>{
        const toneScore=(row:PatternRow)=>row.tone==="warning"?3:row.tone==="good"?2:1;
        return toneScore(b)-toneScore(a)||b.mentions-a.mentions;
      });
  },[matches,journalVersion]);

  const warning=rows.find(row=>row.tone==="warning")||null;
  const good=rows.find(row=>row.tone==="good")||null;
  const totalJournaled=useMemo(()=>{
    void journalVersion;
    return getJournalEntries(matches.map(match=>match.id))
      .filter(entry=>entry.tags.length>0||entry.note.trim()||(entry.reviewedAreas?.length||0)>0).length;
  },[matches,journalVersion]);

  const reviewedCoverage=useMemo(()=>{
    void journalVersion;
    const entries=getJournalEntries(matches.map(match=>match.id))
      .filter(entry=>(entry.reviewedAreas?.length||0)>0);
    const complete=entries.filter(entry=>(entry.reviewedAreas?.length||0)>=6).length;
    return {entries:entries.length,complete};
  },[matches,journalVersion]);

  if(!rows.length)return <section className="journal-patterns-empty">
    <span>PADRÕES DO JOURNAL</span>
    <strong>{reviewedCoverage.entries
      ? "Você já revisou partidas, mas nenhum comportamento se repetiu o suficiente."
      : "Seus próprios relatos ainda não formam um padrão."}</strong>
    <p>{reviewedCoverage.entries
      ? reviewedCoverage.entries+" partida(s) passaram pelo checklist · "+reviewedCoverage.complete+" review(s) 6/6. Continue registrando boas e ruins."
      : "Use o Quick Review Checklist em algumas partidas. O Chibi vai cruzar o que você sentiu com o resultado real."}</p>
  </section>;

  return <section className="journal-patterns">
    <div className="journal-patterns-head">
      <div>
        <span>O QUE VOCÊ MESMO ESTÁ REPETINDO</span>
        <h3>Contexto humano + resultado da partida</h3>
        <p>O Chibi usa apenas o que você registrou no Journal e compara com as colocações dessas partidas.</p>
      </div>
      <div className="journal-patterns-sample">
        <small>PARTIDAS COM JOURNAL</small>
        <strong>{totalJournaled}</strong>
        <span>{rows.length} tag{rows.length===1?"":"s"} · {reviewedCoverage.complete} review{reviewedCoverage.complete===1?"":"s"} 6/6</span>
      </div>
    </div>

    {(warning||good)&&<div className="journal-patterns-summary">
      {warning&&<article className="warning">
        <span>PADRÃO PARA REVISAR</span>
        <strong>{warning.label}</strong>
        <p>Apareceu em {warning.mentions} partida{warning.mentions===1?"":"s"} · média {warning.avgPlacement} · Bottom 4 {warning.bottom4Rate}%.</p>
        <small>Seu Bottom 4 nas partidas com Journal é {warning.overallBottom4Rate}%.</small>
      </article>}

      {good&&<article className="good">
        <span>HÁBITO POSITIVO</span>
        <strong>{good.label}</strong>
        <p>Apareceu em {good.mentions} partida{good.mentions===1?"":"s"} · média {good.avgPlacement} · Top 4 {good.top4Rate}%.</p>
        <small>Continue registrando para ver se o sinal se mantém.</small>
      </article>}
    </div>}

    <div className="journal-pattern-list">
      {rows.slice(0,6).map(row=>(
        <article className={"journal-pattern-row "+row.tone} key={row.id}>
          <div className="journal-pattern-main">
            <div className="journal-pattern-title">
              <div>
                <span>{row.tone==="warning"?"REVISAR":row.tone==="good"?"POSITIVO":"OBSERVADO"}</span>
                <strong>{row.label}</strong>
              </div>
              <b className={"journal-pattern-confidence "+row.confidence}>{row.confidence}</b>
            </div>
            <p>{row.help}</p>
            {row.notes[0]&&<blockquote>{row.notes[0]}</blockquote>}
          </div>

          <div className="journal-pattern-stats">
            <span><small>Menções</small><b>{row.mentions}</b></span>
            <span><small>Média</small><b>{row.avgPlacement}</b></span>
            <span><small>Top 4</small><b>{row.top4Rate}%</b></span>
            <span><small>Bottom 4</small><b>{row.bottom4Rate}%</b></span>
          </div>

          <button onClick={()=>onEvidence(row.ids,"Journal · "+row.label)}>Ver partidas</button>
        </article>
      ))}
    </div>

    <p className="journal-pattern-note">Correlação não é causa. Uma tag pode aparecer nas derrotas porque você só percebe esse comportamento quando o jogo já estava ruim. Quanto mais você registrar também em partidas boas, melhor fica a comparação.</p>
  </section>;
}
