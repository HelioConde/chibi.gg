import { useMemo, useState } from "react";
import { TftMatch, TftProfile } from "../api/tft";

type Props={
  profile:TftProfile;
  matches:TftMatch[];
};

type StudyFocus={
  id:string;
  label:string;
  question:string;
  hint:string;
};

const FOCUSES:StudyFocus[]=[
  {
    id:"lost",
    label:"Onde perdi?",
    question:"Em que ponto esta partida começou a dar errado?",
    hint:"Compare força final, ouro, nível, upgrades e o que poderia ter sido convertido.",
  },
  {
    id:"roll",
    label:"Rolldown",
    question:"Eu deveria ter rolado ou estabilizado de outra forma?",
    hint:"Procure sinais de board fraco, ouro não convertido e timing de estabilização.",
  },
  {
    id:"board",
    label:"Board",
    question:"Meu board final estava forte o suficiente para esta lobby?",
    hint:"Compare custo, estrelas, itens e traits com o resultado obtido.",
  },
  {
    id:"items",
    label:"Itens",
    question:"Minha distribuição de itens limitou esta partida?",
    hint:"Observe quem carregou os itens e se o board terminou com recursos pouco convertidos.",
  },
  {
    id:"flex",
    label:"Flex",
    question:"Eu forcei uma linha quando deveria ter pivotado?",
    hint:"Compare este board com suas linhas recorrentes e packages pessoais.",
  },
];

function formatWhen(value?:number){
  if(!value)return "";
  return new Date(value).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
}

function buildStudyUrl(profile:TftProfile,match:TftMatch,focus:StudyFocus,note:string){
  const url=new URL(window.location.href);
  url.hash="";
  url.search="";
  url.searchParams.set("player",profile.player.gameName);
  url.searchParams.set("tag",profile.player.tagLine);
  url.searchParams.set("region",profile.player.platform);
  url.searchParams.set("tab","matches");
  url.searchParams.set("study",match.id);
  url.searchParams.set("focus",focus.id);
  if(note.trim())url.searchParams.set("note",note.trim().slice(0,220));
  return url.toString();
}

export function studyFocusById(id:string|null|undefined){
  return FOCUSES.find(focus=>focus.id===id)||FOCUSES[0];
}

export default function ChibiStudyShare({profile,matches}:Props){
  const candidates=useMemo(
    ()=>matches
      .slice(0,10)
      .sort((a,b)=>{
        const aPriority=a.placement>=5?0:1;
        const bPriority=b.placement>=5?0:1;
        return aPriority-bPriority||(Number(b.playedAt)||0)-(Number(a.playedAt)||0);
      }),
    [matches],
  );

  const [matchId,setMatchId]=useState(candidates[0]?.id||"");
  const [focusId,setFocusId]=useState(FOCUSES[0].id);
  const [note,setNote]=useState("");
  const [copied,setCopied]=useState(false);

  const selected=candidates.find(match=>match.id===matchId)||candidates[0]||null;
  const focus=studyFocusById(focusId);
  const url=selected?buildStudyUrl(profile,selected,focus,note):"";

  async function copy(){
    if(!url)return;
    try{
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1800);
    }catch{
      setCopied(false);
    }
  }

  async function share(){
    if(!selected||!url)return;
    const nav=navigator as Navigator & {share?:(data:{title:string;text:string;url:string})=>Promise<void>};
    if(nav.share){
      try{
        await nav.share({
          title:"Chibi Study · "+profile.player.gameName,
          text:focus.question+(note.trim()?"\n"+note.trim():""),
          url,
        });
        return;
      }catch{}
    }
    await copy();
  }

  if(!selected)return null;

  return <section className="panel chibi-study-share">
    <div className="study-share-head">
      <div>
        <span>CHIBI STUDY</span>
        <h2>Peça uma segunda opinião sobre uma partida</h2>
        <p>Gere um link que abre diretamente a partida e mostra a pergunta que você quer discutir. Nesta versão não precisa de conta.</p>
      </div>
      <div className="study-share-badge">
        <b>Study Link</b>
        <small>MVP</small>
      </div>
    </div>

    <div className="study-share-layout">
      <div className="study-share-builder">
        <div className="study-field">
          <label>1. Escolha a partida</label>
          <div className="study-match-picker">
            {candidates.map(match=>(
              <button
                className={match.id===selected.id?"active":""}
                onClick={()=>setMatchId(match.id)}
                key={match.id}
              >
                <b>{match.placement}º</b>
                <span>lvl {match.level}</span>
                <small>{formatWhen(match.playedAt)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="study-field">
          <label>2. O que você quer descobrir?</label>
          <div className="study-focus-picker">
            {FOCUSES.map(item=>(
              <button
                className={item.id===focus.id?"active":""}
                onClick={()=>setFocusId(item.id)}
                key={item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="study-field">
          <label htmlFor="study-note">3. Contexto opcional</label>
          <textarea
            id="study-note"
            value={note}
            onChange={event=>setNote(event.target.value)}
            maxLength={220}
            placeholder="Ex.: eu tinha 42g no 4-2 e fiquei em dúvida se rolava até 20g..."
          />
          <small>{note.length}/220</small>
        </div>
      </div>

      <aside className="study-preview">
        <span>LINK DE REVIEW</span>
        <div className="study-preview-match">
          <strong>{selected.placement}º lugar</strong>
          <small>nível {selected.level} · {selected.goldLeft}g finais · {selected.units.length} unidades</small>
        </div>
        <h3>{focus.question}</h3>
        <p>{focus.hint}</p>
        {note.trim()&&<blockquote>{note.trim()}</blockquote>}
        <div className="study-preview-actions">
          <button onClick={copy}>{copied?"Link copiado ✓":"Copiar Study Link"}</button>
          <button className="primary" onClick={share}>Compartilhar</button>
        </div>
        <small className="study-privacy">O link contém Riot ID, ID público da partida e o texto que você escrever acima.</small>
      </aside>
    </div>
  </section>;
}
