import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { buildStyleShift } from "../analysis/styleShift";

type Props={
  matches:TftMatch[];
};

function signed(value:number|null,suffix=""){
  if(value==null) return "—";
  const rounded=Math.round(value*100)/100;
  return (rounded>0?"+":"")+rounded+suffix;
}

function placementTone(value:number|null){
  if(value==null) return "";
  return value<-.25?"good":value>.25?"bad":"neutral";
}

function normalTone(value:number,positiveIsGood=true){
  if(Math.abs(value)<5) return "neutral";
  const good=positiveIsGood?value>0:value<0;
  return good?"good":"bad";
}

export default function StyleShift({matches}:Props){
  const shift=useMemo(()=>buildStyleShift(matches),[matches]);

  if(!shift){
    return <section className="panel style-shift">
      <div className="innovation-head">
        <div>
          <span>STYLE SHIFT</span>
          <h2>Precisamos de mais partidas</h2>
        </div>
        <small>mínimo 6</small>
      </div>
      <p className="innovation-empty">Com dois blocos de pelo menos 3 jogos o Chibi começa a comparar como seu estilo está mudando.</p>
    </section>;
  }

  const rows=[
    {
      label:"Colocação média",
      previous:shift.previous.avgPlacement?.toFixed(2)??"—",
      recent:shift.recent.avgPlacement?.toFixed(2)??"—",
      delta:signed(shift.deltas.avgPlacement),
      tone:placementTone(shift.deltas.avgPlacement),
      hint:"menor é melhor",
    },
    {
      label:"Flexibilidade",
      previous:shift.previous.flexibility+"%",
      recent:shift.recent.flexibility+"%",
      delta:signed(shift.deltas.flexibility,"%"),
      tone:normalTone(shift.deltas.flexibility,true),
      hint:"diversidade de linhas",
    },
    {
      label:"Estabilidade",
      previous:shift.previous.stability+"%",
      recent:shift.recent.stability+"%",
      delta:signed(shift.deltas.stability,"%"),
      tone:normalTone(shift.deltas.stability,true),
      hint:"evitou Bottom 2",
    },
    {
      label:"Boards com 3★",
      previous:shift.previous.rerollRate+"%",
      recent:shift.recent.rerollRate+"%",
      delta:signed(shift.deltas.rerollRate,"%"),
      tone:"neutral",
      hint:"mudança de perfil, não qualidade",
    },
    {
      label:"Nível final médio",
      previous:shift.previous.avgLevel?.toFixed(1)??"—",
      recent:shift.recent.avgLevel?.toFixed(1)??"—",
      delta:signed(shift.deltas.avgLevel),
      tone:"neutral",
      hint:"board final",
    },
  ];

  const rawHeadline=(()=>{
    const candidates=[
      {label:"mais flexível",value:shift.deltas.flexibility},
      {label:"mais estável",value:shift.deltas.stability},
      {label:"mais orientado a 3★",value:shift.deltas.rerollRate},
    ].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));

    const biggest=candidates[0];
    if(Math.abs(biggest.value)<10){
      return "Seu estilo mudou pouco entre os dois blocos";
    }
    if(biggest.label==="mais flexível"&&biggest.value<0) return "Sua flexibilidade caiu no bloco recente";
    if(biggest.label==="mais estável"&&biggest.value<0) return "Sua estabilidade caiu no bloco recente";
    if(biggest.label==="mais orientado a 3★"&&biggest.value<0) return "Você terminou menos partidas com 3★";
    return "Seu bloco recente ficou "+biggest.label;
  })();

  const headline=shift.confidence==="baixa"
    ? "Sinal inicial: "+rawHeadline.charAt(0).toLowerCase()+rawHeadline.slice(1)
    : rawHeadline;

  return <section className="panel style-shift">
    <div className="innovation-head">
      <div>
        <span>STYLE SHIFT</span>
        <h2>{headline}</h2>
      </div>
      <small>{shift.confidence}</small>
    </div>

    <div className="style-shift-head">
      <span>{shift.window} anteriores</span>
      <span>{shift.window} recentes</span>
      <span>Δ</span>
    </div>

    <div className="style-shift-list">
      {rows.map(row=>(
        <div className="style-shift-row" key={row.label}>
          <div>
            <strong>{row.label}</strong>
            <small>{row.hint}</small>
          </div>
          <span>{row.previous}</span>
          <span>{row.recent}</span>
          <b className={row.tone}>{row.delta}</b>
        </div>
      ))}
    </div>

    <p className="innovation-note">{shift.confidence==="baixa"
      ? "Amostra pequena: trate esta mudança como sinal inicial. Style Shift descreve diferença observada, não evolução de habilidade."
      : "Style Shift compara dois blocos iguais de partidas no mesmo contexto. Ele descreve mudança observada, não evolução de habilidade."}</p>
  </section>;
}
