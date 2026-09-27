import { TftMatch } from "../api/tft";

export type SimilarBoard={
  match:TftMatch;
  similarity:number;
  sharedTraits:string[];
  sharedUnits:string[];
  addedTraits:string[];
  removedTraits:string[];
  addedUnits:string[];
  removedUnits:string[];
  levelDelta:number;
  threeStarDelta:number;
};

export type CounterfactualResult={
  target:TftMatch;
  similar:SimilarBoard[];
  better:SimilarBoard[];
  worse:SimilarBoard[];
  avgBetter:number|null;
  avgAll:number|null;
};

function setOf(values:string[]){
  return new Set(values.filter(Boolean));
}

function jaccard(a:Set<string>,b:Set<string>){
  if(!a.size&&!b.size) return 1;
  const intersection=[...a].filter(value=>b.has(value)).length;
  const union=new Set([...a,...b]).size;
  return union?intersection/union:0;
}

function coreTraits(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,5)
    .map(trait=>trait.name);
}

function units(match:TftMatch){
  return match.units.map(unit=>unit.characterId);
}

function augments(match:TftMatch){
  return match.augments||[];
}

function threeStars(match:TftMatch){
  return match.units.filter(unit=>unit.tier>=3).length;
}

function avg(values:number[]){
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
}

function diff(base:string[],candidate:string[]){
  const a=setOf(base);
  const b=setOf(candidate);
  return {
    shared:[...a].filter(value=>b.has(value)),
    added:[...b].filter(value=>!a.has(value)),
    removed:[...a].filter(value=>!b.has(value)),
  };
}

export function boardSimilarity(target:TftMatch,candidate:TftMatch){
  const traitScore=jaccard(setOf(coreTraits(target)),setOf(coreTraits(candidate)));
  const unitScore=jaccard(setOf(units(target)),setOf(units(candidate)));
  const augmentScore=jaccard(setOf(augments(target)),setOf(augments(candidate)));
  const levelScore=Math.max(0,1-Math.abs(target.level-candidate.level)/3);

  return traitScore*.42+unitScore*.38+augmentScore*.1+levelScore*.1;
}

export function buildCounterfactual(target:TftMatch,history:TftMatch[]):CounterfactualResult{
  const comparable=history.filter(match=>
    match.id!==target.id &&
    (!target.setNumber||!match.setNumber||Number(match.setNumber)===Number(target.setNumber)) &&
    (!target.queueId||!match.queueId||Number(match.queueId)===Number(target.queueId))
  );

  const similar=comparable
    .map(match=>{
      const traitDiff=diff(coreTraits(target),coreTraits(match));
      const unitDiff=diff(units(target),units(match));
      return {
        match,
        similarity:Math.round(boardSimilarity(target,match)*100),
        sharedTraits:traitDiff.shared,
        sharedUnits:unitDiff.shared,
        addedTraits:traitDiff.added,
        removedTraits:traitDiff.removed,
        addedUnits:unitDiff.added,
        removedUnits:unitDiff.removed,
        levelDelta:match.level-target.level,
        threeStarDelta:threeStars(match)-threeStars(target),
      };
    })
    .filter(result=>result.similarity>=20)
    .sort((a,b)=>b.similarity-a.similarity)
    .slice(0,6);

  const better=similar.filter(result=>result.match.placement<target.placement);
  const worse=similar.filter(result=>result.match.placement>target.placement);

  return {
    target,
    similar,
    better,
    worse,
    avgBetter:avg(better.map(result=>result.match.placement)),
    avgAll:avg(similar.map(result=>result.match.placement)),
  };
}
