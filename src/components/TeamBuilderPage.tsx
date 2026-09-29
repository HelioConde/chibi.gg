import { useEffect, useMemo, useState } from "react";
import { TftMatch } from "../api/tft";
import {
  staticEntry,
  tftAssetUrl,
  TftStaticData,
} from "../tftStatic";
import HexBoard, { HexBoardRole, HexBoardUnit } from "./HexBoard";
import DDragonArt from "./DDragonArt";
import {
  BuilderPreset,
  deleteBuilderPreset,
  getBuilderPresets,
  saveBuilderPreset,
} from "../builderPresets";
import { useI18n } from "../i18n";

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

function rowForHex(hex:number){
  return Math.floor(hex/7);
}

function colForHex(hex:number){
  return hex%7;
}

function positionZone(hex:number){
  return rowForHex(hex)<=1?"front":"back";
}

export default function TeamBuilderPage({
  staticData,
  matches,
  hasProfile,
  onBack,
  onEvidence,
  initialChampionIds=[],
}:Props){
  const { t, locale } = useI18n();
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
  const [positioningMode,setPositioningMode]=useState(false);
  const [movingHex,setMovingHex]=useState<number|null>(null);
  const [transitionBase,setTransitionBase]=useState<HexBoardUnit[]|null>(null);
  const [transitionBaseLevel,setTransitionBaseLevel]=useState(8);
  const [transitionBaseAugments,setTransitionBaseAugments]=useState<string[]>([]);
  const [economyGold,setEconomyGold]=useState("");
  const [economyReserve,setEconomyReserve]=useState("");
  const [transitionProgress,setTransitionProgress]=useState<Record<string,number>>({});

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
    setPositioningMode(false);
    setMovingHex(null);
    setTransitionBase(null);
    setTransitionBaseAugments([]);
    setTransitionProgress({});
    setEconomyGold("");
    setEconomyReserve("");
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

    const beforePositions=new Map(variantA.map(unit=>[unit.id,unit.hex]));
    const afterPositions=new Map(units.map(unit=>[unit.id,unit.hex]));
    const positionChanges=[...beforePositions.keys()]
      .filter(id=>afterPositions.has(id)&&beforePositions.get(id)!==afterPositions.get(id))
      .slice(0,8);

    const beforeRoles=new Map(variantA.map(unit=>[unit.id,unit.role||""]));
    const afterRoles=new Map(units.map(unit=>[unit.id,unit.role||""]));
    const roleChanges=[...new Set([...beforeRoles.keys(),...afterRoles.keys()])]
      .filter(id=>(beforeRoles.get(id)||"")!==(afterRoles.get(id)||""))
      .slice(0,8);

    const augmentChanges={
      before:variantAAugments.filter(id=>!selectedAugments.includes(id)),
      after:selectedAugments.filter(id=>!variantAAugments.includes(id)),
    };

    return {added,removed,changedTraits,itemChanges,positionChanges,roleChanges,augmentChanges};
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

  const positionAnalysis=useMemo(()=>{
    const front=units.filter(unit=>positionZone(unit.hex)==="front");
    const back=units.filter(unit=>positionZone(unit.hex)==="back");
    const carries=units.filter(unit=>unit.role==="carry");
    const tanks=units.filter(unit=>unit.role==="tank");
    const utilities=units.filter(unit=>unit.role==="utility");
    const carryFront=carries.filter(unit=>positionZone(unit.hex)==="front");
    const tankBack=tanks.filter(unit=>positionZone(unit.hex)==="back");
    const roleUnits=[...carries,...tanks];
    const aligned=roleUnits.length-carryFront.length-tankBack.length;
    const fit=roleUnits.length?Math.round(aligned/roleUnits.length*100):null;
    const columns=new Set(units.map(unit=>colForHex(unit.hex))).size;
    const rows=new Set(units.map(unit=>rowForHex(unit.hex))).size;
    const edgeCarries=carries.filter(unit=>positionZone(unit.hex)==="back"&&(colForHex(unit.hex)===0||colForHex(unit.hex)===6)).length;

    return {
      front:front.length,
      back:back.length,
      carries:carries.length,
      tanks:tanks.length,
      utilities:utilities.length,
      assigned:carries.length+tanks.length+utilities.length,
      carryFront,
      tankBack,
      fit,
      columns,
      rows,
      edgeCarries,
    };
  },[units]);

  const transitionAnalysis=useMemo(()=>{
    if(!transitionBase)return null;

    const baseById=new Map(transitionBase.map(unit=>[unit.id,unit]));
    const targetById=new Map(units.map(unit=>[unit.id,unit]));
    const entering=units.filter(unit=>!baseById.has(unit.id));
    const leaving=transitionBase.filter(unit=>!targetById.has(unit.id));
    const kept=units.filter(unit=>baseById.has(unit.id));

    const upgrades=kept
      .map(unit=>{
        const before=baseById.get(unit.id)!;
        const beforeCopies=copiesFor(before.tier||1);
        const afterCopies=copiesFor(unit.tier||1);
        const extraCopies=Math.max(0,afterCopies-beforeCopies);
        return {
          unit,
          beforeTier:before.tier||1,
          afterTier:unit.tier||1,
          extraCopies,
          cost:extraCopies*costFor(unit.id,staticData),
        };
      })
      .filter(row=>row.extraCopies>0);

    const enteringCost=entering.reduce(
      (sum,unit)=>sum+costFor(unit.id,staticData)*copiesFor(unit.tier||1),
      0
    );
    const upgradeCost=upgrades.reduce((sum,row)=>sum+row.cost,0);
    const baseValue=transitionBase.reduce(
      (sum,unit)=>sum+costFor(unit.id,staticData)*copiesFor(unit.tier||1),
      0
    );
    const targetValue=units.reduce(
      (sum,unit)=>sum+costFor(unit.id,staticData)*copiesFor(unit.tier||1),
      0
    );

    const baseTraits=new Map<string,number>();
    for(const unit of transitionBase){
      for(const trait of unitTraitIds(unit.id,staticData)){
        baseTraits.set(trait,(baseTraits.get(trait)||0)+1);
      }
    }
    const targetTraits=new Map(traitCounts);
    const traitIds=new Set([...baseTraits.keys(),...targetTraits.keys()]);
    const traitChanges=[...traitIds]
      .map(id=>({id,before:baseTraits.get(id)||0,after:targetTraits.get(id)||0}))
      .filter(row=>row.before!==row.after)
      .sort((a,b)=>Math.abs(b.after-b.before)-Math.abs(a.after-a.before))
      .slice(0,6);

    const holderHints=entering
      .filter(target=>(target.items?.length||0)>0)
      .map(target=>{
        const desired=[...new Set(target.items||[])];
        let best:{
          holder:HexBoardUnit;
          matched:number;
          games:number;
          average:number|null;
          direct:boolean;
        }|null=null;

        for(const holder of leaving){
          const directMatched=desired.filter(itemId=>(holder.items||[]).includes(itemId)).length;
          let matched=directMatched;
          let games=0;
          let placement=0;

          for(const match of matches){
            const historical=match.units.find(unit=>unit.characterId===holder.id);
            if(!historical)continue;
            const overlap=desired.filter(itemId=>(historical.itemNames||[]).includes(itemId)).length;
            if(!overlap)continue;
            matched+=overlap;
            games++;
            placement+=match.placement;
          }

          if(!matched)continue;
          const candidate={
            holder,
            matched,
            games,
            average:games?placement/games:null,
            direct:directMatched>0,
          };
          if(!best||candidate.matched>best.matched||(candidate.matched===best.matched&&candidate.games>best.games)){
            best=candidate;
          }
        }

        return {target,hint:best};
      })
      .slice(0,5);

    const augmentChanges={
      leaving:transitionBaseAugments.filter(id=>!selectedAugments.includes(id)),
      entering:selectedAugments.filter(id=>!transitionBaseAugments.includes(id)),
    };

    return {
      entering,
      leaving,
      kept,
      upgrades,
      enteringCost,
      upgradeCost,
      copyCost:enteringCost+upgradeCost,
      baseValue,
      targetValue,
      valueDelta:targetValue-baseValue,
      traitChanges,
      holderHints,
      augmentChanges,
      levelDelta:targetLevel-transitionBaseLevel,
    };
  },[
    transitionBase,
    transitionBaseLevel,
    transitionBaseAugments,
    units,
    matches,
    staticData,
    traitCounts,
    selectedAugments,
    targetLevel,
  ]);

  const economyPlan=useMemo(()=>{
    if(!transitionAnalysis)return null;

    const positiveTraitIds=new Set(
      transitionAnalysis.traitChanges
        .filter(row=>row.after>row.before)
        .map(row=>row.id)
    );

    const familiarity=new Map<string,{games:number;placement:number}>();
    for(const match of matches){
      for(const unit of match.units){
        const current=familiarity.get(unit.characterId)||{games:0,placement:0};
        current.games++;
        current.placement+=match.placement;
        familiarity.set(unit.characterId,current);
      }
    }

    const enteringRows=transitionAnalysis.entering.map(unit=>{
      const unitCost=costFor(unit.id,staticData);
      const targetCopies=copiesFor(unit.tier||1);
      const traits=unitTraitIds(unit.id,staticData);
      const traitGain=traits.filter(id=>positiveTraitIds.has(id)).length;
      const itemCount=unit.items?.length||0;
      const roleScore=unit.role==="carry"?5:unit.role==="tank"?4:unit.role==="utility"?1:0;
      const score=roleScore+itemCount*2+traitGain*2+(unitCost>=4?1:0);
      const hist=familiarity.get(unit.id);
      const label=unit.role==="carry"||itemCount>=2
        ?"core"
        :unitCost>=4
          ?"cap"
          :traitGain>0
            ?"ponte"
            :"peça";
      return {
        id:unit.id,
        unit,
        kind:"enter" as const,
        label,
        unitCost,
        targetCopies,
        score,
        traitGain,
        personalGames:hist?.games||0,
        personalAverage:hist?.games?hist.placement/hist.games:null,
      };
    });

    const upgradeRows=transitionAnalysis.upgrades.map(row=>{
      const unitCost=costFor(row.unit.id,staticData);
      const itemCount=row.unit.items?.length||0;
      const roleScore=row.unit.role==="carry"?5:row.unit.role==="tank"?4:row.unit.role==="utility"?1:0;
      const hist=familiarity.get(row.unit.id);
      return {
        id:row.unit.id,
        unit:row.unit,
        kind:"upgrade" as const,
        label:"upgrade",
        unitCost,
        targetCopies:row.extraCopies,
        score:roleScore+itemCount*2+1,
        traitGain:0,
        personalGames:hist?.games||0,
        personalAverage:hist?.games?hist.placement/hist.games:null,
      };
    });

    const queue=[...enteringRows,...upgradeRows]
      .sort((a,b)=>b.score-a.score||a.unitCost-b.unitCost||a.id.localeCompare(b.id))
      .map(row=>{
        const acquired=Math.max(0,Math.min(row.targetCopies,transitionProgress[row.id]||0));
        const remainingCopies=Math.max(0,row.targetCopies-acquired);
        return {
          ...row,
          acquired,
          remainingCopies,
          remainingCost:remainingCopies*row.unitCost,
          complete:remainingCopies===0,
        };
      });

    const totalRemainingCost=queue.reduce((sum,row)=>sum+row.remainingCost,0);
    const totalTargetCost=queue.reduce((sum,row)=>sum+row.targetCopies*row.unitCost,0);

    const gold=economyGold.trim()===""?null:Math.max(0,Math.floor(Number(economyGold)||0));
    const reserve=economyReserve.trim()===""?0:Math.max(0,Math.floor(Number(economyReserve)||0));
    const spendable=gold==null?null:Math.max(0,gold-reserve);
    let runway=spendable;

    const queueWithBudget=queue.map(row=>{
      if(runway==null){
        return {...row,fundedCopies:null as number|null,budgetStatus:"sem orçamento"};
      }
      const fundedCopies=Math.min(row.remainingCopies,Math.floor(runway/row.unitCost));
      runway-=fundedCopies*row.unitCost;
      const budgetStatus=row.remainingCopies===0
        ?"concluído"
        :fundedCopies>=row.remainingCopies
          ?"coberto"
          :fundedCopies>0
            ?"parcial"
            :"aguarda";
      return {...row,fundedCopies,budgetStatus};
    });

    const firstPending=queueWithBudget.find(row=>!row.complete)||null;
    const completed=queue.filter(row=>row.complete).length;
    const coverage=spendable==null||totalRemainingCost===0
      ?null
      :Math.min(100,Math.round(spendable/totalRemainingCost*100));

    return {
      queue:queueWithBudget,
      totalRemainingCost,
      totalTargetCost,
      gold,
      reserve,
      spendable,
      remainingBudget:runway,
      firstPending,
      completed,
      coverage,
    };
  },[
    transitionAnalysis,
    transitionProgress,
    economyGold,
    economyReserve,
    matches,
    staticData,
  ]);

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
        title:t("builder.decision.start.title"),
        body:t("builder.decision.start.body"),
      };
    }

    if(overSlots>0){
      return {
        tone:"warning",
        title:t("builder.decision.over.title"),
        body:t("builder.decision.over.body",{units:units.length,level:targetLevel,over:overSlots}),
      };
    }

    if(openSlots>0&&candidateUnits[0]){
      return {
        tone:"neutral",
        title:t("builder.decision.open.title",{open:openSlots,level:targetLevel}),
        body:t("builder.decision.open.body",{name:candidateUnits[0].name,traits:candidateUnits[0].shared.length}),
      };
    }

    if(similar.length>=3&&average!=null&&average<=4.25){
      return {
        tone:"good",
        title:t("builder.decision.good.title"),
        body:t("builder.decision.good.body",{count:similar.length,average:average.toFixed(2),top4:top4Rate??"—"}),
      };
    }

    if(similar.length>=3&&average!=null&&average>=5){
      return {
        tone:"warning",
        title:t("builder.decision.caution.title"),
        body:t("builder.decision.caution.body",{count:similar.length,average:average.toFixed(2)}),
      };
    }

    return {
      tone:"neutral",
      title:t("builder.decision.closed.title"),
      body:t("builder.decision.closed.body"),
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
    t,
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
    if(movingHex===unit.hex)setMovingHex(null);
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

  function setUnitRole(hex:number,role:HexBoardRole){
    setUnits(current=>current.map(unit=>
      unit.hex===hex
        ?{...unit,role:unit.role===role?undefined:role}
        :unit
    ));
  }

  function moveUnitToHex(targetHex:number){
    if(movingHex==null)return;

    setUnits(current=>{
      const source=current.find(unit=>unit.hex===movingHex);
      if(!source)return current;
      const target=current.find(unit=>unit.hex===targetHex);

      return current.map(unit=>{
        if(unit.hex===movingHex)return {...unit,hex:targetHex};
        if(target&&unit.hex===targetHex)return {...unit,hex:movingHex};
        return unit;
      });
    });

    if(selectedItemHex===movingHex)setSelectedItemHex(targetHex);
    setMovingHex(null);
  }

  function handleBoardHexClick(hex:number){
    if(positioningMode&&movingHex!=null){
      moveUnitToHex(hex);
      return;
    }
    addToHex(hex);
  }

  function handleBoardUnitClick(unit:HexBoardUnit){
    if(selectedId){
      addToHex(unit.hex);
      return;
    }

    if(positioningMode){
      if(movingHex==null){
        setMovingHex(unit.hex);
        return;
      }
      if(movingHex===unit.hex){
        setMovingHex(null);
        return;
      }
      moveUnitToHex(unit.hex);
      return;
    }

    removeUnit(unit);
  }

  function togglePositioning(){
    setPositioningMode(current=>{
      const next=!current;
      if(next){
        setSelectedId(null);
        setSelectedItemHex(null);
      }else{
        setMovingHex(null);
      }
      return next;
    });
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

  function captureTransitionBase(){
    if(!units.length)return;
    setTransitionBase(units.map(unit=>({...unit,items:[...(unit.items||[])]})));
    setTransitionProgress({});
    setTransitionBaseLevel(targetLevel);
    setTransitionBaseAugments([...selectedAugments]);
    setSelectedId(null);
    setSelectedItemHex(null);
    setMovingHex(null);
    setPositioningMode(false);
  }

  function restoreTransitionBase(){
    if(!transitionBase)return;
    setUnits(transitionBase.map(unit=>({...unit,items:[...(unit.items||[])]})));
    setTargetLevel(transitionBaseLevel);
    setSelectedAugments([...transitionBaseAugments]);
    setSelectedId(null);
    setSelectedItemHex(null);
    setMovingHex(null);
    setPositioningMode(false);
  }

  function clearTransition(){
    setTransitionBase(null);
    setTransitionBaseAugments([]);
    setTransitionProgress({});
    setEconomyGold("");
    setEconomyReserve("");
  }

  function changeTransitionCopies(id:string,delta:number,maxCopies:number){
    setTransitionProgress(current=>{
      const next=Math.max(0,Math.min(maxCopies,(current[id]||0)+delta));
      if(next===0){
        const copy={...current};
        delete copy[id];
        return copy;
      }
      return {...current,[id]:next};
    });
  }

  function resetTransitionProgress(){
    setTransitionProgress({});
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
    setPositioningMode(false);
    setMovingHex(null);
    setTransitionBase(null);
    setTransitionBaseAugments([]);
    setTransitionProgress({});
    setEconomyGold("");
    setEconomyReserve("");
  }

  async function copyBoardSummary(){
    const names=units
      .slice()
      .sort((a,b)=>a.hex-b.hex)
      .map(unit=>{
        const entry=staticEntry(staticData?.champions,unit.id);
        const roleLabel=unit.role==="carry"?"Carry":unit.role==="tank"?"Tank":unit.role==="utility"?"Util.":"";
        const zoneLabel=positionZone(unit.hex)==="front"?"Front":"Back";
        const unitName=(entry?.name||clean(unit.id))+" "+("★".repeat(Math.max(1,Math.min(3,unit.tier||1))))+(roleLabel?" · "+roleLabel+"/"+zoneLabel:"");
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
      t("builder.summary.level",{level:targetLevel,units:units.length,value:boardValue}),
      names.join(" · "),
      traits.length?"Traits: "+traits.join(" · "):"",
      selectedAugments.length
        ?"Augments: "+selectedAugments.map(id=>staticEntry(staticData?.augments,id)?.name||clean(id)).join(" · ")
        :"",
      transitionAnalysis
        ?t("builder.summary.transition",{leaving:transitionAnalysis.leaving.length,entering:transitionAnalysis.entering.length,cost:transitionAnalysis.copyCost})
        :"",
      economyPlan&&economyPlan.queue.length
        ?t("builder.summary.progress",{done:economyPlan.completed,total:economyPlan.queue.length,remaining:economyPlan.totalRemainingCost})
        :"",
      economyPlan?.gold!=null
        ?t("builder.summary.economy",{gold:economyPlan.gold,reserve:economyPlan.reserve,free:economyPlan.spendable??"—"})
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

  return <main className="builder-page builder-v2 builder-v3 builder-v4 builder-v5 builder-v6 builder-v7 builder-v8">
    <section className="builder-hero">
      <div>
        {hasProfile&&<button className="back-search" onClick={onBack}>{t("common.backProfile")}</button>}
        <span className="eyebrow">CHIBI LAB · TEAM BUILDER V8</span>
        <h1>{t("builder.hero.title1")}<br/><em>{t("builder.hero.title2")}</em></h1>
        <p>{initialChampionIds.length?t("builder.hero.loaded"):t("builder.hero.empty")}</p>
        <DDragonArt
          staticData={staticData}
          championIds={units.map(unit=>unit.id)}
          variant="ribbon"
          label={t("builder.riotVisual")}
        />
      </div>

      <div className="builder-summary builder-summary-v2">
        <div><span>{t("builder.targetLevel")}</span><strong>{targetLevel}</strong></div>
        <div><span>{t("builder.units")}</span><strong className={overSlots>0?"warning":""}>{units.length}/{targetLevel}</strong></div>
        <div><span>BOARD VALUE</span><strong>{boardValue}G</strong></div>
        <div><span>{t("builder.averageCost")}</span><strong>{averageUnitCost.toFixed(1)}G</strong></div>
        <div className="builder-level-control">
          <span>{t("builder.planLevel")}</span>
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
          <button onClick={saveCurrentBoard} disabled={!units.length}>{t("builder.saveBoard")}</button>
          <button className="secondary" onClick={copyBoardSummary} disabled={!units.length}>
            {copied?t("builder.summaryCopied"):t("builder.copySummary")}
          </button>
          <button className={transitionBase?"transition-active":""} onClick={captureTransitionBase} disabled={!units.length}>
            {transitionBase?t("builder.updateCurrent"):t("builder.markCurrent")}
          </button>
          <button onClick={()=>{
            setVariantA(units.map(unit=>({...unit,items:[...(unit.items||[])]})));
            setVariantAAugments([...selectedAugments]);
          }} disabled={!units.length}>
            {variantA?t("builder.updateA"):t("builder.saveA")}
          </button>
          {variantA&&<button className="secondary" onClick={()=>{
            setUnits(variantA.map(unit=>({...unit,items:[...(unit.items||[])]})));
            setSelectedAugments([...variantAAugments]);
            setSelectedId(null);
          }}>{t("builder.restoreA")}</button>}
          <button className="secondary" onClick={()=>{setUnits([]);setSelectedAugments([]);setSelectedId(null);setSelectedItemHex(null);setMovingHex(null);setTransitionBase(null);setTransitionBaseAugments([]);setTransitionProgress({});setEconomyGold("");setEconomyReserve("");}}>{t("builder.clearBoard")}</button>
        </div>
      </div>
    </section>

    <section className="builder-decision-strip">
      <div className={"builder-decision-card "+decision.tone}>
        <span>{t("builder.boardRead")}</span>
        <h2>{decision.title}</h2>
        <p>{decision.body}</p>
      </div>

      <div className="builder-board-facts">
        <article><span>{t("builder.twoStars")}</span><strong>{twoStars}/{units.length||0}</strong></article>
        <article><span>3★</span><strong>{threeStars}</strong></article>
        <article><span>{t("builder.items")}</span><strong>{itemAssignments}</strong></article>
        <article><span>AUGMENTS</span><strong>{selectedAugments.length}/3</strong></article>
        <article><span>{t("builder.position")}</span><strong>{positionAnalysis.fit==null?"—":positionAnalysis.fit+"%"}</strong></article>
        <article><span>{t("builder.visibleTraits")}</span><strong>{traitCounts.length}</strong></article>
        <article><span>{t("builder.comparables")}</span><strong>{similar.length}</strong></article>
      </div>
    </section>

    <section className="builder-planner-hud">
      <div className="builder-planner-head">
        <div>
          <span>{t("builder.plan")}</span>
          <h2>{t("builder.nextDecision")}</h2>
          <p>{t("builder.planDesc")}</p>
        </div>
        <div className={"builder-slot-state "+(overSlots>0?"warning":openSlots===0?"good":"")}>
          <small>SLOTS</small>
          <strong>{units.length}/{targetLevel}</strong>
          <span>{overSlots>0?t("builder.slots.excess",{count:overSlots}):openSlots>0?t("builder.slots.open",{count:openSlots}):t("builder.slots.closed")}</span>
        </div>
      </div>

      <div className="builder-planner-grid">
        <article className="builder-plan-card focus">
          <span>{t("builder.currentFocus")}</span>
          <strong>{primaryTrait
            ?(staticEntry(staticData?.traits,primaryTrait[0])?.name||clean(primaryTrait[0]))+" · "+primaryTrait[1]
            :t("builder.noStructure")}</strong>
          <small>{primaryTrait
            ?t("builder.primaryTrait")
            :t("builder.addToDiscover")}</small>
        </article>

        <article className="builder-plan-card">
          <span>{t("builder.cheapBridge")}</span>
          <strong>{bridgeCandidate?bridgeCandidate.name:"—"}</strong>
          <small>{bridgeCandidate
            ?bridgeCandidate.cost+"g · conecta "+bridgeCandidate.shared.slice(0,2).map(id=>staticEntry(staticData?.traits,id)?.name||clean(id)).join(" + ")
            :t("builder.noBridge")}</small>
          {bridgeCandidate&&<button onClick={()=>{setSelectedItemHex(null);setSelectedId(bridgeCandidate.id);}}>{t("builder.select")}</button>}
        </article>

        <article className="builder-plan-card">
          <span>{t("builder.capPiece")}</span>
          <strong>{capCandidate?capCandidate.name:"—"}</strong>
          <small>{capCandidate
            ?capCandidate.cost+"g · compartilha "+capCandidate.shared.length+" trait"+(capCandidate.shared.length===1?"":"s")
            :t("builder.noCap")}</small>
          {capCandidate&&<button onClick={()=>{setSelectedItemHex(null);setSelectedId(capCandidate.id);}}>Selecionar</button>}
        </article>

        <article className="builder-plan-card curve">
          <span>{t("builder.costCurve")}</span>
          <div className="builder-cost-curve">
            {costCurve.map((count,index)=><b className={"cost-"+(index+1)} key={index}>
              <em>{index+1}g</em>
              <strong>{count}</strong>
            </b>)}
          </div>
          <small>{units.length?t("builder.averageUnitCost",{value:averageUnitCost.toFixed(1)}):t("builder.emptyBoard")}</small>
        </article>
      </div>

      {selectedChampion&&<div className="builder-selection-guide">
        <span className={"builder-selection-image cost-"+selectedChampion.cost}>
          {selectedChampion.image&&<img src={selectedChampion.image} alt=""/>}
        </span>
        <div>
          <small>{t("builder.selectedChampion")}</small>
          <strong>{selectedChampion.name} · {selectedChampion.cost}g</strong>
          <p>{selectedChampion.traits.slice(0,3).map(id=>staticEntry(staticData?.traits,id)?.name||clean(id)).join(" · ")||t("builder.noTraits")}</p>
        </div>
        <b>{t("builder.selectedHint")}</b>
        <button onClick={()=>setSelectedId(null)}>{t("builder.cancel")}</button>
      </div>}
    </section>

    {transitionBase&&transitionAnalysis&&<section className="builder-transition-lab">
      <div className="builder-transition-head">
        <div>
          <span>{t("builder.transition.route")}</span>
          <h2>{t("builder.transition.nowToTarget")}</h2>
          <p>{t("builder.transition.desc")}</p>
        </div>
        <div className="builder-transition-actions">
          <button onClick={restoreTransitionBase}>{t("builder.transition.backCurrent")}</button>
          <button className="secondary" onClick={captureTransitionBase}>{t("builder.transition.useTarget")}</button>
          <button className="danger" onClick={clearTransition}>{t("builder.transition.end")}</button>
        </div>
      </div>

      <div className="builder-transition-boards">
        <article>
          <div className="builder-transition-board-head">
            <span>{t("builder.transition.now")}</span>
            <strong>{t("builder.transition.boardSummary",{level:transitionBaseLevel,units:transitionBase.length,value:transitionAnalysis.baseValue})}</strong>
          </div>
          <HexBoard units={transitionBase} staticData={staticData} compact />
        </article>
        <div className="builder-transition-arrow">→</div>
        <article>
          <div className="builder-transition-board-head">
            <span>{t("builder.transition.target")}</span>
            <strong>{t("builder.transition.boardSummary",{level:targetLevel,units:units.length,value:transitionAnalysis.targetValue})}</strong>
          </div>
          <HexBoard units={units} staticData={staticData} compact />
        </article>
      </div>

      <div className="builder-transition-metrics">
        <article>
          <span>{t("builder.transition.keep")}</span>
          <strong>{transitionAnalysis.kept.length}</strong>
          <small>{t("builder.transition.keepDesc")}</small>
        </article>
        <article>
          <span>{t("builder.transition.leave")}</span>
          <strong>{transitionAnalysis.leaving.length}</strong>
          <small>{t("builder.transition.leaveDesc")}</small>
        </article>
        <article>
          <span>{t("builder.transition.enter")}</span>
          <strong>{transitionAnalysis.entering.length}</strong>
          <small>{t("builder.transition.enterDesc")}</small>
        </article>
        <article>
          <span>{t("builder.transition.targetCopies")}</span>
          <strong>{transitionAnalysis.copyCost}G</strong>
          <small>{t("builder.transition.copyBreakdown",{newCost:transitionAnalysis.enteringCost,upgradeCost:transitionAnalysis.upgradeCost})}</small>
        </article>
        <article>
          <span>{t("builder.transition.boardValue")}</span>
          <strong>{transitionAnalysis.valueDelta>0?"+":""}{transitionAnalysis.valueDelta}G</strong>
          <small>{t("builder.transition.valueDesc")}</small>
        </article>
        <article>
          <span>{t("builder.transition.level")}</span>
          <strong>{transitionAnalysis.levelDelta===0?"=":(transitionAnalysis.levelDelta>0?"+":"")+transitionAnalysis.levelDelta}</strong>
          <small>{transitionBaseLevel} → {targetLevel}</small>
        </article>
      </div>

      {economyPlan&&<section className="builder-economy-lab">
        <div className="builder-economy-head">
          <div>
            <span>{t("builder.economy.plan")}</span>
            <h3>{t("builder.economy.title")}</h3>
            <p>{t("builder.economy.desc")}</p>
          </div>
          <div className="builder-economy-inputs">
            <label>
              <span>{t("builder.economy.currentGold")}</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={economyGold}
                onChange={event=>setEconomyGold(event.target.value.replace(/[^0-9]/g,""))}
                placeholder="ex: 42"
              />
            </label>
            <label>
              <span>{t("builder.economy.reserve")}</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={economyReserve}
                onChange={event=>setEconomyReserve(event.target.value.replace(/[^0-9]/g,""))}
                placeholder="ex: 10"
              />
            </label>
          </div>
        </div>

        <div className="builder-economy-metrics">
          <article>
            <span>{t("builder.economy.freeBudget")}</span>
            <strong>{economyPlan.spendable==null?"—":economyPlan.spendable+"G"}</strong>
            <small>{economyPlan.gold==null?t("builder.economy.tellGold"):t("builder.economy.preserved",{gold:economyPlan.reserve})}</small>
          </article>
          <article>
            <span>{t("builder.economy.remainingCost")}</span>
            <strong>{economyPlan.totalRemainingCost}G</strong>
            <small>{t("builder.economy.remainingCopies")}</small>
          </article>
          <article>
            <span>{t("builder.economy.coverage")}</span>
            <strong>{economyPlan.coverage==null?"—":economyPlan.coverage+"%"}</strong>
            <small>{economyPlan.spendable==null?t("builder.economy.waitBudget"):t("builder.economy.ofRemaining")}</small>
          </article>
          <article>
            <span>{t("builder.economy.completed")}</span>
            <strong>{economyPlan.completed}/{economyPlan.queue.length}</strong>
            <small>{t("builder.economy.manual")}</small>
          </article>
        </div>

        <div className="builder-economy-next">
          <div>
            <span>{t("builder.economy.next")}</span>
            {economyPlan.firstPending
              ?<>
                <strong>{staticEntry(staticData?.champions,economyPlan.firstPending.id)?.name||clean(economyPlan.firstPending.id)}</strong>
                <p>{t("builder.economy.missing",{copies:economyPlan.firstPending.remainingCopies,cost:economyPlan.firstPending.remainingCost})}</p>
              </>
              :<>
                <strong>{t("builder.economy.done")}</strong>
                <p>{t("builder.economy.doneDesc")}</p>
              </>}
          </div>
          {economyPlan.queue.some(row=>row.acquired>0)&&<button onClick={resetTransitionProgress}>{t("builder.economy.reset")}</button>}
        </div>

        {economyPlan.queue.length
          ?<div className="builder-buy-queue">
            {economyPlan.queue.map((row,index)=>{
              const entry=staticEntry(staticData?.champions,row.id);
              const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
              const role=row.unit.role==="carry"?"Carry":row.unit.role==="tank"?"Tank":row.unit.role==="utility"?t("builder.queue.utility"):"";
              const reason=[
                role,
                row.traitGain>0?t("builder.queue.traitsGain",{count:row.traitGain}):"",
                row.personalGames>0?t("builder.queue.history",{count:row.personalGames}):"",
              ].filter(Boolean).join(" · ");

              const budgetCopy=row.fundedCopies;
              const budgetText=row.complete
                ?t("builder.economy.targetDone")
                :budgetCopy==null
                  ?t("builder.economy.simulate")
                  :row.budgetStatus==="coberto"
                    ?t("builder.economy.fits")
                    :row.budgetStatus==="parcial"
                      ?t("builder.economy.partial",{funded:budgetCopy,remaining:row.remainingCopies})
                      :t("builder.economy.out");

              return <article className={"builder-buy-row "+(row.complete?"complete":"")} key={row.kind+"-"+row.id}>
                <b className="builder-buy-order">{index+1}</b>
                <span className={"builder-buy-image cost-"+costFor(row.id,staticData)}>{src&&<img src={src} alt=""/>}</span>
                <div className="builder-buy-copy">
                  <div>
                    <em>{row.label}</em>
                    <strong>{entry?.name||clean(row.id)}</strong>
                  </div>
                  <small>{row.kind==="upgrade"
                    ?t("builder.queue.upgrade",{copies:row.targetCopies})
                    :t("builder.queue.target",{tier:row.unit.tier||1,copies:row.targetCopies})}</small>
                  {reason&&<small>{reason}{row.personalAverage!=null?t("builder.queue.personalAverage",{average:row.personalAverage.toFixed(2)}):""}</small>}
                </div>
                <div className="builder-copy-counter">
                  <button disabled={row.acquired<=0} onClick={()=>changeTransitionCopies(row.id,-1,row.targetCopies)}>−</button>
                  <span><strong>{row.acquired}</strong>/{row.targetCopies}</span>
                  <button disabled={row.acquired>=row.targetCopies} onClick={()=>changeTransitionCopies(row.id,1,row.targetCopies)}>+</button>
                </div>
                <div className="builder-buy-cost">
                  <strong>{row.remainingCost}G</strong>
                  <small>{budgetText}</small>
                </div>
              </article>;
            })}
          </div>
          :<p className="builder-empty-check">{t("builder.queue.empty")}</p>}

        <div className="builder-economy-note">
          <b>{t("builder.queue.readTitle")}</b>
          <p>{t("builder.queue.readDesc")}</p>
        </div>
      </section>}

      <div className="builder-transition-detail-grid">
        <article className="builder-transition-list">
          <div className="builder-subhead">
            <span>{t("builder.swaps.title")}</span>
            <small>{t("builder.swaps.desc")}</small>
          </div>
          <div className="builder-transition-swaps">
            {transitionAnalysis.leaving.length||transitionAnalysis.entering.length
              ?<>
                {transitionAnalysis.leaving.map(unit=>{
                  const entry=staticEntry(staticData?.champions,unit.id);
                  const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
                  return <div className="out" key={"out-"+unit.id}>
                    <span>{src&&<img src={src} alt=""/>}</span>
                    <div><strong>{entry?.name||clean(unit.id)}</strong><small>{t("builder.swaps.out")}</small></div>
                  </div>;
                })}
                {transitionAnalysis.entering.map(unit=>{
                  const entry=staticEntry(staticData?.champions,unit.id);
                  const src=staticData?tftAssetUrl(staticData.version,"champion",entry):"";
                  const unitCost=costFor(unit.id,staticData)*copiesFor(unit.tier||1);
                  return <div className="in" key={"in-"+unit.id}>
                    <span>{src&&<img src={src} alt=""/>}</span>
                    <div><strong>{entry?.name||clean(unit.id)}</strong><small>{t("builder.swaps.in",{cost:unitCost,tier:unit.tier||1})}</small></div>
                  </div>;
                })}
              </>
              :<p className="builder-empty-check">{t("builder.swaps.same")}</p>}
          </div>

          {transitionAnalysis.upgrades.length>0&&<div className="builder-transition-upgrades">
            <div className="builder-subhead">
              <span>{t("builder.upgrades.title")}</span>
              <small>{t("builder.upgrades.desc")}</small>
            </div>
            {transitionAnalysis.upgrades.map(row=>{
              const entry=staticEntry(staticData?.champions,row.unit.id);
              return <p key={row.unit.id}>
                <b>{entry?.name||clean(row.unit.id)}</b>
                <span>{t("builder.upgrades.row",{before:row.beforeTier,after:row.afterTier,copies:row.extraCopies,cost:row.cost})}</span>
              </p>;
            })}
          </div>}
        </article>

        <article className="builder-transition-holders">
          <div className="builder-subhead">
            <span>{t("builder.holders.title")}</span>
            <small>{t("builder.holders.desc")}</small>
          </div>
          {transitionAnalysis.holderHints.length
            ?<div>
              {transitionAnalysis.holderHints.map(({target,hint})=>{
                const targetEntry=staticEntry(staticData?.champions,target.id);
                const targetSrc=staticData?tftAssetUrl(staticData.version,"champion",targetEntry):"";
                const holderEntry=hint?staticEntry(staticData?.champions,hint.holder.id):undefined;
                const holderSrc=hint&&staticData?tftAssetUrl(staticData.version,"champion",holderEntry):"";
                const itemNames=(target.items||[]).map(id=>staticEntry(staticData?.items,id)?.name||clean(id));
                return <div className="builder-holder-row" key={target.id}>
                  <span className="target">{targetSrc&&<img src={targetSrc} alt=""/>}</span>
                  <div>
                    <strong>{targetEntry?.name||clean(target.id)}</strong>
                    <small>{itemNames.join(" · ")}</small>
                  </div>
                  <b>←</b>
                  {hint
                    ?<>
                      <span className="holder">{holderSrc&&<img src={holderSrc} alt=""/>}</span>
                      <div>
                        <strong>{holderEntry?.name||clean(hint.holder.id)}</strong>
                        <small>{hint.direct
                          ?t("builder.holders.direct")
                          :t("builder.holders.history",{games:hint.games,average:hint.average!=null?t("builder.holders.average",{average:hint.average.toFixed(2)}):""})}</small>
                      </div>
                    </>
                    :<div className="no-holder"><strong>{t("builder.holders.none")}</strong><small>{t("builder.holders.noneDesc")}</small></div>}
                </div>;
              })}
            </div>
            :<p className="builder-empty-check">{t("builder.holders.empty")}</p>}
        </article>
      </div>

      <div className="builder-transition-context">
        <div>
          <span>{t("builder.transition.traits")}</span>
          <p>{transitionAnalysis.traitChanges.length
            ?transitionAnalysis.traitChanges.map(row=>{
              const name=staticEntry(staticData?.traits,row.id)?.name||clean(row.id);
              const delta=row.after-row.before;
              return name+" "+(delta>0?"+":"")+delta;
            }).join(" · ")
            :t("builder.transition.noTraitChange")}</p>
        </div>
        <div>
          <span>AUGMENTS</span>
          <p>{transitionAnalysis.augmentChanges.leaving.length||transitionAnalysis.augmentChanges.entering.length
            ?[
              ...transitionAnalysis.augmentChanges.leaving.map(id=>"− "+(staticEntry(staticData?.augments,id)?.name||clean(id))),
              ...transitionAnalysis.augmentChanges.entering.map(id=>"+ "+(staticEntry(staticData?.augments,id)?.name||clean(id))),
            ].join(" · ")
            :t("builder.transition.noAugmentChange")}</p>
        </div>
      </div>
    </section>}

    <section className="builder-position-lab">
      <div className="builder-position-head">
        <div>
          <span>{t("builder.positioning.title")}</span>
          <h2>{t("builder.positioning.heading")}</h2>
          <p>{t("builder.positioning.desc")}</p>
        </div>
        <button className={positioningMode?"active":""} onClick={togglePositioning}>
          {positioningMode?t("builder.positioning.exitMove"):t("builder.positioning.moveUnits")}
        </button>
      </div>

      <div className="builder-position-grid">
        <article className="builder-position-stat">
          <span>FRONTLINE</span>
          <strong>{positionAnalysis.front}</strong>
          <small>{t("builder.positioning.frontRows")}</small>
        </article>
        <article className="builder-position-stat">
          <span>BACKLINE</span>
          <strong>{positionAnalysis.back}</strong>
          <small>{t("builder.positioning.backRows")}</small>
        </article>
        <article className="builder-position-stat">
          <span>{t("builder.positioning.roles")}</span>
          <strong>{positionAnalysis.assigned}/{units.length||0}</strong>
          <small>{t("builder.positioning.rolesSummary",{tanks:positionAnalysis.tanks,carries:positionAnalysis.carries,utilities:positionAnalysis.utilities})}</small>
        </article>
        <article className={"builder-position-stat "+(positionAnalysis.fit!=null&&positionAnalysis.fit<70?"warning":"")}>
          <span>{t("builder.positioning.alignment")}</span>
          <strong>{positionAnalysis.fit==null?"—":positionAnalysis.fit+"%"}</strong>
          <small>{t("builder.positioning.alignmentDesc")}</small>
        </article>
      </div>

      <div className="builder-position-reading">
        <div>
          <span>{t("builder.positioning.quick")}</span>
          <strong>{positionAnalysis.assigned===0
            ?t("builder.positioning.needRoles")
            :positionAnalysis.carryFront.length||positionAnalysis.tankBack.length
              ?t("builder.positioning.conflict")
              :t("builder.positioning.ok")}</strong>
          <p>{positionAnalysis.assigned===0
            ?t("builder.positioning.needRolesDesc")
            :[
              positionAnalysis.carryFront.length?t("builder.positioning.carryFront",{count:positionAnalysis.carryFront.length}):"",
              positionAnalysis.tankBack.length?t("builder.positioning.tankBack",{count:positionAnalysis.tankBack.length}):"",
              positionAnalysis.edgeCarries?t("builder.positioning.edgeCarry",{count:positionAnalysis.edgeCarries}):"",
            ].filter(Boolean).join(" · ")||t("builder.positioning.noConflict")}</p>
        </div>
        <div className="builder-position-spread">
          <span>{t("builder.positioning.occupation")}</span>
          <b>{t("builder.positioning.columns",{count:positionAnalysis.columns})}</b>
          <b>{t("builder.positioning.rows",{count:positionAnalysis.rows})}</b>
        </div>
      </div>

      {positioningMode&&<div className="builder-position-instruction">
        <b>{movingHex==null?t("builder.positioning.select"):t("builder.positioning.moveHint",{hex:movingHex+1})}</b>
        {movingHex!=null&&<button onClick={()=>setMovingHex(null)}>{t("builder.positioning.cancel")}</button>}
      </div>}
    </section>

    <section className="builder-augment-lab">
      <div className="builder-augment-head">
        <div>
          <span>{t("builder.augments.context")}</span>
          <h2>Augments</h2>
          <p>{t("builder.augments.desc")}</p>
        </div>
        <div className="builder-context-overlap">
          <small>{t("builder.augments.overlap")}</small>
          <strong>{selectedAugments.length&&contextOverlap.augment!=null?Math.round(contextOverlap.augment*100)+"%":"—"}</strong>
          <span>{selectedAugments.length
            ?t("builder.augments.overlapCount",{with:contextOverlap.withAugment,total:similar.length})
            :t("builder.augments.chooseCompare")}</span>
        </div>
      </div>

      <div className="builder-augment-layout">
        <div className="builder-augment-selected">
          <div className="builder-subhead">
            <span>{t("builder.augments.slots")}</span>
            <small>{t("builder.augments.removeDesc")}</small>
          </div>
          <div className="builder-augment-slots">
            {[0,1,2].map(index=>{
              const augmentId=selectedAugments[index];
              const entry=staticEntry(staticData?.augments,augmentId);
              const src=augmentId&&staticData?tftAssetUrl(staticData.version,"augment",entry):"";
              const name=entry?.name||t("builder.augments.slot",{index:index+1});
              return <button
                className={augmentId?"filled":"empty"}
                onClick={()=>augmentId&&removeAugment(index)}
                title={augmentId?t("builder.augments.remove",{name}):t("builder.augments.choose")}
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
              <span>{t("builder.augments.history")}</span>
              <small>{t("builder.augments.loaded",{count:matches.length})}</small>
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
                      <small>{t("builder.augments.historyRow",{count:row.games,average:row.avgPlacement.toFixed(2)})}</small>
                    </div>
                  </button>;
                })}
              </div>
              :<p className="builder-empty-check">{t("builder.augments.historyEmpty")}</p>}
          </div>
        </div>

        <div className="builder-augment-library">
          <div className="builder-subhead">
            <span>{t("builder.augments.library")}</span>
            <small>{t("builder.augments.libraryDesc")}</small>
          </div>
          <input value={augmentQuery} onChange={event=>setAugmentQuery(event.target.value)} placeholder={t("builder.augments.search")}/>
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
          <span>{t("builder.ab.title")}</span>
          <h2>{t("builder.ab.heading")}</h2>
          <p>{t("builder.ab.desc")}</p>
        </div>
        <button onClick={()=>{setVariantA(null);setVariantAAugments([]);}}>{t("builder.ab.discard")}</button>
      </div>

      <div className="builder-ab-grid">
        <article className="builder-ab-card">
          <span>{t("builder.ab.versionA")}</span>
          <strong>{variantA.length} unidades · {variantAEvaluation.value}G · {variantAAugments.length} aug.</strong>
          <small>{variantAEvaluation.average!=null
            ?t("builder.ab.history",{average:variantAEvaluation.average.toFixed(2),top4:variantAEvaluation.top4Rate??"—"})
            :t("builder.ab.insufficient")}</small>
        </article>

        <article className="builder-ab-card current">
          <span>{t("builder.ab.now")}</span>
          <strong>{units.length} unidades · {boardValue}G · {selectedAugments.length} aug.</strong>
          <small>{average!=null
            ?t("builder.ab.history",{average:average.toFixed(2),top4:top4Rate??"—"})
            :t("builder.ab.insufficient")}</small>
        </article>

        <article className="builder-ab-diff">
          <span>{t("builder.ab.changes")}</span>
          <div>
            <p><b>{t("builder.ab.entered")}</b>{variantDiff.added.length
              ?variantDiff.added.map(id=>staticEntry(staticData?.champions,id)?.name||clean(id)).join(" · ")
              :t("builder.ab.nonePiece")}</p>
            <p><b>{t("builder.ab.left")}</b>{variantDiff.removed.length
              ?variantDiff.removed.map(id=>staticEntry(staticData?.champions,id)?.name||clean(id)).join(" · ")
              :t("builder.ab.nonePiece")}</p>
            <p><b>Traits</b>{variantDiff.changedTraits.length
              ?variantDiff.changedTraits.map(row=>{
                const name=staticEntry(staticData?.traits,row.id)?.name||clean(row.id);
                const delta=row.after-row.before;
                return name+" "+(delta>0?"+":"")+delta;
              }).join(" · ")
              :t("builder.ab.noStructure")}</p>
            <p><b>Itens</b>{variantDiff.itemChanges.length
              ?variantDiff.itemChanges.map(id=>staticEntry(staticData?.champions,id)?.name||clean(id)).join(" · ")
              :t("builder.ab.noItems")}</p>
            <p><b>Augments</b>{variantDiff.augmentChanges.before.length||variantDiff.augmentChanges.after.length
              ?[
                ...variantDiff.augmentChanges.before.map(id=>"− "+(staticEntry(staticData?.augments,id)?.name||clean(id))),
                ...variantDiff.augmentChanges.after.map(id=>"+ "+(staticEntry(staticData?.augments,id)?.name||clean(id))),
              ].join(" · ")
              :t("builder.ab.noAugments")}</p>
            <p><b>Posições</b>{variantDiff.positionChanges.length
              ?variantDiff.positionChanges.map(id=>staticEntry(staticData?.champions,id)?.name||clean(id)).join(" · ")
              :t("builder.ab.noPosition")}</p>
            <p><b>{t("builder.ab.roles")}</b>{variantDiff.roleChanges.length
              ?variantDiff.roleChanges.map(id=>staticEntry(staticData?.champions,id)?.name||clean(id)).join(" · ")
              :t("builder.ab.noRole")}</p>
          </div>
        </article>
      </div>
    </section>}

    {savedPresets.length>0&&<section className="builder-saved-strip">
      <div className="builder-saved-head">
        <div>
          <span>{t("builder.saved.title")}</span>
          <strong>{savedPresets.length}/8</strong>
        </div>
        <small>{t("builder.saved.local")}</small>
      </div>

      <div className="builder-saved-list">
        {savedPresets.map(preset=>(
          <article key={preset.id}>
            <button className="builder-saved-open" onClick={()=>restorePreset(preset)}>
              <span>{preset.targetLevel}</span>
              <div>
                <strong>{preset.name}</strong>
                <small>{t("builder.saved.meta",{units:preset.units.length,augments:preset.augments?.length||0,date:new Date(preset.createdAt).toLocaleDateString(locale,{day:"2-digit",month:"2-digit"})})}</small>
              </div>
            </button>
            <button
              className="builder-saved-delete"
              onClick={()=>setSavedPresets(deleteBuilderPreset(preset.id))}
              aria-label={t("builder.saved.delete",{name:preset.name})}
            >×</button>
          </article>
        ))}
      </div>
    </section>}

    <section className="builder-workspace">
      <div className="panel builder-board-panel">
        <div className="builder-panel-head">
          <div>
            <span>{t("builder.board")}</span>
            <h2>{selectedId?t("builder.board.chooseHex"):positioningMode?(movingHex==null?t("builder.board.selectUnit"):t("builder.board.chooseDestination")):t("builder.board.yours")}</h2>
          </div>
          <div className="builder-board-head-actions">
            <button className={positioningMode?"active":""} onClick={togglePositioning}>{positioningMode?t("builder.board.moveActive"):t("builder.board.position")}</button>
            {selectedId&&<button onClick={()=>setSelectedId(null)}>{t("builder.board.cancelSelection")}</button>}
          </div>
        </div>

        <HexBoard
          units={units}
          staticData={staticData}
          onHexClick={handleBoardHexClick}
          onUnitClick={handleBoardUnitClick}
          positioning={positioningMode}
          movingHex={movingHex}
          interactive
          emptyLabel={t("builder.board.emptyHint")}
        />

        <div className="builder-roster">
          <div className="builder-subhead">
            <span>{t("builder.roster")}</span>
            <small>{t("builder.roster.desc")}</small>
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
                  <div className="builder-role-control">
                    <button className={unit.role==="tank"?"active tank":""} onClick={()=>setUnitRole(unit.hex,"tank")}>Tank</button>
                    <button className={unit.role==="carry"?"active carry":""} onClick={()=>setUnitRole(unit.hex,"carry")}>Carry</button>
                    <button className={unit.role==="utility"?"active utility":""} onClick={()=>setUnitRole(unit.hex,"utility")}>Util.</button>
                  </div>
                  <div className="builder-unit-items">
                    {[0,1,2].map(index=>{
                      const itemId=unit.items?.[index];
                      const item=staticEntry(staticData?.items,itemId);
                      const itemImage=itemId&&staticData?tftAssetUrl(staticData.version,"item",item):"";
                      const itemName=item?.name||t("builder.item.slot");
                      return itemId
                        ?<button className="filled" onClick={()=>removeItem(unit.hex,index)} title={t("builder.item.remove",{item:itemName})} key={index}>
                          {itemImage?<img src={itemImage} alt=""/>:<span>{itemName.slice(0,1)}</span>}
                        </button>
                        :<button className="empty" onClick={()=>openItemEditor(unit.hex)} title={t("builder.item.add")} key={index}>+</button>;
                    })}
                    <button className={"builder-item-edit "+(selectedItemHex===unit.hex?"active":"")} onClick={()=>openItemEditor(unit.hex)}>
                      {t("builder.items")}
                    </button>
                  </div>
                </div>
                <button className="builder-remove-unit" onClick={()=>removeUnit(unit)}>×</button>
              </article>;
            })}
          </div>:<p className="builder-empty-check">{t("builder.roster.empty")}</p>}
        </div>

        {selectedItemUnit&&selectedItemChampion&&<section className="builder-item-lab">
          <div className="builder-item-lab-head">
            <div className="builder-item-target">
              <span>{selectedItemChampion.image&&<img src={selectedItemChampion.image} alt=""/>}</span>
              <div>
                <small>{t("builder.itemization")}</small>
                <strong>{selectedItemChampion.name}</strong>
                <p>{t("builder.item.equipped",{count:selectedItemUnit.items?.length||0})}</p>
              </div>
            </div>
            <div className="builder-item-lab-actions">
              {!!selectedItemUnit.items?.length&&<button onClick={()=>clearUnitItems(selectedItemUnit.hex)}>{t("builder.item.clear")}</button>}
              <button onClick={()=>setSelectedItemHex(null)}>{t("builder.close")}</button>
            </div>
          </div>

          <div className="builder-equipped-items">
            {[0,1,2].map(index=>{
              const itemId=selectedItemUnit.items?.[index];
              const item=staticEntry(staticData?.items,itemId);
              const itemImage=itemId&&staticData?tftAssetUrl(staticData.version,"item",item):"";
              const itemName=item?.name||t("builder.item.emptySlot");
              return <button
                className={itemId?"filled":"empty"}
                onClick={()=>itemId&&removeItem(selectedItemUnit.hex,index)}
                title={itemId?t("builder.item.clickRemove",{item:itemName}):t("builder.item.chooseBelow")}
                key={index}
              >
                {itemImage&&<img src={itemImage} alt=""/>}
                <span>{itemId?itemName:t("builder.item.label",{index:index+1})}</span>
              </button>;
            })}
          </div>

          <div className="builder-item-history">
            <div className="builder-subhead">
              <span>{t("builder.item.history")}</span>
              <small>{selectedUnitItemHistory.games
                ?t("builder.item.historyFound",{count:selectedUnitItemHistory.games})
                :t("builder.item.historyEmpty")}</small>
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
                    <div><strong>{name}</strong><small>{t("builder.item.historyRow",{count:row.games,average:row.avgPlacement.toFixed(2)})}</small></div>
                  </button>;
                })}
              </div>
              :<p className="builder-empty-check">{t("builder.item.notEnough")}</p>}
          </div>

          <div className="builder-item-library">
            <div className="builder-subhead">
              <span>{t("builder.item.library")}</span>
              <small>{t("builder.item.libraryDesc")}</small>
            </div>
            <input value={itemQuery} onChange={event=>setItemQuery(event.target.value)} placeholder={t("builder.item.search")}/>
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
            <span>{t("builder.traits.live")}</span>
            <small>{t("builder.traits.desc")}</small>
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
            }):<small>{t("builder.traits.empty")}</small>}
          </div>
        </div>
      </div>

      <aside className="panel builder-library">
        <div className="builder-panel-head">
          <div>
            <span>CHAMPIONS</span>
            <h2>{t("builder.library")}</h2>
          </div>
        </div>

        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("builder.champion.search")}/>

        <div className="builder-cost-filters" aria-label={t("builder.champion.filterAria")}>
          <button className={costFilter===0?"active":""} onClick={()=>setCostFilter(0)}>{t("builder.all")}</button>
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
              title={t("builder.champion.add",{name:row.name})}
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
            <span>{t("builder.candidates")}</span>
            <small>{t("builder.candidates.desc")}</small>
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
          {!candidateUnits.length&&<p className="builder-empty-check">{t("builder.candidates.empty")}</p>}
        </section>}
      </aside>

      <aside className="panel builder-chibi builder-check-v2">
        <div className="builder-panel-head">
          <div>
            <span>CHIBI CHECK</span>
            <h2>{t("builder.check.title")}</h2>
          </div>
        </div>

        {!hasProfile&&<div className="builder-empty-check">
          {t("builder.check.noProfile")}
        </div>}

        {hasProfile&&units.length<3&&<div className="builder-empty-check">
          {t("builder.check.needThree")}
        </div>}

        {hasProfile&&units.length>=3&&<>
          <div className="builder-fit-main">
            <span>{t("builder.check.similar")}</span>
            <strong>{similar.length}</strong>
            <small>{average!=null
              ?t("builder.check.summary",{
                average:average.toFixed(2),
                top4:top4Rate!=null?t("builder.check.top4",{value:top4Rate}):"",
                items:itemAssignments?t("builder.check.items",{value:contextOverlap.item!=null?Math.round(contextOverlap.item*100)+"%":t("builder.check.configured")}):"",
                augments:selectedAugments.length?t("builder.check.augments",{value:contextOverlap.augment!=null?Math.round(contextOverlap.augment*100)+"%":t("builder.check.configured")}):"",
              })
              :t("builder.check.none")}</small>
          </div>

          {similar.length>0?<div className="builder-similar-list builder-similar-list-v2">
            {similar.map(({match,score})=>{
              const itemFit=itemSimilarity(units,match);
              return <article key={match.id}>
                <b>{match.placement}º</b>
                <span>
                  <strong>{t("builder.check.similarity",{value:Math.round(score*100)})}</strong>
                  <small>{t("builder.check.matchMeta",{level:match.level,gold:match.goldLeft,stars:match.units.filter(unit=>unit.tier>=3).length,items:itemFit!=null?t("builder.check.items",{value:Math.round(itemFit*100)+"%"}):"",augments:augmentSimilarity(selectedAugments,match)!=null?t("builder.check.augments",{value:Math.round((augmentSimilarity(selectedAugments,match)||0)*100)+"%"}):""})}</small>
                </span>
              </article>;
            })}
          </div>:<p className="builder-empty-check">{t("builder.check.noSimilar")}</p>}

          {similar.length>0&&<button className="builder-evidence-button" onClick={()=>onEvidence(similar.map(row=>row.match.id),"Team Builder · boards parecidos")}>
            {t("builder.check.evidence")}
          </button>}
        </>}
      </aside>
    </section>

    <p className="builder-disclaimer">{t("builder.disclaimer")}</p>
  </main>;
}
