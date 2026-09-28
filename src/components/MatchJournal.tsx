import { useEffect, useMemo, useState } from "react";
import { TftMatch, TftMatchDetail } from "../api/tft";
import { buildLobbyAutopsy } from "../analysis/lobbyAutopsy";
import { getJournalEntry, JOURNAL_TAGS, MatchJournalEntry, saveJournalEntry } from "../journal";

type Props={
  matchId:string;
  placement:number;
  target?:TftMatch;
  detail?:TftMatchDetail;
  onSaved?:()=>void;
};

function reviewGuide(target?:TftMatch,detail?:TftMatchDetail){
  if(!target||!detail)return null;
  const autopsy=buildLobbyAutopsy(target,detail);
  const primary=autopsy.signals[0];
  if(!primary)return null;

  if(primary.id==="carry-contest"||primary.id==="contest"){
    return {
      label:"SCOUT & FLEX",
      question:"Quando você percebeu que sua linha estava contestada? Ainda existia uma saída usando seus itens?",
      why:"O snapshot final mostra contestação. Só você consegue registrar quando ela ficou visível e se havia espaço real para pivotar.",
    };
  }

  if(primary.id==="gold-left"){
    return {
      label:"ECONOMIA",
      question:"Qual foi a última rodada em que gastar mais ouro poderia ter mudado seu board?",
      why:"O Chibi vê ouro sobrando no fim, mas não sabe se gastar antes era seguro ou se o shop ofereceu upgrades.",
    };
  }

  if(primary.id==="level-gap"){
    return {
      label:"TEMPO",
      question:"O que impediu você de acompanhar o nível da lobby: opener, HP, economia ou necessidade de rolar?",
      why:"O gap de nível existe no snapshot, mas a causa aconteceu antes dele.",
    };
  }

  if(primary.id==="level-no-conversion"||primary.id==="board-value-gap"||primary.id==="above-gap"){
    return {
      label:"CONVERSÃO",
      question:"Depois de chegar ao seu nível final, quais upgrades ou slots você ainda precisava encontrar?",
      why:"Seu nível sozinho não explicou a colocação. Registre o que faltava para o ouro virar força real de board.",
    };
  }

  if(primary.id==="item-gap"){
    return {
      label:"ITENS",
      question:"Você segurou componentes, fez slams cedo ou terminou com itens difíceis de encaixar?",
      why:"A API mostra os itens equipados no fim, mas não mostra componentes no bench nem quando cada item foi fechado.",
    };
  }

  if(primary.id==="star-gap"){
    return {
      label:"UPGRADES",
      question:"Seu plano dependia de uma unidade 3★? Em que momento continuar rolando deixou de valer a pena?",
      why:"O snapshot mostra menos upgrades, mas não revela quantas cópias você viu ou perdeu no caminho.",
    };
  }

  if(primary.id==="similar-better"){
    return {
      label:"COMPARAÇÃO",
      question:"O board parecido que ficou acima fez algo que você conscientemente decidiu não fazer?",
      why:"A estrutura final é parecida; sua memória da partida pode explicar diferenças que o snapshot não captura.",
    };
  }

  return {
    label:"DECISÃO-CHAVE",
    question:"Qual decisão desta partida você mudaria se pudesse voltar uma rodada?",
    why:"Os dados finais não mostram um gap dominante. O contexto que você registrar aqui melhora as próximas revisões.",
  };
}

export default function MatchJournal({matchId,placement,target,detail,onSaved}:Props){
  const [entry,setEntry]=useState<MatchJournalEntry>(()=>getJournalEntry(matchId));
  const [saved,setSaved]=useState(false);
  const guide=useMemo(()=>reviewGuide(target,detail),[target,detail]);

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

  function usePrompt(){
    if(!guide)return;
    setEntry(current=>({
      ...current,
      note:current.note.trim()
        ? current.note
        : (guide.question+" ").slice(0,280),
    }));
    setSaved(false);
  }

  return <section className="match-journal guided-journal">
    <div className="journal-head">
      <div>
        <span>CHIBI JOURNAL</span>
        <h3>O que a API não sabe sobre esta partida?</h3>
      </div>
      <small>{placement}º lugar</small>
    </div>

    {guide&&<article className="journal-guide">
      <div>
        <span>{guide.label}</span>
        <strong>{guide.question}</strong>
        <p>{guide.why}</p>
      </div>
      <button type="button" onClick={usePrompt}>Responder no Journal</button>
    </article>}

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
      placeholder={guide
        ? "Responda com o que você lembra da decisão, do timing ou do estado da lobby..."
        : "Ex.: eu tinha Guinsoo + arco, forcei reroll mesmo contestado e rolei no 7..."}
      rows={3}
    />

    <div className="journal-footer">
      <small>{entry.note.length}/280 · salvo somente neste navegador</small>
      <button type="button" onClick={save}>{saved?"Salvo ✓":"Salvar contexto"}</button>
    </div>
  </section>;
}
