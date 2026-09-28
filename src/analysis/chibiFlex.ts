import { TftGlobalComp, TftMatch } from "../api/tft";

export type ChibiFlexRole="familiar"|"bridge"|"explore";

export type ChibiFlexOption={
  id:string;
  role:ChibiFlexRole;
  label:string;
  reason:string;
  confidence:"alta"|"média"|"inicial";
  personalMatchIds:string[];
  unitIds:string[];
  traitIds:string[];
  traitOverlap:number;
  unitOverlap:number;
  globalAverage:number;
  globalTop4:number;
  globalGames:number;
};

function activeTraitIds(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,4)
    .map(trait=>trait.name);
}

function globalQuality(comp:TftGlobalComp){
  const placement=Math.max(0,Math.min(1,(8.5-comp.averagePlacement)/7.5));
  const top4=Math.max(0,Math.min(1,comp.top4Rate/100));
  const sample=Math.min(1,comp.games/30);
  return placement*.46+top4*.36+sample*.18;
}

function personalFit(comp:TftGlobalComp,matches:TftMatch[]){
  if(!matches.length){
    return {fit:0,traitOverlap:0,unitOverlap:0,matchIds:[] as string[]};
  }

  const traitCounts=new Map<string,number>();
  const unitCounts=new Map<string,number>();

  for(const match of matches){
    for(const trait of activeTraitIds(match)){
      traitCounts.set(trait,(traitCounts.get(trait)||0)+1);
    }
    for(const unit of match.units){
      unitCounts.set(unit.characterId,(unitCounts.get(unit.characterId)||0)+1);
    }
  }

  const traitOverlap=comp.traits.reduce(
    (sum,trait)=>sum+Math.min(1,(traitCounts.get(trait.id)||0)/Math.max(1,matches.length*.25)),
    0,
  )/Math.max(1,comp.traits.length);

  const unitOverlap=comp.units.reduce(
    (sum,unit)=>sum+Math.min(1,(unitCounts.get(unit.id)||0)/Math.max(1,matches.length*.2)),
    0,
  )/Math.max(1,comp.units.length);

  const matchIds=matches
    .filter(match=>{
      const traits=new Set(activeTraitIds(match));
      const units=new Set(match.units.map(unit=>unit.characterId));
      const sharedTraits=comp.traits.filter(row=>traits.has(row.id)).length;
      const sharedUnits=comp.units.filter(row=>units.has(row.id)).length;
      return sharedTraits>=1||sharedUnits>=3;
    })
    .map(match=>match.id);

  return {
    fit:traitOverlap*.68+unitOverlap*.32,
    traitOverlap:Math.round(traitOverlap*100),
    unitOverlap:Math.round(unitOverlap*100),
    matchIds,
  };
}

function buildReason(
  role:ChibiFlexRole,
  fit:{traitOverlap:number;unitOverlap:number;matchIds:string[]},
  comp:TftGlobalComp,
){
  if(role==="familiar"){
    return fit.matchIds.length>=2
      ? `Você já tem ${fit.matchIds.length} partida(s) com peças ou traits próximas. É a opção mais fácil de comparar com seu próprio histórico.`
      : "É a linha observada com maior sobreposição ao seu pool recente.";
  }
  if(role==="bridge"){
    return `Mistura familiaridade com desempenho observado: ${fit.traitOverlap}% de sobreposição de traits e média global ${comp.averagePlacement}.`;
  }
  return fit.traitOverlap>0||fit.unitOverlap>0
    ? `Amplia seu repertório sem começar do zero: há ${fit.traitOverlap}% de sobreposição de traits e ${fit.unitOverlap}% de unidades.`
    : "É uma linha forte na base observada, mas pouco presente no seu histórico recente. Use para estudo, não para forçar.";
}

export function buildChibiFlexOptions(
  comps:TftGlobalComp[],
  matches:TftMatch[],
):ChibiFlexOption[]{
  const candidates=comps
    .filter(comp=>comp.games>=3)
    .map(comp=>{
      const fit=personalFit(comp,matches);
      const quality=globalQuality(comp);
      const confidence=comp.confidence==="alta"?1:comp.confidence==="média"?.82:.58;
      return {
        comp,
        fit,
        quality,
        familiarScore:fit.fit*.6+quality*.28+confidence*.12,
        bridgeScore:fit.fit*.42+quality*.43+confidence*.15,
        exploreScore:(1-Math.min(.72,fit.fit))*.28+quality*.57+confidence*.15,
      };
    });

  if(!candidates.length)return [];

  const chosen:Array<{candidate:(typeof candidates)[number];role:ChibiFlexRole}>=[];
  const use=(candidate:(typeof candidates)[number]|undefined,role:ChibiFlexRole)=>{
    if(!candidate||chosen.some(item=>item.candidate.comp.id===candidate.comp.id))return;
    chosen.push({candidate,role});
  };

  use(
    candidates
      .filter(row=>row.fit.fit>=.24)
      .slice()
      .sort((a,b)=>b.familiarScore-a.familiarScore)[0]
      || candidates.slice().sort((a,b)=>b.familiarScore-a.familiarScore)[0],
    "familiar",
  );

  use(
    candidates
      .filter(row=>!chosen.some(item=>item.candidate.comp.id===row.comp.id)&&row.fit.fit>=.12)
      .slice()
      .sort((a,b)=>b.bridgeScore-a.bridgeScore)[0],
    "bridge",
  );

  use(
    candidates
      .filter(row=>!chosen.some(item=>item.candidate.comp.id===row.comp.id))
      .slice()
      .sort((a,b)=>b.exploreScore-a.exploreScore)[0],
    "explore",
  );

  for(const candidate of candidates.slice().sort((a,b)=>b.bridgeScore-a.bridgeScore)){
    if(chosen.length>=3)break;
    use(candidate,chosen.length===0?"familiar":chosen.length===1?"bridge":"explore");
  }

  return chosen.slice(0,3).map(({candidate,role})=>({
    id:candidate.comp.id,
    role,
    label:role==="familiar"
      ?"Mais próxima do seu histórico"
      :role==="bridge"
        ?"Melhor ponte entre você e o meta"
        :"Linha para ampliar repertório",
    reason:buildReason(role,candidate.fit,candidate.comp),
    confidence:candidate.comp.confidence,
    personalMatchIds:candidate.fit.matchIds,
    unitIds:candidate.comp.units.slice(0,8).map(unit=>unit.id),
    traitIds:candidate.comp.traits.slice(0,4).map(trait=>trait.id),
    traitOverlap:candidate.fit.traitOverlap,
    unitOverlap:candidate.fit.unitOverlap,
    globalAverage:candidate.comp.averagePlacement,
    globalTop4:candidate.comp.top4Rate,
    globalGames:candidate.comp.games,
  }));
}
