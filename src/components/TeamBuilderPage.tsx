import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import {
  staticEntry,
  tftAssetUrl,
  TftStaticData,
} from "../tftStatic";
import HexBoard, { HexBoardUnit } from "./HexBoard";
import DDragonArt from "./DDragonArt";
import {
  BuilderPreset,
  deleteBuilderPreset,
  getBuilderPresets,
  saveBuilderPreset,
} from "../builderPresets";

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

function itemSimilarity(boardUnits:HexBoardUnit[],match:TftMatch){
  let total=0;
  let matched=0;

  for(const boardUnit of boardUnits){
    const configured=boardUnit.items||[];
    if(!configured.length)continue;

    const matchUnit=match.units.find(unit=>unit.characterId===boardUnit.id);
    const available=new Map<string,number>();
    for(const itemId of matchUnit?.itemNames||[]){
      available.set(itemId,(available.get(itemId)||0)+1);
    }

    for(const itemId of configured){
      total++;
      const count=available.get(itemId)||0;
      if(count>0){
        matched++;
        available.set(itemId,count-1);
      }
    }
  }

  return total?matched/total:null;
}

function augmentSimilarity(configured:string[],match:TftMatch){
  if(!configured.length)return null;
  const matchAugments=new Set(match.augments||[]);
  const matched=configured.filter(id=>matchAugments.has(id)).length;
  return matched/configured.length;
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
  const [variantA,setVariantA]=useState<HexBoardUnit[]|null>(null);
  const [savedPresets,setSavedPresets]=useState<BuilderPreset[]>(()=>getBuilderPresets());
  const [copied,setCopied]=useState(false);
  const [costFilter,setCostFilter]=useState<number>(0);
  const [selectedItemHex,setSelectedItemHex]=useState<number|null>(null);
  const [itemQuery,setItemQuery]=useState("");
  const [selectedAugments,setSelectedAugments]=useState<string[]>([]);
  const [augmentQuery,setAugmentQuery]=useState("");
  const [variantAAugments,setVariantAAugments]=useState<string[]>([]);

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
    setSelectedItemHex(null);
    setSelectedAugments([]);
    setAugmentQuery("");
  },[initialChampionIds]);

  const champions=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return Object.entries(staticData?.champions||{})
      .map(([id,entry])=>({
        id,
        name:String(entry.name||clean(id)),
        cost:Math.max(1,Math.min(5,Number(entry.tier||1))),
      }))
      .filter(row=>
        (!normalized||row.name.toLowerCase().includes(normalized)||row.id.toLowerCase().includes(normalized))
        && (!costFilter||row.cost===costFilter)
      )
      .sort((a,b)=>a.cost-b.cost||a.name.localeCompare(b.name))
      .slice(0,140);
  },[staticData,query,costFilter]);

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

  const costCurve=useMemo(()=>{
    const counts=[0,0,0,0,0];
    for(const unit of units){
      const cost=costFor(unit.id,staticData);
      counts[Math.max(1,Math.min(5,cost))-1]++;
    }
    return counts;
  },[units,staticData]);

  const selectedChampion=useMemo(()=>{
    if(!selectedId)return null;
    const entry=staticEntry(staticData?.champions,selectedId);
    if(!entry)return null;
    return {
      id:selectedId,
      name:String(entry.name||clean(selectedId)),
      cost:Math.max(1,Math.min(5,Number(entry.tier||1))),
      traits:entry.traits||[],
      image:staticData?tftAssetUrl(staticData.version,"champion",entry):"",
    };
  },[selectedId,staticData]);

  const items=useMemo(()=>{
    const normalized=itemQuery.trim().toLowerCase();
    return Object.entries(staticData?.items||{})
      .map(([id,entry])=>({
        id,
        name:String(entry.name||clean(id)),
        image:staticData?tftAssetUrl(staticData.version,"item",entry):"",
      }))
      .filter(row=>
        Boolean(row.name&&row.image)
        && (!normalized||row.name.toLowerCase().includes(normalized)||row.id.toLowerCase().includes(normalized))
      )
      .sort((a,b)=>a.name.localeCompare(b.name))
      .slice(0,180);
  },[staticData,itemQuery]);

  const selectedItemUnit=useMemo(
    ()=>selectedItemHex==null?null:units.find(unit=>unit.hex===selectedItemHex)||null,
    [units,selectedItemHex]
  );

  const selectedItemChampion=useMemo(()=>{
    if(!selectedItemUnit)return null;
    const entry=staticEntry(staticData?.champions,selectedItemUnit.id);
    return {
      name:String(entry?.name||clean(selectedItemUnit.id)),
      image:staticData?tftAssetUrl(staticData.version,"champion",entry):"",
    };
  },[selectedItemUnit,staticData]);

  const selectedUnitItemHistory=useMemo(()=>{
    if(!selectedItemUnit)return {games:0,items:[] as Array<{id:string;games:number;avgPlacement:number}>};
    const itemStats=new Map<string,{games:number;placement:number}>();
    let games=0;

    for(const match of matches){
      const unit=match.units.find(row=>row.characterId===selectedItemUnit.id);
      if(!unit)continue;
      games++;
      for(const itemId of unit.itemNames||[]){
        const current=itemStats.get(itemId)||{games:0,placement:0};
        current.games++;
        current.placement+=match.placement;
        itemStats.set(itemId,current);
      }
    }

    return {
      games,
      items:[...itemStats.entries()]
        .map(([id,value])=>({
          id,
          games:value.games,
          avgPlacement:value.games?value.placement/value.games:0,
        }))
        .sort((a,b)=>b.games-a.games||a.avgPlacement-b.avgPlacement)
        .slice(0,8),
    };
  },[selectedItemUnit,matches]);

  const itemAssignments=useMemo(
    ()=>units.reduce((sum,unit)=>sum+(unit.items?.length||0),0),
    [units]
  );

  const augments=useMemo(()=>{
    const normalized=augmentQuery.trim().toLowerCase();
    return Object.entries(staticData?.augments||{})
      .map(([id,entry])=>({
        id,
        name:String(entry.name||clean(id)),
        image:staticData?tftAssetUrl(staticData.version,"augment",entry):"",
      }))
      .filter(row=>
        Boolean(row.name&&row.image)
        && (!normalized||row.name.toLowerCase().includes(normalized)||row.id.toLowerCase().includes(normalized))
      )
      .sort((a,b)=>a.name.localeCompare(b.name))
      .slice(0,180);
  },[staticData,augmentQuery]);

  const augmentHistory=useMemo(()=>{
    const stats=new Map<string,{games:number;placement:number}>();
    for(const match of matches){
      for(const augmentId of match.augments||[]){
        const current=stats.get(augmentId)||{games:0,placement:0};
        current.games++;
        current.placement+=match.placement;
        stats.set(augmentId,current);
      }
    }

    return [...stats.entries()]
      .map(([id,value])=>({
        id,
        games:value.games,
        avgPlacement:value.games?value.placement/value.games:0,
      }))
      .sort((a,b)=>b.games-a.games||a.avgPlacement-b.avgPlacement)
      .slice(0,10);
  },[matches]);

  const bridgeCandidate=useMemo(
    ()=>candidateUnits.slice().sort((a,b)=>a.cost-b.cost||b.sharedScore-a.sharedScore)[0]||null,
    [candidateUnits]
  );

  const capCandidate=useMemo(
    ()=>candidateUnits
      .filter(candidate=>candidate.cost>=4)
      .slice()
      .sort((a,b)=>b.sharedScore-a.sharedScore||b.cost-a.cost)[0]||null,
    [candidateUnits]
  );

  const primaryTrait=traitCounts[0]||null;

  const variantAEvaluation=useMemo(()=>{
    if(!variantA)return null;

    const ids=new Set(variantA.map(unit=>unit.id));
    const traitMap=new Map<string,number>();
    for(const unit of variantA){
      for(const trait of unitTraitIds(unit.id,staticData)){
        traitMap.set(trait,(traitMap.get(trait)||0)+1);
      }
    }
    const traits=new Set(traitMap.keys());
    const comparable=ids.size<3
      ?[]
      :matches
        .map(match=>({match,score:similarity(ids,traits,match)}))
        .filter(row=>row.score>=.22)
        .sort((a,b)=>b.score-a.score||a.match.placement-b.match.placement)
        .slice(0,6);

    const average=comparable.length
      ?comparable.reduce((sum,row)=>sum+row.match.placement,0)/comparable.length
      :null;
    const top4Rate=comparable.length
      ?Math.round(comparable.filter(row=>row.match.placement<=4).length/comparable.length*100)
      :null;
    const value=variantA.reduce(
      (sum,unit)=>sum+costFor(unit.id,staticData)*copiesFor(unit.tier||1),
      0
    );

    return {
      ids,
      traitMap,
      comparable,
      average,
      top4Rate,
      value,
    };
  },[variantA,matches,staticData]);

  const variantDiff=useMemo(()=>{
    if(!variantA||!variantAEvaluation)return null;

    const currentIds=new Set(units.map(unit=>unit.id));
    const added=[...currentIds].filter(id=>!variantAEvaluation.ids.has(id));
    const removed=[...variantAEvaluation.ids].filter(id=>!currentIds.has(id));

    const currentTraits=new Map(traitCounts);
    const allTraits=new Set([
      ...variantAEvaluation.traitMap.keys(),
      ...currentTraits.keys(),
    ]);

    const changedTraits=[...allTraits]
      .map(id=>({
        id,
        before:variantAEvaluation.traitMap.get(id)||0,
        after:currentTraits.get(id)||0,
      }))
      .filter(row=>row.before!==row.after)
      .sort((a,b)=>Math.abs(b.after-b.before)-Math.abs(a.after-a.before))
      .slice(0,6);

    const beforeById=new Map(variantA.map(unit=>[unit.id,(unit.items||[]).slice().sort().join("|")]));
    const afterById=new Map(units.map(unit=>[unit.id,(unit.items||[]).slice().sort().join("|")]));
    const itemChanges=[...new Set([...beforeById.keys(),...afterById.keys()])]
      .filter(id=>(beforeById.get(id)||"")!==(afterById.get(id)||""))
      .slice(0,6);

    const augmentChanges={
      before:variantAAugments.filter(id=>!selectedAugments.includes(id)),
      after:selectedAugments.filter(id=>!variantAAugments.includes(id)),
    };

    return {added,removed,changedTraits,itemChanges,augmentChanges};
  },[variantA,variantAEvaluation,units,traitCounts,variantAAugments,selectedAugments]);

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

  const contextOverlap=useMemo(()=>{
    if(!similar.length)return {item:null as number|null,augment:null as number|null,withAugment:0};
    const itemValues=similar
      .map(({match})=>itemSimilarity(units,match))
      .filter((value):value is number=>value!=null);
    const augmentValues=similar
      .map(({match})=>augmentSimilarity(selectedAugments,match))
      .filter((value):value is number=>value!=null);

    return {
      item:itemValues.length?itemValues.reduce((sum,value)=>sum+value,0)/itemValues.length:null,
      augment:augmentValues.length?augmentValues.reduce((sum,value)=>sum+value,0)/augmentValues.length:null,
      withAugment:augmentValues.filter(value=>value>0).length,
    };
  },[similar,units,selectedAugments]);

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
      return [...withoutSame,{id:selectedId,hex,tier:1}];
    });
    setSelectedId(null);
  }

  function removeUnit(unit:HexBoardUnit){
    setUnits(current=>current.filter(row=>row.hex!==unit.hex));
    if(selectedItemHex===unit.hex)setSelectedItemHex(null);
  }

  function setUnitTier(hex:number,tier:number){
    setUnits(current=>current.map(unit=>unit.hex===hex?{...unit,tier}:unit));
  }

  function openItemEditor(hex:number){
    setSelectedId(null);
    setSelectedItemHex(hex);
    setItemQuery("");
  }

  function addItem(itemId:string){
    if(selectedItemHex==null)return;
    setUnits(current=>current.map(unit=>{
      if(unit.hex!==selectedItemHex)return unit;
      const currentItems=unit.items||[];
      if(currentItems.length>=3)return unit;
      return {...unit,items:[...currentItems,itemId].slice(0,3)};
    }));
  }

  function removeItem(hex:number,index:number){
    setUnits(current=>current.map(unit=>{
      if(unit.hex!==hex)return unit;
      const next=[...(unit.items||[])];
      next.splice(index,1);
      return {...unit,items:next};
    }));
  }

  function clearUnitItems(hex:number){
    setUnits(current=>current.map(unit=>unit.hex===hex?{...unit,items:[]}:unit));
  }

  function addAugment(augmentId:string){
    setSelectedAugments(current=>{
      if(current.includes(augmentId)||current.length>=3)return current;
      return [...current,augmentId].slice(0,3);
    });
  }

  function removeAugment(index:number){
    setSelectedAugments(current=>{
      const next=[...current];
      next.splice(index,1);
      return next;
    });
  }

  function saveCurrentBoard(){
    if(!units.length)return;
    const topTraits=traitCounts
      .slice(0,2)
      .map(([trait])=>staticEntry(staticData?.traits,trait)?.name||clean(trait))
      .filter(Boolean);
    const name=topTraits.length
      ?topTraits.join(" · ")
      :"Board "+new Date().toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
    setSavedPresets(saveBuilderPreset({
      name,
      targetLevel,
      units,
      augments:selectedAugments,
    }));
  }

  function restorePreset(preset:BuilderPreset){
    setUnits(preset.units.map(unit=>({...unit,items:[...(unit.items||[])]})));
    setTargetLevel(preset.targetLevel);
    setSelectedAugments([...(preset.augments||[])].slice(0,3));
    setSelectedId(null);
    setSelectedItemHex(null);
  }

  async function copyBoardSummary(){
    const names=units
      .slice()
      .sort((a,b)=>a.hex-b.hex)
      .map(unit=>{
        const entry=staticEntry(staticData?.champions,unit.id);
        const unitName=(entry?.name||clean(unit.id))+" "+("★".repeat(Math.max(1,Math.min(3,unit.tier||1))));
        const itemNames=(unit.items||[])
          .map(itemId=>staticEntry(staticData?.items,itemId)?.name||clean(itemId))
          .filter(Boolean);
        return unitName+(itemNames.length?" ["+itemNames.join(" / ")+"]":"");
      });

    const traits=traitCounts
      .slice(0,6)
      .map(([trait,count])=>{
        const name=staticEntry(staticData?.traits,trait)?.name||clean(trait);
        return name+" "+count;
      });

    const summary=[
      "chibi.gg · Team Builder",
      "Nível "+targetLevel+" · "+units.length+" unidades · "+boardValue+"G",
      names.join(" · "),
      traits.length?"Traits: "+traits.join(" · "):"",
      selectedAugments.length
        ?"Augments: "+selectedAugments.map(id=>staticEntry(staticData?.augments,id)?.name||clean(id)).join(" · ")
        :"",
    ].filter(Boolean).join("\n");

    try{
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1600);
    }catch{
      setCopied(false);
    }
  }

  return <main className="builder-page builder-v2 builder-v3 builder-v4 builder-v5">
    <section className="builder-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>← Voltar ao perfil</button>}
        <span className="eyebrow">CHIBI LAB · TEAM BUILDER V5</span>
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
        <div className="builder-summary-actions">
          <button onClick={saveCurrentBoard} disabled={!units.length}>Salvar board</button>
          <button className="secondary" onClick={copyBoardSummary} disabled={!units.length}>
            {copied?"Resumo copiado ✓":"Copiar resumo"}
          </button>
          <button onClick={()=>{
            setVariantA(units.map(unit=>({...unit,items:[...(unit.items||[])]})));
            setVariantAAugments([...selectedAugments]);
          }} disabled={!units.length}>
            {variantA?"Atualizar versão A":"Salvar como versão A"}
          </button>
          {variantA&&<button className="secondary" onClick={()=>{
            setUnits(variantA.map(unit=>({...unit,items:[...(unit.items||[])]})));
            setSelectedAugments([...variantAAugments]);
            setSelectedId(null);
          }}>Restaurar A</button>}
          <button className="secondary" onClick={()=>{setUnits([]);setSelectedAugments([]);setSelectedId(null);setSelectedItemHex(null);}}>Limpar board</button>
        </div>
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
        <article><span>ITENS</span><strong>{itemAssignments}</strong></article>
        <article><span>AUGMENTS</span><strong>{selectedAugments.length}/3</strong></article>
        <article><span>TRAITS VISÍVEIS</span><strong>{traitCounts.length}</strong></article>
        <article><span>COMPARÁVEIS</span><strong>{similar.length}</strong></article>
      </div>
    </section>

    <section className="builder-planner-hud">
      <div className="builder-planner-head">
        <div>
          <span>PLANO DO BOARD</span>
          <h2>Qual é a próxima decisão?</h2>
          <p>O Chibi organiza o que já está visível no seu board. Compatibilidade estrutural não é tier list nem recomendação automática.</p>
        </div>
        <div className={"builder-slot-state "+(overSlots>0?"warning":openSlots===0?"good":"")}>
          <small>SLOTS</small>
          <strong>{units.length}/{targetLevel}</strong>
          <span>{overSlots>0?"excesso de "+overSlots:openSlots>0?openSlots+" vaga"+(openSlots===1?"":"s")+" aberta"+(openSlots===1?"":"s"):"board fechado"}</span>
        </div>
      </div>

      <div className="builder-planner-grid">
        <article className="builder-plan-card focus">
          <span>FOCO ATUAL</span>
          <strong>{primaryTrait
            ?(staticEntry(staticData?.traits,primaryTrait[0])?.name||clean(primaryTrait[0]))+" · "+primaryTrait[1]
            :"Sem estrutura definida"}</strong>
          <small>{primaryTrait
            ?"Trait mais presente entre as peças escolhidas."
            :"Adicione unidades para descobrir a estrutura dominante."}</small>
        </article>

        <article className="builder-plan-card">
          <span>PONTE BARATA</span>
          <strong>{bridgeCandidate?bridgeCandidate.name:"—"}</strong>
          <small>{bridgeCandidate
            ?bridgeCandidate.cost+"g · conecta "+bridgeCandidate.shared.slice(0,2).map(id=>staticEntry(staticData?.traits,id)?.name||clean(id)).join(" + ")
            :"Nenhuma peça de conexão visível."}</small>
          {bridgeCandidate&&<button onClick={()=>{setSelectedItemHex(null);setSelectedId(bridgeCandidate.id);}}>Selecionar</button>}
        </article>

        <article className="builder-plan-card">
          <span>PEÇA DE CAP</span>
          <strong>{capCandidate?capCandidate.name:"—"}</strong>
          <small>{capCandidate
            ?capCandidate.cost+"g · compartilha "+capCandidate.shared.length+" trait"+(capCandidate.shared.length===1?"":"s")
            :"Nenhuma peça 4g/5g conectada à estrutura atual."}</small>
          {capCandidate&&<button onClick={()=>{setSelectedItemHex(null);setSelectedId(capCandidate.id);}}>Selecionar</button>}
        </article>

        <article className="builder-plan-card curve">
          <span>CURVA DE CUSTO</span>
          <div className="builder-cost-curve">
            {costCurve.map((count,index)=><b className={"cost-"+(index+1)} key={index}>
              <em>{index+1}g</em>
              <strong>{count}</strong>
            </b>)}
          </div>
          <small>{units.length?averageUnitCost.toFixed(1)+"g de custo médio por unidade":"Board vazio"}</small>
        </article>
      </div>

      {selectedChampion&&<div className="builder-selection-guide">
        <span className={"builder-selection-image cost-"+selectedChampion.cost}>
          {selectedChampion.image&&<img src={selectedChampion.image} alt=""/>}
        </span>
        <div>
          <small>CHAMPION SELECIONADO</small>
          <strong>{selectedChampion.name} · {selectedChampion.cost}g</strong>
          <p>{selectedChampion.traits.slice(0,3).map(id=>staticEntry(staticData?.traits,id)?.name||clean(id)).join(" · ")||"Sem traits carregadas"}</p>
        </div>
        <b>Clique em um hex vazio para adicionar ou em uma unidade para substituir.</b>
        <button onClick={()=>setSelectedId(null)}>Cancelar</button>
      </div>}
    </section>

    <section className="builder-augment-lab">
      <div className="builder-augment-head">
        <div>
          <span>CONTEXTO DA PARTIDA</span>
          <h2>Augments</h2>
          <p>Monte até 3 Augments. O Chibi compara essa escolha com o seu histórico, mas mantém o board como eixo principal da análise.</p>
        </div>
        <div className="builder-context-overlap">
          <small>OVERLAP NAS PARTIDAS PARECIDAS</small>
          <strong>{selectedAugments.length&&contextOverlap.augment!=null?Math.round(contextOverlap.augment*100)+"%":"—"}</strong>
          <span>{selectedAugments.length
            ?contextOverlap.withAugment+"/"+similar.length+" partidas com ao menos 1 escolhido"
            :"escolha Augments para comparar"}</span>
        </div>
      </div>

      <div className="builder-augment-layout">
        <div className="builder-augment-selected">
          <div className="builder-subhead">
            <span>SEUS 3 SLOTS</span>
            <small>Clique em um Augment equipado para remover.</small>
          </div>
          <div className="builder-augment-slots">
            {[0,1,2].map(index=>{
              const augmentId=selectedAugments[index];
              const entry=staticEntry(staticData?.augments,augmentId);
              const src=augmentId&&staticData?tftAssetUrl(staticData.version,"augment",entry):"";
              const name=entry?.name||"Slot "+(index+1);
              return <button
                className={augmentId?"filled":"empty"}
                onClick={()=>augmentId&&removeAugment(index)}
                title={augmentId?"Remover "+name:"Escolha um Augment"}
                key={index}
              >
                <span>{src&&<img src={src} alt=""/>}</span>
                <div>
                  <small>AUGMENT {index+1}</small>
                  <strong>{name}</strong>
                </div>
              </button>;
            })}
          </div>

          <div className="builder-augment-history">
            <div className="builder-subhead">
              <span>MAIS PRESENTES NO SEU HISTÓRICO</span>
              <small>{matches.length} partidas carregadas</small>
            </div>
            {augmentHistory.length
              ?<div className="builder-history-augments">
                {augmentHistory.map(row=>{
                  const entry=staticEntry(staticData?.augments,row.id);
                  const src=staticData?tftAssetUrl(staticData.version,"augment",entry):"";
                  const name=entry?.name||clean(row.id);
                  const disabled=selectedAugments.length>=3||selectedAugments.includes(row.id);
                  return <button disabled={disabled} onClick={()=>addAugment(row.id)} key={row.id}>
                    <span>{src&&<img src={src} alt=""/>}</span>
                    <div>
                      <strong>{name}</strong>
                      <small>{row.games}x · média {row.avgPlacement.toFixed(2)}</small>
                    </div>
                  </button>;
                })}
              </div>
              :<p className="builder-empty-check">Nenhum Augment encontrado no histórico carregado.</p>}
          </div>
        </div>

        <div className="builder-augment-library">
          <div className="builder-subhead">
            <span>BIBLIOTECA DE AUGMENTS</span>
            <small>Data Dragon atual · máximo de 3</small>
          </div>
          <input value={augmentQuery} onChange={event=>setAugmentQuery(event.target.value)} placeholder="Pesquisar Augment..."/>
          <div className="builder-augment-grid">
            {augments.map(augment=>{
              const selected=selectedAugments.includes(augment.id);
              const disabled=selected||selectedAugments.length>=3;
              return <button className={selected?"selected":""} disabled={disabled} onClick={()=>addAugment(augment.id)} title={augment.name} key={augment.id}>
                <span>{augment.image&&<img src={augment.image} alt=""/>}</span>
                <strong>{augment.name}</strong>
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>

    {variantA&&variantAEvaluation&&variantDiff&&<section className="builder-ab-compare">
      <div className="builder-ab-head">
        <div>
          <span>COMPARAÇÃO A/B</span>
          <h2>Veja exatamente o que mudou</h2>
          <p>A é o snapshot salvo. “Agora” é o board atual. As métricas pessoais usam apenas partidas comparáveis do seu histórico carregado.</p>
        </div>
        <button onClick={()=>{setVariantA(null);setVariantAAugments([]);}}>Descartar A</button>
      </div>

      <div className="builder-ab-grid">
        <article className="builder-ab-card">
          <span>VERSÃO A</span>
          <strong>{variantA.length} unidades · {variantAEvaluation.value}G · {variantAAugments.length} aug.</strong>
          <small>{variantAEvaluation.average!=null
            ?"Histórico: média "+variantAEvaluation.average.toFixed(2)+" · Top 4 "+variantAEvaluation.top4Rate+"%"
            :"Histórico: amostra insuficiente"}</small>
        </article>

        <article className="builder-ab-card current">
          <span>AGORA</span>
          <strong>{units.length} unidades · {boardValue}G · {selectedAugments.length} aug.</strong>
          <small>{average!=null
            ?"Histórico: média "+average.toFixed(2)+" · Top 4 "+top4Rate+"%"
            :"Histórico: amostra insuficiente"}</small>
        </article>

        <article className="builder-ab-diff">
          <span>MUDANÇAS</span>
          <div>
            <p><b>Entraram</b>{variantDiff.added.length
              ?variantDiff.added.map(id=>staticEntry(staticData?.champions,id)?.name||clean(id)).join(" · ")
              :"nenhuma peça"}</p>
            <p><b>Saíram</b>{variantDiff.removed.length
              ?variantDiff.removed.map(id=>staticEntry(staticData?.champions,id)?.name||clean(id)).join(" · ")
              :"nenhuma peça"}</p>
            <p><b>Traits</b>{variantDiff.changedTraits.length
              ?variantDiff.changedTraits.map(row=>{
                const name=staticEntry(staticData?.traits,row.id)?.name||clean(row.id);
                const delta=row.after-row.before;
                return name+" "+(delta>0?"+":"")+delta;
              }).join(" · ")
              :"sem alteração estrutural"}</p>
            <p><b>Itens</b>{variantDiff.itemChanges.length
              ?variantDiff.itemChanges.map(id=>staticEntry(staticData?.champions,id)?.name||clean(id)).join(" · ")
              :"sem alteração de itemização"}</p>
            <p><b>Augments</b>{variantDiff.augmentChanges.before.length||variantDiff.augmentChanges.after.length
              ?[
                ...variantDiff.augmentChanges.before.map(id=>"− "+(staticEntry(staticData?.augments,id)?.name||clean(id))),
                ...variantDiff.augmentChanges.after.map(id=>"+ "+(staticEntry(staticData?.augments,id)?.name||clean(id))),
              ].join(" · ")
              :"sem alteração de augments"}</p>
          </div>
        </article>
      </div>
    </section>}

    {savedPresets.length>0&&<section className="builder-saved-strip">
      <div className="builder-saved-head">
        <div>
          <span>BOARDS SALVOS NESTE NAVEGADOR</span>
          <strong>{savedPresets.length}/8</strong>
        </div>
        <small>local · sem conta</small>
      </div>

      <div className="builder-saved-list">
        {savedPresets.map(preset=>(
          <article key={preset.id}>
            <button className="builder-saved-open" onClick={()=>restorePreset(preset)}>
              <span>{preset.targetLevel}</span>
              <div>
                <strong>{preset.name}</strong>
                <small>{preset.units.length} unidades · {preset.augments?.length||0} aug. · {new Date(preset.createdAt).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}</small>
              </div>
            </button>
            <button
              className="builder-saved-delete"
              onClick={()=>setSavedPresets(deleteBuilderPreset(preset.id))}
              aria-label={"Excluir "+preset.name}
            >×</button>
          </article>
        ))}
      </div>
    </section>}

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
          onUnitClick={selectedId?(unit)=>addToHex(unit.hex):removeUnit}
          interactive
          emptyLabel="Selecione um champion na biblioteca e clique no hex desejado."
        />

        <div className="builder-roster">
          <div className="builder-subhead">
            <span>SEU BOARD</span>
            <small>Ajuste estrelas aqui. No tabuleiro, clique numa unidade sem seleção para remover; com champion selecionado, clique para substituir.</small>
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
                  <div className="builder-unit-items">
                    {[0,1,2].map(index=>{
                      const itemId=unit.items?.[index];
                      const item=staticEntry(staticData?.items,itemId);
                      const itemImage=itemId&&staticData?tftAssetUrl(staticData.version,"item",item):"";
                      const itemName=item?.name||"Slot de item";
                      return itemId
                        ?<button className="filled" onClick={()=>removeItem(unit.hex,index)} title={"Remover "+itemName} key={index}>
                          {itemImage?<img src={itemImage} alt=""/>:<span>{itemName.slice(0,1)}</span>}
                        </button>
                        :<button className="empty" onClick={()=>openItemEditor(unit.hex)} title="Adicionar item" key={index}>+</button>;
                    })}
                    <button className={"builder-item-edit "+(selectedItemHex===unit.hex?"active":"")} onClick={()=>openItemEditor(unit.hex)}>
                      Itens
                    </button>
                  </div>
                </div>
                <button className="builder-remove-unit" onClick={()=>removeUnit(unit)}>×</button>
              </article>;
            })}
          </div>:<p className="builder-empty-check">O roster aparece aqui conforme você adiciona unidades ao tabuleiro.</p>}
        </div>

        {selectedItemUnit&&selectedItemChampion&&<section className="builder-item-lab">
          <div className="builder-item-lab-head">
            <div className="builder-item-target">
              <span>{selectedItemChampion.image&&<img src={selectedItemChampion.image} alt=""/>}</span>
              <div>
                <small>ITEMIZAÇÃO</small>
                <strong>{selectedItemChampion.name}</strong>
                <p>{selectedItemUnit.items?.length||0}/3 itens equipados</p>
              </div>
            </div>
            <div className="builder-item-lab-actions">
              {!!selectedItemUnit.items?.length&&<button onClick={()=>clearUnitItems(selectedItemUnit.hex)}>Limpar itens</button>}
              <button onClick={()=>setSelectedItemHex(null)}>Fechar</button>
            </div>
          </div>

          <div className="builder-equipped-items">
            {[0,1,2].map(index=>{
              const itemId=selectedItemUnit.items?.[index];
              const item=staticEntry(staticData?.items,itemId);
              const itemImage=itemId&&staticData?tftAssetUrl(staticData.version,"item",item):"";
              const itemName=item?.name||"Slot vazio";
              return <button
                className={itemId?"filled":"empty"}
                onClick={()=>itemId&&removeItem(selectedItemUnit.hex,index)}
                title={itemId?"Clique para remover "+itemName:"Escolha um item abaixo"}
                key={index}
              >
                {itemImage&&<img src={itemImage} alt=""/>}
                <span>{itemId?itemName:"Item "+(index+1)}</span>
              </button>;
            })}
          </div>

          <div className="builder-item-history">
            <div className="builder-subhead">
              <span>SEU HISTÓRICO COM ESTE CHAMPION</span>
              <small>{selectedUnitItemHistory.games
                ?selectedUnitItemHistory.games+" partida"+(selectedUnitItemHistory.games===1?"":"s")+" encontrada"+(selectedUnitItemHistory.games===1?"":"s")
                :"Nenhuma partida carregada com esta unidade"}</small>
            </div>
            {selectedUnitItemHistory.items.length>0
              ?<div className="builder-history-items">
                {selectedUnitItemHistory.items.map(row=>{
                  const item=staticEntry(staticData?.items,row.id);
                  const src=staticData?tftAssetUrl(staticData.version,"item",item):"";
                  const name=item?.name||clean(row.id);
                  const full=(selectedItemUnit.items?.length||0)>=3;
                  return <button disabled={full} onClick={()=>addItem(row.id)} title={name} key={row.id}>
                    <span>{src&&<img src={src} alt=""/>}</span>
                    <div><strong>{name}</strong><small>{row.games}x · média {row.avgPlacement.toFixed(2)}</small></div>
                  </button>;
                })}
              </div>
              :<p className="builder-empty-check">Sem itemização pessoal suficiente. Use a biblioteca abaixo sem tratar os itens como recomendação.</p>}
          </div>

          <div className="builder-item-library">
            <div className="builder-subhead">
              <span>BIBLIOTECA DE ITENS</span>
              <small>Data Dragon · clique para equipar até 3 itens</small>
            </div>
            <input value={itemQuery} onChange={event=>setItemQuery(event.target.value)} placeholder="Pesquisar item..."/>
            <div className="builder-item-grid">
              {items.map(item=>{
                const full=(selectedItemUnit.items?.length||0)>=3;
                return <button disabled={full} onClick={()=>addItem(item.id)} title={item.name} key={item.id}>
                  <span>{item.image&&<img src={item.image} alt=""/>}</span>
                  <strong>{item.name}</strong>
                </button>;
              })}
            </div>
          </div>
        </section>}

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

        <div className="builder-cost-filters" aria-label="Filtrar champions por custo">
          <button className={costFilter===0?"active":""} onClick={()=>setCostFilter(0)}>Todos</button>
          {[1,2,3,4,5].map(cost=>(
            <button className={(costFilter===cost?"active ":"")+"cost-"+cost} onClick={()=>setCostFilter(cost)} key={cost}>{cost}g</button>
          ))}
        </div>

        <div className="builder-champion-grid">
          {champions.map(row=>{
            const entry=staticEntry(staticData?.champions,row.id);
            const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
            return <button
              className={selectedId===row.id?"selected":""}
              onClick={()=>{setSelectedItemHex(null);setSelectedId(row.id);}}
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
              return <button onClick={()=>{setSelectedItemHex(null);setSelectedId(candidate.id);}} key={candidate.id}>
                <span>{src&&<img src={src} alt=""/>}</span>
                <div>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.cost}g · {candidate.shared.slice(0,2).map(id=>staticEntry(staticData?.traits,id)?.name||clean(id)).join(" · ")}</small>
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
              ?"média "+average.toFixed(2)
                +(top4Rate!=null?" · Top 4 "+top4Rate+"%":"")
                +(itemAssignments?" · itens "+(contextOverlap.item!=null?Math.round(contextOverlap.item*100)+"%":"configurados"):"")
                +(selectedAugments.length?" · aug. "+(contextOverlap.augment!=null?Math.round(contextOverlap.augment*100)+"%":"configurados"):"")
              :"nenhum comparável forte ainda"}</small>
          </div>

          {similar.length>0?<div className="builder-similar-list builder-similar-list-v2">
            {similar.map(({match,score})=>{
              const itemFit=itemSimilarity(units,match);
              return <article key={match.id}>
                <b>{match.placement}º</b>
                <span>
                  <strong>{Math.round(score*100)}% semelhante</strong>
                  <small>nível {match.level} · {match.goldLeft}g final · {match.units.filter(unit=>unit.tier>=3).length} 3★{itemFit!=null?" · itens "+Math.round(itemFit*100)+"%":""}{augmentSimilarity(selectedAugments,match)!=null?" · aug. "+Math.round((augmentSimilarity(selectedAugments,match)||0)*100)+"%":""}</small>
                </span>
              </article>;
            })}
          </div>:<p className="builder-empty-check">Seu histórico carregado ainda não tem boards suficientemente parecidos.</p>}

          {similar.length>0&&<button className="builder-evidence-button" onClick={()=>onEvidence(similar.map(row=>row.match.id),"Team Builder · boards parecidos")}>
            Ver evidências no histórico
          </button>}
        </>}
      </aside>
    </section>

    <p className="builder-disclaimer">O Builder compara estrutura final, traits, itens e augments configurados com o histórico carregado. Itens e augments do histórico são evidência pessoal, não uma tier list. Ele não conhece sua loja, ouro por rodada, scouting completo ou posição futura e não trata similaridade como causalidade.</p>
  </main>;
}
