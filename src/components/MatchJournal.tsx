import { useEffect, useMemo, useState } from "react";
import { TftMatch, TftMatchDetail } from "../api/tft";
import { buildLobbyAutopsy } from "../analysis/lobbyAutopsy";
import { getJournalEntry, JOURNAL_TAGS, MatchJournalEntry, saveJournalEntry } from "../journal";
import { saveLesson } from "../lessons";

type Props={
  matchId:string;
  placement:number;
  playerKey?:string;
  target?:TftMatch;
  detail?:TftMatchDetail;
  onSaved?:()=>void;
};

const REVIEW_CHECKLIST:Array<{
  id:string;
  label:string;
  question:string;
  tags:MatchJournalEntry["tags"];
  options:Array<{tag:MatchJournalEntry["tags"][number];label:string}>;
}>=[
  {
    id:"direction",
    label:"DIREÇÃO",
    question:"Você entrou preso em uma linha antes de ter sinal suficiente?",
    tags:["forced"],
    options:[{tag:"forced",label:"Forcei uma linha"}],
  },
  {
    id:"roll",
    label:"ROLLDOWN",
    question:"O timing do gasto de ouro pareceu errado?",
    tags:["early-roll","late-roll"],
    options:[
      {tag:"early-roll",label:"Rolei cedo"},
      {tag:"late-roll",label:"Rolei tarde"},
    ],
  },
  {
    id:"items",
    label:"ITENS",
    question:"Os componentes viraram força no momento certo?",
    tags:["greeded-items","awkward-items"],
    options:[
      {tag:"greeded-items",label:"Segurei componentes"},
      {tag:"awkward-items",label:"Itens desconfortáveis"},
    ],
  },
  {
    id:"scout",
    label:"SCOUT",
    question:"Sua leitura da lobby realmente mudou decisões?",
    tags:["good-scout","missed-scout"],
    options:[
      {tag:"good-scout",label:"Boa leitura"},
      {tag:"missed-scout",label:"Não scoutei"},
    ],
  },
  {
    id:"position",
    label:"POSICIONAMENTO",
    question:"Uma luta importante parece ter sido perdida por posicionamento?",
    tags:["bad-position"],
    options:[{tag:"bad-position",label:"Posicionamento ruim"}],
  },
  {
    id:"flex",
    label:"FLEX",
    question:"Você mudou de plano de forma relevante durante a partida?",
    tags:["pivoted"],
    options:[{tag:"pivoted",label:"Fiz pivot"}],
  },
];

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

export default function MatchJournal({matchId,placement,playerKey="",target,detail,onSaved}:Props){
  const [entry,setEntry]=useState<MatchJournalEntry>(()=>getJournalEntry(matchId));
  const [saved,setSaved]=useState(false);
  const [lessonSaved,setLessonSaved]=useState(false);
  const guide=useMemo(()=>reviewGuide(target,detail),[target,detail]);

  useEffect(()=>{
    setEntry(getJournalEntry(matchId));
    setSaved(false);
    setLessonSaved(false);
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

  function setChecklistTag(
    selected:MatchJournalEntry["tags"][number]|null,
    group:MatchJournalEntry["tags"],
    areaId:string,
  ){
    setEntry(current=>{
      const remaining=current.tags.filter(tag=>!group.includes(tag));
      const reviewedAreas=current.reviewedAreas||[];
      return {
        ...current,
        tags:selected?[...remaining,selected]:remaining,
        reviewedAreas:reviewedAreas.includes(areaId)
          ? reviewedAreas
          : [...reviewedAreas,areaId],
      };
    });
    setSaved(false);
    setLessonSaved(false);
  }

  function save(){
    saveJournalEntry(entry);
    setSaved(true);
    onSaved?.();
  }

  function saveAsLesson(){
    if(!playerKey||!entry.note.trim())return;
    saveJournalEntry(entry);
    const lesson=saveLesson(playerKey,matchId,entry.note);
    if(lesson)setLessonSaved(true);
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

    <details className="journal-review-checklist">
      <summary>
        <span><b>Quick Review Checklist</b><small>6 perguntas para revisar sem precisar saber de antemão qual foi o erro.</small></span>
        <em>{entry.reviewedAreas?.length||0}/{REVIEW_CHECKLIST.length} revisado</em>
      </summary>
      <div className="journal-checklist-progress">
        <span>{entry.reviewedAreas?.length||0} de {REVIEW_CHECKLIST.length} áreas verificadas</span>
        <i><b style={{width:Math.round(((entry.reviewedAreas?.length||0)/REVIEW_CHECKLIST.length)*100)+"%"}}/></i>
      </div>
      <div className="journal-checklist-grid">
        {REVIEW_CHECKLIST.map(item=>{
          const selected=item.tags.find(tag=>entry.tags.includes(tag))||null;
          const reviewed=(entry.reviewedAreas||[]).includes(item.id);
          return <article className={reviewed?"answered":""} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.question}</strong>
            <div>
              {item.options.map(option=>(
                <button
                  type="button"
                  className={entry.tags.includes(option.tag)?"active":""}
                  onClick={()=>setChecklistTag(
                    entry.tags.includes(option.tag)?null:option.tag,
                    item.tags,
                    item.id,
                  )}
                  key={option.tag}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                className={!selected?"clear active": "clear"}
                onClick={()=>setChecklistTag(null,item.tags,item.id)}
              >
                Sem sinal
              </button>
            </div>
          </article>;
        })}
      </div>
    </details>

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
      <div className="journal-footer-actions">
        {playerKey&&entry.note.trim()&&<button type="button" className="lesson-button" onClick={saveAsLesson}>
          {lessonSaved?"Lição salva ✓":"Salvar como lição"}
        </button>}
        <button type="button" onClick={save}>{saved?"Salvo ✓":"Salvar contexto"}</button>
      </div>
    </div>
  </section>;
}
