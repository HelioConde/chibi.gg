import { useMemo } from "react";
import { TftMatch } from "../api/tft";
import { staticEntry, tftAssetUrl, TftStaticData } from "../tftStatic";

type Props={
  matches:TftMatch[];
  staticData:TftStaticData|null;
  onEvidence:(ids:string[],label:string)=>void;
  onOpenBuilder?:(championIds:string[])=>void;
};

type PoolLine={
  id:string;
  games:TftMatch[];
  average:number;
  top4Rate:number;
  winRate:number;
  usage:number;
  confidence:"alta"|"média"|"inicial";
  core:string[];
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

function championName(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.name||clean(id);
}

function primaryTrait(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)[0]?.name||"";
}

function buildPool(matches:TftMatch[]):PoolLine[]{
  const valid=matches.filter(match=>match.placement>=1&&match.placement<=8);
  const grouped=new Map<string,TftMatch[]>();

  for(const match of valid){
    const id=primaryTrait(match);
    if(!id)continue;
    const rows=grouped.get(id)||[];
    rows.push(match);
    grouped.set(id,rows);
  }

  return [...grouped.entries()].map(([id,games])=>{
    const unitCounts=new Map<string,number>();
    for(const game of games){
      for(const unitId of new Set(game.units.map(unit=>unit.characterId).filter(Boolean))){
        unitCounts.set(unitId,(unitCounts.get(unitId)||0)+1);
      }
    }

    const core=[...unitCounts.entries()]
      .sort((a,b)=>b[1]-a[1])
      .filter(([,count])=>count/games.length>=.45)
      .slice(0,4)
      .map(([unitId])=>unitId);

    const average=games.reduce((sum,game)=>sum+game.placement,0)/games.length;
    const top4=games.filter(game=>game.placement<=4).length;
    const wins=games.filter(game=>game.placement===1).length;
    const confidence:"alta"|"média"|"inicial"=
      games.length>=6?"alta":games.length>=3?"média":"inicial";

    return {
      id,
      games,
      average:+average.toFixed(2),
      top4Rate:Math.round(top4/games.length*100),
      winRate:Math.round(wins/games.length*100),
      usage:Math.round(games.length/Math.max(1,valid.length)*100),
      confidence,
      core,
    };
  })
    .sort((a,b)=>b.games.length-a.games.length||a.average-b.average)
    .slice(0,5);
}

function Champion({id,staticData}:{id:string;staticData:TftStaticData|null}){
  const entry=staticEntry(staticData?.champions,id);
  const image=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
  const name=championName(id,staticData);

  return <span className="pool-champion" title={name}>
    <span>{name.slice(0,2)}</span>
    {image&&<img src={image} alt={name} onError={event=>{event.currentTarget.style.display="none";}}/>}
  </span>;
}

export default function ChibiPool({matches,staticData,onEvidence,onOpenBuilder}:Props){
  const pool=useMemo(()=>buildPool(matches),[matches]);
  const recurring=pool.filter(line=>line.games.length>=2);
  const main=pool[0]||null;
  const concentration=main?.usage||0;

  const health=matches.length<6
    ? {label:"Em formação",tone:"initial",body:"Carregue mais partidas para separar preferência real de coincidência."}
    : concentration>=55
      ? {label:"Concentrado",tone:"warning",body:"Uma linha ocupa mais da metade da amostra. Isso pode ser conforto ou pouca adaptação."}
      : recurring.length>=3
        ? {label:"Diverso",tone:"good",body:"Seu histórico mostra várias linhas recorrentes em vez de uma única identidade dominante."}
        : {label:"Em expansão",tone:"neutral",body:"Já existe uma linha principal, mas o segundo caminho ainda tem pouca recorrência."};

  if(!pool.length)return null;

  return <section className="panel chibi-pool">
    <div className="pool-head">
      <div>
        <span>MEU POOL</span>
        <h2>As linhas que você realmente joga</h2>
        <p>Frequência e resultado do seu histórico — separado de tier list global.</p>
      </div>
      <div className={"pool-health "+health.tone}>
        <small>SAÚDE DO POOL</small>
        <strong>{health.label}</strong>
        <span>{recurring.length} linha{recurring.length===1?"":"s"} recorrente{recurring.length===1?"":"s"}</span>
      </div>
    </div>

    <div className="pool-summary">
      <strong>{main?traitName(main.id,staticData):"—"}</strong>
      <span>{main?main.usage:0}% da amostra na linha mais usada</span>
      <p>{health.body}</p>
    </div>

    <div className="pool-lines">
      {pool.slice(0,4).map((line,index)=>(
        <article key={line.id}>
          <div className="pool-line-rank">{String(index+1).padStart(2,"0")}</div>
          <div className="pool-line-main">
            <div className="pool-line-title">
              <div>
                <span>{index===0?"MAIS JOGADA":"LINHA DO POOL"}</span>
                <strong>{traitName(line.id,staticData)}</strong>
              </div>
              <b className={"pool-confidence "+line.confidence}>{line.confidence}</b>
            </div>

            <div className="pool-line-core">
              {line.core.length
                ? line.core.map(id=><Champion id={id} staticData={staticData} key={id}/>)
                : <small>Core ainda sem recorrência suficiente</small>}
            </div>
          </div>

          <div className="pool-line-stats">
            <span><small>Jogos</small><b>{line.games.length}</b></span>
            <span><small>Uso</small><b>{line.usage}%</b></span>
            <span><small>Média</small><b>{line.average}</b></span>
            <span><small>Top 4</small><b>{line.top4Rate}%</b></span>
          </div>

          <div className="pool-line-actions">
            <button onClick={()=>onEvidence(line.games.map(game=>game.id),"Meu Pool · "+traitName(line.id,staticData))}>Evidências</button>
            {onOpenBuilder&&line.core.length>0&&<button className="primary" onClick={()=>onOpenBuilder(line.core)}>Builder</button>}
          </div>
        </article>
      ))}
    </div>

    <p className="pool-note">“Mais jogada” descreve frequência pessoal. Uma linha com poucos jogos ou confiança inicial não deve ser tratada como sua melhor composição.</p>
  </section>;
}
