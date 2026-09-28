import { FormEvent, useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import { answerChibiQuestion, AskChibiAnswer } from "../analysis/askChibi";

type Props={
  playerName:string;
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
};

type ChatItem=
  | {id:number;role:"user";text:string}
  | {id:number;role:"chibi";answer:AskChibiAnswer};

const QUICK_QUESTIONS=[
  "Por que estou perdendo?",
  "O que devo fazer agora?",
  "Estou forçando comp?",
  "O que mudou recentemente?",
  "Qual linha funciona melhor para mim?",
  "Como eu jogo?",
];

export default function AskChibi({playerName,matches,onEvidence}:Props){
  const [open,setOpen]=useState(false);
  const [input,setInput]=useState("");
  const [counter,setCounter]=useState(1);
  const [items,setItems]=useState<ChatItem[]>([]);

  const initial=useMemo(
    ()=>answerChibiQuestion("",matches),
    [matches]
  );

  useEffect(()=>{
    const onOpen=()=>setOpen(true);
    window.addEventListener("chibi:open",onOpen);
    return ()=>window.removeEventListener("chibi:open",onOpen);
  },[]);

  useEffect(()=>{
    if(!open) return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape") setOpen(false);
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[open]);

  useEffect(()=>{
    setItems([]);
    setInput("");
  },[playerName]);

  function ask(question:string){
    const value=question.trim();
    if(!value) return;

    const answer=answerChibiQuestion(value,matches);
    const next=counter;
    setItems(current=>[
      ...current,
      {id:next,role:"user",text:value},
      {id:next+1,role:"chibi",answer},
    ]);
    setCounter(next+2);
    setInput("");
  }

  function submit(event:FormEvent){
    event.preventDefault();
    ask(input);
  }

  function openEvidence(answer:AskChibiAnswer){
    if(!answer.matchIds.length) return;
    setOpen(false);
    onEvidence(answer.matchIds,"Ask Chibi · "+answer.title);
  }

  const lastAnswer=[...items].reverse().find(
    (item):item is Extract<ChatItem,{role:"chibi"}>=>item.role==="chibi"
  )?.answer;

  return <>
    <button
      className={"ask-chibi-fab "+(open?"open":"")}
      onClick={()=>setOpen(value=>!value)}
      aria-label={open?"Fechar Ask Chibi":"Abrir Ask Chibi"}
    >
      <span className="ask-chibi-orb">c</span>
      <span>
        <b>Ask Chibi</b>
        <small>Pergunte sobre seu jogo</small>
      </span>
    </button>

    {open&&<div className="ask-chibi-backdrop" onClick={()=>setOpen(false)}/>}

    <aside className={"ask-chibi-drawer "+(open?"open":"")} aria-hidden={!open}>
      <header className="ask-chibi-head">
        <div>
          <span>ASK CHIBI</span>
          <h2>Pergunte sobre {playerName}</h2>
          <p>Só respondo com o histórico carregado. Sem evidência, eu digo que não sei.</p>
        </div>
        <button onClick={()=>setOpen(false)} aria-label="Fechar">×</button>
      </header>

      <div className="ask-chibi-context">
        <span>{matches.length} partidas</span>
        <span>contexto atual</span>
        <b>evidence-first</b>
      </div>

      <div className="ask-chibi-chat">
        {!items.length&&<article className="chibi-message welcome">
          <div className="chibi-avatar">c</div>
          <div>
            <span>CHIBI</span>
            <h3>{initial.title}</h3>
            <p>{initial.body}</p>
            <div className="ask-quick-list">
              {QUICK_QUESTIONS.slice(0,4).map(question=>(
                <button onClick={()=>ask(question)} key={question}>{question}</button>
              ))}
            </div>
          </div>
        </article>}

        {items.map(item=>item.role==="user"
          ? <article className="user-message" key={item.id}><p>{item.text}</p></article>
          : <article className="chibi-message" key={item.id}>
              <div className="chibi-avatar">c</div>
              <div>
                <div className="chibi-answer-meta">
                  <span>CHIBI</span>
                  <em className={"confidence-"+item.answer.confidence}>{item.answer.confidence}</em>
                </div>
                <h3>{item.answer.title}</h3>
                <p>{item.answer.body}</p>

                {item.answer.bullets.length>0&&<ul>
                  {item.answer.bullets.map((bullet,index)=><li key={index}>{bullet}</li>)}
                </ul>}

                <div className="chibi-evidence-line">
                  <small>{item.answer.evidence}</small>
                  {item.answer.matchIds.length>0&&<button onClick={()=>openEvidence(item.answer)}>
                    Ver {item.answer.matchIds.length} partida{item.answer.matchIds.length===1?"":"s"} →
                  </button>}
                </div>
              </div>
            </article>
        )}
      </div>

      <div className="ask-chibi-followups">
        {(lastAnswer?.followups||QUICK_QUESTIONS.slice(0,3)).slice(0,3).map(question=>(
          <button onClick={()=>ask(question)} key={question}>{question}</button>
        ))}
      </div>

      <form className="ask-chibi-input" onSubmit={submit}>
        <input
          value={input}
          onChange={event=>setInput(event.target.value.slice(0,180))}
          placeholder="Ex.: por que estou terminando em 5º?"
          aria-label="Pergunta para o Chibi"
        />
        <button type="submit" disabled={!input.trim()}>Perguntar</button>
      </form>

      <footer className="ask-chibi-foot">
        O Chibi descreve padrões observados; não conhece decisões que não aparecem na API ou no Journal.
      </footer>
    </aside>
  </>;
}
