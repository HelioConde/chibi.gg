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
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\bUnique Trait\b/gi,"")
    .replace(/\bTrait\b$/i,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

function costFor(id:string,staticData:TftStaticData|null){
  const entry=staticEntry(staticData?.champions,id);
  return Math.max(1,Math.min(5,Number(entry?.tier||1)));
}

function copiesFor(tier=1){
  return tier>=3?9:tier===2?3:1;
}

function unitTraitIds(id:string,staticData:TftStaticData|null){
  return staticEntry(staticData?.champions,id)?.traits||[];
}

function jaccard(a:Set<string>,b:Set<string>){
  const union=new Set([...a,...b]).size;
  if(!union)return 0;
  let intersection=0;
  for(const value of a)if(b.has(value))intersection++;
  return intersection/union;
}

function similarity(
  boardIds:Set<string>,
  boardTraits:Set<string>,
  match:TftMatch,
){
  const matchIds=new Set(match.units.map(unit=>unit.characterId));
  const matchTraits=new Set(
    match.traits
      .filter(trait=>trait.numUnits>0)
      .map(trait=>trait.name)
  );

  const unitScore=jaccard(boardIds,matchIds);
  const traitScore=jaccard(boardTraits,matchTraits);
  return unitScore*.68+traitScore*.32;
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
  const [targetLevel,setTargetLevel]=useState(8);

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
    setTargetLevel(Math.max(6,Math.min(10,initialChampionIds.length||8)));
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
      .slice(0,140);
  },[staticData,query]);

  const boardIds=useMemo(()=>new Set(units.map(unit=>unit.id)),[units]);

  const traitCounts=useMemo(()=>{
    const map=new Map<string,number>();
    for(const unit of units){
      for(const trait of unitTraitIds(unit.id,staticData)){
        map.set(trait,(map.get(trait)||0)+1);
      }
    }
    return [...map.entries()]
      .sort((a,b)=>b[1]-a[1]||clean(a[0]).localeCompare(clean(b[0])))
      .slice(0,12);
  },[units,staticData]);

  const boardTraits=useMemo(
    ()=>new Set(traitCounts.map(([trait])=>trait)),
    [traitCounts]
  );

  const candidateUnits=useMemo(()=>{
    if(!staticData||!units.length)return [];
    const traitWeight=new Map(traitCounts.map(([trait,count])=>[trait,Math.max(1,count)]));

    return Object.entries(staticData.champions)
      .filter(([id])=>!boardIds.has(id))
      .map(([id,entry])=>{
        const traits=entry.traits||[];
        const shared=traits.filter(trait=>traitWeight.has(trait));
        const sharedScore=shared.reduce((sum,trait)=>sum+(traitWeight.get(trait)||1),0);
        return {
          id,
          name:String(entry.name||clean(id)),
          cost:Math.max(1,Math.min(5,Number(entry.tier||1))),
          shared,
          sharedScore,
        };
      })
      .filter(row=>row.shared.length>0)
      .sort((a,b)=>b.sharedScore-a.sharedScore||b.shared.length-a.shared.length||a.cost-b.cost)
      .slice(0,8);
  },[staticData,units.length,boardIds,traitCounts]);

  const similar=useMemo(()=>{
    if(boardIds.size<3)return [];
    return matches
      .map(match=>({match,score:similarity(boardIds,boardTraits,match)}))
      .filter(row=>row.score>=.22)
      .sort((a,b)=>b.score-a.score||a.match.placement-b.match.placement)
      .slice(0,6);
  },[boardIds,boardTraits,matches]);

  const average=similar.length
    ? similar.reduce((sum,row)=>sum+row.match.placement,0)/similar.length
    : null;

  const top4Rate=similar.length
    ? Math.round(similar.filter(row=>row.match.placement<=4).length/similar.length*100)
    : null;

  const boardValue=units.reduce(
    (sum,unit)=>sum+costFor(unit.id,staticData)*copiesFor(unit.tier||1),
    0
  );

  const averageUnitCost=units.length
    ? units.reduce((sum,unit)=>sum+costFor(unit.id,staticData),0)/units.length
    : 0;

  const twoStars=units.filter(unit=>(unit.tier||1)>=2).length;
  const threeStars=units.filter(unit=>(unit.tier||1)>=3).length;
  const openSlots=Math.max(0,targetLevel-units.length);
  const overSlots=Math.max(0,units.length-targetLevel);

  const decision=useMemo(()=>{
    if(!units.length){
      return {
        tone:"neutral",
        title:"Comece pelo core que você quer testar",
        body:"Adicione 3 ou mais unidades. O Chibi cruza champions, traits e seu histórico somente depois que há estrutura suficiente.",
      };
    }

    if(overSlots>0){
      return {
        tone:"warning",
        title:"O board excede o nível-alvo",
        body:"Você montou "+units.length+" unidades para um alvo de nível "+targetLevel+". Remova "+overSlots+" peça"+(overSlots===1?"":"s")+" ou aumente o nível-alvo antes de comparar.",
      };
    }

    if(openSlots>0&&candidateUnits[0]){
      return {
        tone:"neutral",
        title:"Você ainda tem "+openSlots+" vaga"+(openSlots===1?"":"s")+" no nível "+targetLevel,
        body:"Para o próximo teste, "+candidateUnits[0].name+" compartilha "+candidateUnits[0].shared.length+" trait"+(candidateUnits[0].shared.length===1?"":"s")+" com a estrutura atual. Isso é compatibilidade estrutural, não recomendação de meta.",
      };
    }

    if(similar.length>=3&&average!=null&&average<=4.25){
      return {
        tone:"good",
        title:"Seu histórico já mostrou bons resultados parecidos",
        body:"Há "+similar.length+" boards comparáveis com média "+average.toFixed(2)+" e Top 4 de "+top4Rate+"%. Use isso como evidência pessoal, não como garantia de resultado.",
      };
    }

    if(similar.length>=3&&average!=null&&average>=5){
      return {
        tone:"warning",
        title:"Seu histórico pede cautela com esta estrutura",
        body:"Os "+similar.length+" boards mais próximos ficaram em média "+average.toFixed(2)+". Vale testar uma troca antes de tratar esta versão como sua rota padrão.",
      };
    }

    return {
      tone:"neutral",
      title:"Board fechado; agora compare variantes",
      body:"O histórico ainda não é forte o suficiente para concluir. Troque uma peça por vez e observe como champions e traits mudam antes de salvar uma direção.",
    };
  },[
    units.length,
    overSlots,
    openSlots,
    targetLevel,
    candidateUnits,
    similar.length,
    average,
    top4Rate,
  ]);

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

  function setUnitTier(hex:number,tier:number){
    setUnits(current=>current.map(unit=>unit.hex===hex?{...unit,tier}:unit));
  }

  return <main className="builder-page builder-v2">
    <section className="builder-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">CHIBI LAB · TEAM BUILDER V2</span>
        <h1>Monte o board.<br/><em>Teste uma decisão por vez.</em></h1>
        <p>{initialChampionIds.length
          ?"Comp carregada. Mova, remova ou substitua peças e compare variantes com o seu histórico."
          :"Monte uma estrutura, veja traits e custos em tempo real e compare com partidas que você realmente jogou."}</p>
        <DDragonArt
          staticData={staticData}
          championIds={units.map(unit=>unit.id)}
          variant="ribbon"
          label="Board visual · Data Dragon"
        />
      </div>

      <div className="builder-summary builder-summary-v2">
        <div><span>NÍVEL-ALVO</span><strong>{targetLevel}</strong></div>
        <div><span>UNIDADES</span><strong className={overSlots>0?"warning":""}>{units.length}/{targetLevel}</strong></div>
        <div><span>BOARD VALUE</span><strong>{boardValue}G</strong></div>
        <div><span>CUSTO MÉDIO</span><strong>{averageUnitCost.toFixed(1)}G</strong></div>
        <div className="builder-level-control">
          <span>PLANEJAR NÍVEL</span>
          <div>
            {[6,7,8,9,10].map(level=>(
              <button
                className={targetLevel===level?"active":""}
                onClick={()=>setTargetLevel(level)}
                key={level}
              >{level}</button>
            ))}
          </div>
        </div>
        <button onClick={()=>{setUnits([]);setSelectedId(null);}}>Limpar board</button>
      </div>
    </section>

    <section className="builder-decision-strip">
      <div className={"builder-decision-card "+decision.tone}>
        <span>LEITURA DO BOARD</span>
        <h2>{decision.title}</h2>
        <p>{decision.body}</p>
      </div>

      <div className="builder-board-facts">
        <article><span>2★ OU MAIS</span><strong>{twoStars}/{units.length||0}</strong></article>
        <article><span>3★</span><strong>{threeStars}</strong></article>
        <article><span>TRAITS VISÍVEIS</span><strong>{traitCounts.length}</strong></article>
        <article><span>COMPARÁVEIS</span><strong>{similar.length}</strong></article>
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

        <div className="builder-roster">
          <div className="builder-subhead">
            <span>SEU BOARD</span>
            <small>Clique nas estrelas para testar valor do board; remover aqui não depende do hex.</small>
          </div>
          {units.length?<div className="builder-roster-grid">
            {units.slice().sort((a,b)=>a.hex-b.hex).map(unit=>{
              const entry=staticEntry(staticData?.champions,unit.id);
              const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
              const name=String(entry?.name||clean(unit.id));
              return <article key={unit.hex}>
                <span className="builder-roster-image">{src&&<img src={src} alt=""/>}</span>
                <div>
                  <strong>{name}</strong>
                  <small>{costFor(unit.id,staticData)}g · hex {unit.hex+1}</small>
                  <div className="builder-star-control">
                    {[1,2,3].map(tier=>(
                      <button
                        className={(unit.tier||1)===tier?"active":""}
                        onClick={()=>setUnitTier(unit.hex,tier)}
                        key={tier}
                      >{"★".repeat(tier)}</button>
                    ))}
                  </div>
                </div>
                <button className="builder-remove-unit" onClick={()=>removeUnit(unit)}>×</button>
              </article>;
            })}
          </div>:<p className="builder-empty-check">O roster aparece aqui conforme você adiciona unidades ao tabuleiro.</p>}
        </div>

        <div className="builder-traits builder-traits-v2">
          <div className="builder-subhead">
            <span>TRAITS EM TEMPO REAL</span>
            <small>Contagem estrutural das unidades escolhidas. O Chibi não inventa breakpoint que o Data Dragon não expôs.</small>
          </div>
          <div>
            {traitCounts.length?traitCounts.map(([trait,count])=>{
              const entry=staticEntry(staticData?.traits,trait);
              const src=staticData?tftAssetUrl(staticData.version,"trait",entry):"";
              return <b key={trait}>
                {src&&<img src={src} alt=""/>}
                <span>{entry?.name||clean(trait)}</span>
                <em>{count}</em>
              </b>;
            }):<small>Adicione unidades para ver as synergies disponíveis.</small>}
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

        {units.length>0&&<section className="builder-candidates">
          <div className="builder-subhead">
            <span>PEÇAS QUE CONVERSAM COM O BOARD</span>
            <small>Ordenadas apenas por traits compartilhadas.</small>
          </div>
          <div>
            {candidateUnits.slice(0,6).map(candidate=>{
              const entry=staticEntry(staticData?.champions,candidate.id);
              const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
              return <button onClick={()=>setSelectedId(candidate.id)} key={candidate.id}>
                <span>{src&&<img src={src} alt=""/>}</span>
                <div>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.shared.slice(0,2).map(clean).join(" · ")}</small>
                </div>
                <b>{candidate.shared.length}</b>
              </button>;
            })}
          </div>
          {!candidateUnits.length&&<p className="builder-empty-check">Nenhuma continuação estrutural encontrada no catálogo atual.</p>}
        </section>}
      </aside>

      <aside className="panel builder-chibi builder-check-v2">
        <div className="builder-panel-head">
          <div>
            <span>CHIBI CHECK</span>
            <h2>O que seu histórico diz?</h2>
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
            <small>{average!=null
              ?"média "+average.toFixed(2)+(top4Rate!=null?" · Top 4 "+top4Rate+"%":"")
              :"nenhum comparável forte ainda"}</small>
          </div>

          {similar.length>0?<div className="builder-similar-list builder-similar-list-v2">
            {similar.map(({match,score})=><article key={match.id}>
              <b>{match.placement}º</b>
              <span>
                <strong>{Math.round(score*100)}% semelhante</strong>
                <small>nível {match.level} · {match.goldLeft}g final · {match.units.filter(unit=>unit.tier>=3).length} 3★</small>
              </span>
            </article>)}
          </div>:<p className="builder-empty-check">Seu histórico carregado ainda não tem boards suficientemente parecidos.</p>}

          {similar.length>0&&<button className="builder-evidence-button" onClick={()=>onEvidence(similar.map(row=>row.match.id),"Team Builder · boards parecidos")}>
            Ver evidências no histórico
          </button>}
        </>}
      </aside>
    </section>

    <p className="builder-disclaimer">O Builder compara estrutura final, traits e boards do histórico. Ele não conhece sua loja, ouro por rodada, scouting completo ou posição futura e não trata similaridade como causalidade.</p>
  </main>;
}
