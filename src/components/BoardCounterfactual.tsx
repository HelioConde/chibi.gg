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

  return <section className="counterfactual-lab">
    <div className="counter-head">
      <div>
        <span>COUNTERFACTUAL LAB</span>
        <h3>Como boards parecidos seus terminaram?</h3>
      </div>
      <small>Seu histórico</small>
    </div>

    {!result.similar.length?(
      <p className="counter-empty">Ainda não existem boards suficientemente parecidos nesta amostra para uma comparação útil.</p>
    ):<>
      <div className="counter-summary">
        <div>
          <span>Board aberto</span>
          <strong>{target.placement}º</strong>
        </div>
        <div>
          <span>Boards parecidos</span>
          <strong>{result.similar.length}</strong>
        </div>
        <div>
          <span>Média dos parecidos</span>
          <strong>{result.avgAll?.toFixed(2)??"—"}</strong>
        </div>
        <div>
          <span>Melhores que este</span>
          <strong>{result.better.length}</strong>
        </div>
      </div>

      {bestBetter&&<article className="counter-highlight">
        <div className="counter-highlight-title">
          <div className={"placement "+placementClass(bestBetter.match.placement)}>{bestBetter.match.placement}º</div>
          <div>
            <span>COMPARAÇÃO MAIS INTERESSANTE</span>
            <strong>{bestBetter.similarity}% semelhante</strong>
          </div>
        </div>

        <div className="counter-diffs">
          <div>
            <span>Traits em comum</span>
            <p>{bestBetter.sharedTraits.slice(0,4).map(id=>traitName(id,staticData)).join(" · ")||"—"}</p>
          </div>
          <div>
            <span>Unidades em comum</span>
            <p>{bestBetter.sharedUnits.slice(0,6).map(id=>unitName(id,staticData)).join(" · ")||"—"}</p>
          </div>
          <div>
            <span>Diferenças observadas</span>
            <p>
              {bestBetter.levelDelta!==0
                ? "Nível "+(bestBetter.levelDelta>0?"+":"")+bestBetter.levelDelta+". "
                : ""}
              {bestBetter.threeStarDelta!==0
                ? (bestBetter.threeStarDelta>0?"+":"")+bestBetter.threeStarDelta+" unidade(s) 3★. "
                : ""}
              {bestBetter.addedUnits.length
                ? "Entraram "+bestBetter.addedUnits.slice(0,3).map(id=>unitName(id,staticData)).join(", ")+"."
                : ""}
            </p>
          </div>
        </div>

        <button onClick={()=>onEvidence([target.id,bestBetter.match.id],"Counterfactual · board atual vs melhor semelhante")}>
          Comparar as 2 partidas no histórico
        </button>
      </article>}

      <div className="counter-list">
        {result.similar.slice(0,4).map(item=>(
          <button
            key={item.match.id}
            onClick={()=>onEvidence([target.id,item.match.id],"Counterfactual · "+item.similarity+"% semelhante")}
          >
            <span className={"counter-place "+placementClass(item.match.placement)}>{item.match.placement}º</span>
            <div>
              <strong>{item.similarity}% semelhante</strong>
              <small>
                {item.sharedTraits.slice(0,2).map(id=>traitName(id,staticData)).join(" · ")||"Board parecido"}
              </small>
            </div>
            <div className="counter-level">Nv. {item.match.level}</div>
          </button>
        ))}
      </div>

      <p className="counter-disclaimer">Semelhança usa board final, traits, augments e nível. Isto é comparação observacional: não prova que uma troca específica causaria outra colocação.</p>
    </>}
  </section>;
}
