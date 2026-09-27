import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { buildCounterfactual } from "../analysis/boardCounterfactual";
import { staticEntry, TftStaticData } from "../tftStatic";

type Props={
  target:TftMatch;
  history:TftMatch[];
  staticData:TftStaticData|null;
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

function unitName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.name||clean(id);
}

function placementClass(value:number){
  if(value===1) return "p1";
  if(value<=4) return "p2";
  if(value>=7) return "p7";
  return "";
}

export default function BoardCounterfactual({target,history,staticData,onEvidence}:Props){
  const result=useMemo(()=>buildCounterfactual(target,history),[target,history]);
  const bestBetter=result.better[0]||null;

  const headline=useMemo(()=>{
    if(!result.similar.length) return "Ainda não há comparação confiável para este board.";
    if(result.avgAll==null) return "Há boards parecidos no seu histórico.";
    const delta=target.placement-result.avgAll;
    if(delta>=1.25) return "Boards parecidos terminaram melhor do que este.";
    if(delta<=-1.25) return "Este board terminou melhor do que seus parecidos.";
    return "Seus boards parecidos tiveram resultado próximo.";
  },[result,target.placement]);

  const explanation=useMemo(()=>{
    if(!result.similar.length) return "Carregue mais partidas do mesmo set e fila para o Chibi encontrar comparações úteis.";
    return `${result.similar.length} board${result.similar.length===1?"":"s"} parecido${result.similar.length===1?"":"s"} · média ${result.avgAll?.toFixed(2)??"—"} · este terminou em ${target.placement}º.`;
  },[result,target.placement]);

  return <section className="counterfactual-lab counterfactual-v2">
    <div className="counter-head">
      <div>
        <span>COMPARAÇÃO DO SEU HISTÓRICO</span>
        <h3>{headline}</h3>
      </div>
      <small>{result.similar.length ? result.similar.length+" comparações" : "amostra insuficiente"}</small>
    </div>

    <p className="counter-primary-copy">{explanation}</p>

    {bestBetter&&<article className="counter-highlight counter-highlight-primary">
      <div className="counter-highlight-title">
        <div className={"placement "+placementClass(bestBetter.match.placement)}>{bestBetter.match.placement}º</div>
        <div>
          <span>COMPARAÇÃO MAIS ÚTIL</span>
          <strong>{bestBetter.similarity}% semelhante</strong>
          <small>um board parecido que terminou melhor</small>
        </div>
      </div>

      <div className="counter-diffs compact">
        <div>
          <span>Em comum</span>
          <p>{bestBetter.sharedTraits.slice(0,3).map(id=>traitName(id,staticData)).join(" · ")||"Traits semelhantes"}</p>
        </div>
        <div>
          <span>Diferença observável</span>
          <p>
            {bestBetter.levelDelta!==0
              ? "Nível "+(bestBetter.levelDelta>0?"+":"")+bestBetter.levelDelta+". "
              : ""}
            {bestBetter.threeStarDelta!==0
              ? (bestBetter.threeStarDelta>0?"+":"")+bestBetter.threeStarDelta+" unidade(s) 3★. "
              : ""}
            {bestBetter.addedUnits.length
              ? "Entraram "+bestBetter.addedUnits.slice(0,2).map(id=>unitName(id,staticData)).join(", ")+"."
              : "Board final semelhante sem uma diferença única dominante."}
          </p>
        </div>
      </div>

      <button onClick={()=>onEvidence([target.id,bestBetter.match.id],"Counterfactual · board atual vs melhor semelhante")}>
        Comparar estas 2 partidas
      </button>
    </article>}

    {result.similar.length>0&&<details className="counter-more">
      <summary>
        <span><b>Ver todas as comparações</b><small>estatísticas, outros boards parecidos e metodologia</small></span>
        <em>Detalhes</em>
      </summary>

      <div className="counter-more-body">
        <div className="counter-summary">
          <div><span>Board aberto</span><strong>{target.placement}º</strong></div>
          <div><span>Boards parecidos</span><strong>{result.similar.length}</strong></div>
          <div><span>Média dos parecidos</span><strong>{result.avgAll?.toFixed(2)??"—"}</strong></div>
          <div><span>Melhores que este</span><strong>{result.better.length}</strong></div>
        </div>

        <div className="counter-list">
          {result.similar.slice(0,4).map(item=>(
            <button
              key={item.match.id}
              onClick={()=>onEvidence([target.id,item.match.id],"Counterfactual · "+item.similarity+"% semelhante")}
            >
              <span className={"counter-place "+placementClass(item.match.placement)}>{item.match.placement}º</span>
              <div>
                <strong>{item.similarity}% semelhante</strong>
                <small>{item.sharedTraits.slice(0,2).map(id=>traitName(id,staticData)).join(" · ")||"Board parecido"}</small>
              </div>
              <div className="counter-level">Nv. {item.match.level}</div>
            </button>
          ))}
        </div>

        <p className="counter-disclaimer">Semelhança usa board final, traits, augments e nível. É comparação observacional: não prova que uma troca específica causaria outra colocação.</p>
      </div>
    </details>}

    {!result.similar.length&&<p className="counter-empty">Este bloco fica mais útil conforme você carrega mais partidas comparáveis.</p>}
  </section>;
}
