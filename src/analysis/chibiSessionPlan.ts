import { TftMatch } from "../api/tft";
import { buildPersonalMeta } from "./chibiProduct";
import { buildRankedReviewSignals } from "./chibiReviewRanking";

export type SessionPlanLine={
  traitId:string|null;
  label:string;
  games:number;
  avgPlacement:number|null;
  top4Rate:number;
  matchIds:string[];
  unitIds:string[];
};

export type ChibiSessionPlan={
  focus:{
    title:string;
    body:string;
    evidence:string;
    confidence:"alta"|"média"|"baixa";
    matchIds:string[];
  };
  primary:SessionPlanLine|null;
  alternative:SessionPlanLine|null;
  rule:string;
};

function activeTraitIds(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)
    .slice(0,4)
    .map(trait=>trait.name);
}

function lineUnits(matches:TftMatch[],traitId:string|null){
  const relevant=traitId
    ? matches.filter(match=>activeTraitIds(match).includes(traitId))
    : matches.slice(0,5);
  const scores=new Map<string,number>();

  relevant.forEach((match,index)=>{
    match.units.forEach(unit=>{
      const placement=Math.max(1,9-match.placement);
      const stars=unit.tier>=3?5:unit.tier===2?2:0;
      const recency=Math.max(1,6-index);
      scores.set(unit.characterId,(scores.get(unit.characterId)||0)+placement+stars+recency);
    });
  });

  return [...scores.entries()]
    .sort((a,b)=>b[1]-a[1])
    .slice(0,8)
    .map(([id])=>id);
}

function fallbackLine(matches:TftMatch[]):SessionPlanLine|null{
  const best=matches
    .filter(match=>match.placement>=1&&match.placement<=8)
    .slice()
    .sort((a,b)=>a.placement-b.placement||(Number(b.playedAt)||0)-(Number(a.playedAt)||0))[0];
  if(!best)return null;

  const traits=activeTraitIds(best);
  return {
    traitId:traits[0]||null,
    label:"Board de referência recente",
    games:1,
    avgPlacement:best.placement,
    top4Rate:best.placement<=4?100:0,
    matchIds:[best.id],
    unitIds:best.units.slice(0,8).map(unit=>unit.characterId),
  };
}

function focusRule(signalId:string){
  if(signalId==="bottom2-risk"||signalId==="bottom2-gold-left"){
    return "Prioridade da sessão: proteger o piso. Uma partida ruim ainda pode ser um teste válido; evite transformar um sinal em obrigação de forçar linha.";
  }
  if(signalId==="conversion-low"){
    return "Prioridade da sessão: comparar seus Top 4. Mude uma variável por vez e revise depois, em vez de perseguir uma receita durante a partida.";
  }
  if(signalId.startsWith("line-dominance:")){
    return "Prioridade da sessão: manter sua linha confortável como referência e aceitar uma segunda identidade quando o spot aparecer naturalmente.";
  }
  if(signalId.startsWith("trait-risk:")){
    return "Prioridade da sessão: observar a execução dessa linha. Não conclua que a comp é ruim por uma amostra curta.";
  }
  if(signalId==="recent-form"){
    return "Prioridade da sessão: descobrir o que mudou. Compare o bloco novo com o anterior antes de alterar várias coisas ao mesmo tempo.";
  }
  return "Prioridade da sessão: testar uma mudança observável por vez e revisar o resultado depois das partidas.";
}

export function buildChibiSessionPlan(matches:TftMatch[]):ChibiSessionPlan{
  const valid=matches.filter(match=>match.placement>=1&&match.placement<=8);
  const signals=buildRankedReviewSignals(valid);
  const focus=signals.find(signal=>signal.kind==="risk")||signals[0]||null;
  const meta=buildPersonalMeta(valid);

  const lines=meta.map(row=>({
    traitId:row.id,
    label:"Linha recorrente",
    games:row.games,
    avgPlacement:row.avgPlacement,
    top4Rate:row.top4Rate,
    matchIds:row.matchIds,
    unitIds:lineUnits(valid,row.id),
  }));

  let primary=lines[0]||fallbackLine(valid);
  let alternative=lines.find(line=>line.traitId!==primary?.traitId)||null;

  if(focus?.id.startsWith("trait-risk:")&&focus.subjectId){
    const riskLine=lines.find(line=>line.traitId===focus.subjectId);
    if(riskLine){
      alternative=riskLine;
      primary=lines.find(line=>line.traitId!==riskLine.traitId)||primary;
    }
  }

  if(focus?.id.startsWith("line-dominance:")&&focus.subjectId){
    const dominant=lines.find(line=>line.traitId===focus.subjectId);
    const second=lines.find(line=>line.traitId!==focus.subjectId);
    primary=dominant||primary;
    alternative=second||alternative;
  }

  if(!alternative&&valid.length>=2){
    const other=valid
      .filter(match=>!primary?.matchIds.includes(match.id))
      .slice()
      .sort((a,b)=>a.placement-b.placement)[0];
    if(other){
      alternative={
        traitId:activeTraitIds(other)[0]||null,
        label:"Alternativa observada",
        games:1,
        avgPlacement:other.placement,
        top4Rate:other.placement<=4?100:0,
        matchIds:[other.id],
        unitIds:other.units.slice(0,8).map(unit=>unit.characterId),
      };
    }
  }

  return {
    focus:focus
      ? {
          title:focus.title,
          body:focus.body,
          evidence:focus.evidence,
          confidence:focus.confidence,
          matchIds:focus.matchIds,
        }
      : {
          title:"Colete mais partidas",
          body:"Ainda não há sinal suficiente para priorizar um foco sem transformar ruído em recomendação.",
          evidence:`${valid.length} partida(s) carregada(s)`,
          confidence:"baixa",
          matchIds:valid.map(match=>match.id),
        },
    primary,
    alternative,
    rule:focusRule(focus?.id||""),
  };
}
