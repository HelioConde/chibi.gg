import { useEffect, useState } from "react";
import { getJournalEntry, JOURNAL_TAGS, MatchJournalEntry, saveJournalEntry } from "../journal";

type Props={
  matchId:string;
  placement:number;
  onSaved?:()=>void;
};

export default function MatchJournal({matchId,placement,onSaved}:Props){
  const [entry,setEntry]=useState<MatchJournalEntry>(()=>getJournalEntry(matchId));
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    setEntry(getJournalEntry(matchId));
    setSaved(false);
  },[matchId]);

  function toggleTag(id:MatchJournalEntry["tags"][number]){
    setEntry(current=>({
      ...current,
      tags:current.tags.includes(id)
        ? current.tags.filter(tag=>tag!==id)
        : [...current.tags,id],
    }));
    setSaved(false);
  }

  function save(){
    saveJournalEntry(entry);
    setSaved(true);
    onSaved?.();
  }

  return <section className="match-journal">
    <div className="journal-head">
      <div>
        <span>CHIBI JOURNAL</span>
        <h3>O que a API não sabe sobre esta partida?</h3>
      </div>
      <small>{placement}º lugar</small>
    </div>

    <div className="journal-tags">
      {JOURNAL_TAGS.map(tag=>(
        <button
          type="button"
          className={entry.tags.includes(tag.id)?"active":""}
          onClick={()=>toggleTag(tag.id)}
          title={tag.help}
          key={tag.id}
        >
          {tag.label}
        </button>
      ))}
    </div>

    <textarea
      value={entry.note}
      onChange={(event)=>{setEntry(current=>({...current,note:event.target.value.slice(0,280)}));setSaved(false);}}
      placeholder="Ex.: eu tinha Guinsoo + arco, forcei reroll mesmo contestado e rolei no 7..."
      rows={3}
    />

    <div className="journal-footer">
      <small>{entry.note.length}/280 · salvo somente neste navegador</small>
      <button type="button" onClick={save}>{saved?"Salvo ✓":"Salvar contexto"}</button>
    </div>
  </section>;
}
