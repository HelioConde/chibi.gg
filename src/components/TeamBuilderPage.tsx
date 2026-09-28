import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import {
  staticEntry,
  tftAssetUrl,
  TftStaticData,
} from "../tftStatic";
import HexBoard, { HexBoardUnit } from "./HexBoard";
import DDragonArt from "./DDragonArt";

type Props={
  staticData:TftStaticData|null;
  matches:TftMatch[];
  hasProfile:boolean;
  onBack:()=>void;
  onEvidence:(ids:string[],label:string)=>void;
  initialChampionIds?:string[];
};

function clean(value:string){
  return String(value||"")
    .replace(/^TFT\d+_/i,"")
    .replace(/^Set\d+_/i,"")
    .replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2");
}

function costFor(id:string,staticData:TftStaticData|null){
  const entry=staticEntry(staticData?.champions,id);
  return Math.max(1,Math.min(5,Number(entry?.tier||1)));
}

function similarity(boardIds:Set<string>,match:TftMatch){
  const matchIds=new Set(match.units.map(unit=>unit.characterId));
  const intersection=[...boardIds].filter(id=>matchIds.has(id)).length;
  const union=new Set([...boardIds,...matchIds]).size;
  return union?intersection/union:0;
}

export default function TeamBuilderPage({
  staticData,
  matches,
  hasProfile,
  onBack,
  onEvidence,
  initialChampionIds=[],
}:Props){
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [units,setUnits]=useState<HexBoardUnit[]>([]);

  useEffect(()=>{
    if(!initialChampionIds.length)return;
    const preferredHexes=[21,22,23,24,15,16,17,18,25,26];
    setUnits(
      initialChampionIds.slice(0,10).map((id,index)=>({
        id,
        hex:preferredHexes[index]??index,
        tier:2,
      }))
    );
    setSelectedId(null);
  },[initialChampionIds]);

  const champions=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return Object.entries(staticData?.champions||{})
      .map(([id,entry])=>({
        id,
        name:String(entry.name||clean(id)),
        cost:Math.max(1,Math.min(5,Number(entry.tier||1))),
      }))
      .filter(row=>!normalized||row.name.toLowerCase().includes(normalized)||row.id.toLowerCase().includes(normalized))
      .sort((a,b)=>a.cost-b.cost||a.name.localeCompare(b.name))
      .slice(0,120);
  },[staticData,query]);

  const boardIds=useMemo(()=>new Set(units.map(unit=>unit.id)),[units]);

  const similar=useMemo(()=>{
    if(boardIds.size<3)return [];
    return matches
      .map(match=>({match,score:similarity(boardIds,match)}))
      .filter(row=>row.score>=.25)
      .sort((a,b)=>b.score-a.score||a.match.placement-b.match.placement)
      .slice(0,5);
  },[boardIds,matches]);

  const average=similar.length
    ? similar.reduce((sum,row)=>sum+row.match.placement,0)/similar.length
    : null;

  const boardValue=units.reduce((sum,unit)=>sum+costFor(unit.id,staticData)*(unit.tier===3?9:unit.tier===2?3:1),0);

  const traitCounts=useMemo(()=>{
    const map=new Map<string,number>();
    for(const unit of units){
      const entry=staticEntry(staticData?.champions,unit.id);
      for(const trait of entry?.traits||[]){
        map.set(trait,(map.get(trait)||0)+1);
      }
    }
    return [...map.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,8);
  },[units,staticData]);

  function addToHex(hex:number){
    if(!selectedId)return;
    setUnits(current=>{
      const withoutSame=current.filter(unit=>unit.id!==selectedId&&unit.hex!==hex);
      return [...withoutSame,{id:selectedId,hex,tier:2}];
    });
    setSelectedId(null);
  }

  function removeUnit(unit:HexBoardUnit){
    setUnits(current=>current.filter(row=>row.hex!==unit.hex));
  }

  return <main className="builder-page">
    <section className="builder-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">CHIBI LAB · TEAM BUILDER</span>
        <h1>Monte o board.<br/><em>Compare com o seu histórico.</em></h1>
        <p>{initialChampionIds.length
          ?"Comp carregada. Agora mova peças, remova unidades e compare variantes com o seu histórico."
          :"Um Team Builder pensado para experimentar rotas e depois perguntar ao Chibi se você já jogou algo parecido."}</p>
        <DDragonArt
          staticData={staticData}
          championIds={units.map(unit=>unit.id)}
          variant="ribbon"
          label="Board visual · Data Dragon"
        />
      </div>

      <div className="builder-summary">
        <div><span>UNIDADES</span><strong>{units.length}/10</strong></div>
        <div><span>BOARD VALUE</span><strong>{boardValue}G</strong></div>
        <button onClick={()=>{setUnits([]);setSelectedId(null);}}>Limpar board</button>
      </div>
    </section>

    <section className="builder-workspace">
      <div className="panel builder-board-panel">
        <div className="builder-panel-head">
          <div>
            <span>BOARD</span>
            <h2>{selectedId?"Escolha um hex":"Seu tabuleiro"}</h2>
          </div>
          {selectedId&&<button onClick={()=>setSelectedId(null)}>Cancelar seleção</button>}
        </div>

        <HexBoard
          units={units}
          staticData={staticData}
          onHexClick={addToHex}
          onUnitClick={removeUnit}
          interactive
          emptyLabel="Selecione um champion na biblioteca e clique no hex desejado."
        />

        <div className="builder-traits">
          <span>TRAITS</span>
          <div>
            {traitCounts.length?traitCounts.map(([trait,count])=><b key={trait}>{clean(trait)} {count}</b>):<small>Adicione unidades para ver as synergies disponíveis.</small>}
          </div>
        </div>
      </div>

      <aside className="panel builder-library">
        <div className="builder-panel-head">
          <div>
            <span>CHAMPIONS</span>
            <h2>Biblioteca</h2>
          </div>
        </div>

        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Pesquisar champion..."/>

        <div className="builder-champion-grid">
          {champions.map(row=>{
            const entry=staticEntry(staticData?.champions,row.id);
            const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
            return <button
              className={selectedId===row.id?"selected":""}
              onClick={()=>setSelectedId(row.id)}
              title={"Adicionar "+row.name}
              key={row.id}
            >
              <span className={"cost-"+row.cost}>{src&&<img src={src} alt=""/>}</span>
              <strong>{row.name}</strong>
              <small>{row.cost}g</small>
            </button>;
          })}
        </div>
      </aside>

      <aside className="panel builder-chibi">
        <div className="builder-panel-head">
          <div>
            <span>CHIBI CHECK</span>
            <h2>Esse board combina com você?</h2>
          </div>
        </div>

        {!hasProfile&&<div className="builder-empty-check">
          Abra um perfil primeiro para comparar este board com o histórico do jogador.
        </div>}

        {hasProfile&&units.length<3&&<div className="builder-empty-check">
          Monte pelo menos 3 unidades para liberar a comparação pessoal.
        </div>}

        {hasProfile&&units.length>=3&&<>
          <div className="builder-fit-main">
            <span>BOARDS PARECIDOS</span>
            <strong>{similar.length}</strong>
            <small>{average!=null?"média "+average.toFixed(2):"nenhum comparável forte ainda"}</small>
          </div>

          {similar.length>0?<div className="builder-similar-list">
            {similar.map(({match,score})=><article key={match.id}>
              <b>{match.placement}º</b>
              <span><strong>{Math.round(score*100)}% semelhante</strong><small>nível {match.level} · {match.goldLeft}g final</small></span>
            </article>)}
          </div>:<p className="builder-empty-check">Seu histórico carregado ainda não tem boards suficientemente parecidos.</p>}

          {similar.length>0&&<button className="builder-evidence-button" onClick={()=>onEvidence(similar.map(row=>row.match.id),"Team Builder · boards parecidos")}>
            Ver partidas parecidas
          </button>}
        </>}
      </aside>
    </section>

    <p className="builder-disclaimer">O Builder é uma ferramenta de experimentação. Similaridade com histórico não prova que o board seja correto para uma partida específica.</p>
  </main>;
}
