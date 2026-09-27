import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { buildChibiArchetype, buildFocusBrief } from "../analysis/chibiArchetype";

type Props={
  matches:TftMatch[];
  onEvidence:(ids:string[],label:string)=>void;
};

function bar(value:number){
  return Math.max(0,Math.min(100,Math.round(value)));
}

export default function ChibiIdentity({matches,onEvidence}:Props){
  const archetype=useMemo(()=>buildChibiArchetype(matches),[matches]);
  const focus=useMemo(()=>buildFocusBrief(matches),[matches]);

  const dimensions=[
    {label:"Flex",value:archetype.dimensions.flexibility},
    {label:"Estabilidade",value:archetype.dimensions.stability},
    {label:"Conversão",value:archetype.dimensions.conversion},
    {label:"3★",value:archetype.dimensions.reroll},
    {label:"Nível",value:archetype.dimensions.level},
  ];

  return <section className="identity-brief">
    <article className="panel archetype-card">
      <div className="identity-kicker">CHIBI ARCHETYPE</div>
      <div className="archetype-title-row">
        <div>
          <h2>{archetype.title}</h2>
          <p>{archetype.description}</p>
        </div>
        <span>{matches.length} jogos</span>
      </div>

      <div className="archetype-bars">
        {dimensions.map(item=>(
          <div className="archetype-bar" key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{Math.round(item.value)}</strong>
            </div>
            <div className="archetype-track"><i style={{width:bar(item.value)+"%"}}/></div>
          </div>
        ))}
      </div>

      <small className="archetype-note">Arquétipo descritivo da amostra atual. Não mede habilidade, MMR ou estilo permanente.</small>
    </article>

    <article className={"panel focus-brief confidence-"+focus.confidence}>
      <div className="identity-kicker">FOCUS BRIEF</div>
      <div className="focus-head">
        <h2>{focus.title}</h2>
        <span>{focus.confidence}</span>
      </div>
      <p>{focus.body}</p>
      <div className="focus-evidence">
        <small>{focus.evidence}</small>
        {focus.matchIds.length>0&&<button onClick={()=>onEvidence(focus.matchIds,"Focus Brief · "+focus.title)}>Ver evidências</button>}
      </div>
    </article>
  </section>;
}
