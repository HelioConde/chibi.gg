import { TftMatch } from "../api/tft";
import { buildActionPlan } from "./actionPlan";

export type ReviewQueueKind="priority"|"compare"|"reference";

export type ReviewQueueItem={
  kind:ReviewQueueKind;
  matchId:string;
  placement:number;
  title:string;
  reason:string;
  evidence:string;
  signal:string;
  focus:string;
  tone:"danger"|"warning"|"good"|"neutral";
  score:number;
};

function coreTrait(match:TftMatch){
  return match.traits
    .filter(trait=>trait.numUnits>0&&(trait.style>0||trait.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)[0]?.name||"";
}

function threeStars(match:TftMatch){
  return match.units.filter(unit=>unit.tier>=3).length;
}

function reviewScore(match:TftMatch){
  let score=0;
  if(match.placement>=7) score+=42;
  else if(match.placement>=5) score+=24;
  else if(match.placement<=4&&match.placement>1) score+=12;
  if(match.goldLeft>=10) score+=Math.min(16,Math.round(match.goldLeft/2));
  if(match.level>=9&&match.placement>=5) score+=10;
  if(threeStars(match)===0&&match.placement>=6) score+=6;
  return score;
}


function diagnoseMatch(match:TftMatch){
  const stars=threeStars(match);

  if(match.placement===1){
    return {
      signal:"Vitória referência",
      focus:"Use este board final como baseline para comparar partidas parecidas que terminaram pior.",
      tone:"good" as const,
    };
  }

  if(match.placement>=7&&match.goldLeft>=10){
    return {
      signal:"Ouro não convertido",
      focus:"Compare o valor/qualidade do board final com o ouro que terminou guardado.",
      tone:"danger" as const,
    };
  }

  if(match.placement>=7&&match.level>=8){
    return {
      signal:"Nível sem conversão",
      focus:"Compare upgrades, estrelas e traits com os jogadores que chegaram ao Top 4.",
      tone:"danger" as const,
    };
  }

  if(match.placement>=7){
    return {
      signal:"Bottom 2",
      focus:"Procure a primeira diferença observável entre este board e seus jogos de 4º–6º.",
      tone:"danger" as const,
    };
  }

  if(match.placement>=5&&match.goldLeft>=10){
    return {
      signal:"Meio da lobby com ouro",
      focus:"Veja se o snapshot final mostra força de board abaixo do que seu ouro restante permitiria investigar.",
      tone:"warning" as const,
    };
  }

  if(match.placement>=5&&match.level>=8){
    return {
      signal:"Nível alto · fora do Top 4",
      focus:"Compare qualidade do board final, não apenas nível.",
      tone:"warning" as const,
    };
  }

  if(match.placement>1&&match.placement<=4){
    return {
      signal:"Top 4 sem fechar",
      focus:"Compare com 1º–2º e procure diferenças finais de estrelas, traits, itens e valor do board.",
      tone:"warning" as const,
    };
  }

  if(stars>0){
    return {
      signal:"Board com 3★",
      focus:"Use esta partida para entender se o spike de estrelas veio acompanhado de resultado.",
      tone:"neutral" as const,
    };
  }

  return {
    signal:"Partida de contraste",
    focus:"Compare esta estrutura com a partida principal e procure uma diferença observável por vez.",
    tone:"neutral" as const,
  };
}

function describeEvidence(match:TftMatch){
  const bits=[
    match.placement+"º lugar",
    "nível "+match.level,
    match.goldLeft+"g final",
    threeStars(match)+" unidade(s) 3★",
  ];
  return bits.join(" · ");
}

function byMostUseful(a:TftMatch,b:TftMatch){
  return reviewScore(b)-reviewScore(a)
    || b.placement-a.placement
    || (Number(b.playedAt)||0)-(Number(a.playedAt)||0);
}

export function buildReviewQueue(matches:TftMatch[]):ReviewQueueItem[]{
  const valid=matches
    .filter(match=>match.placement>=1&&match.placement<=8)
    .slice()
    .sort((a,b)=>(Number(b.playedAt)||0)-(Number(a.playedAt)||0));

  if(!valid.length) return [];

  const plan=buildActionPlan(valid);
  const planIds=new Set(plan.problem.matchIds);

  const priorityPool=valid.filter(match=>planIds.has(match.id));
  const priority=(priorityPool.length?priorityPool:valid)
    .slice()
    .sort(byMostUseful)[0];

  const priorityTrait=coreTrait(priority);

  const comparisonCandidates=valid
    .filter(match=>match.id!==priority.id)
    .map(match=>{
      let score=0;
      if(priorityTrait&&coreTrait(match)===priorityTrait) score+=35;
      if(match.placement<=4&&priority.placement>=5) score+=30;
      if(match.placement>1&&match.placement<=4&&priority.placement<=4) score+=18;
      score+=Math.max(0,8-match.placement)*3;
      score-=Math.abs(match.level-priority.level)*2;
      return {match,score};
    })
    .sort((a,b)=>b.score-a.score);

  const compare=comparisonCandidates[0]?.match||null;

  const reference=valid
    .filter(match=>match.id!==priority.id&&match.id!==compare?.id)
    .slice()
    .sort((a,b)=>a.placement-b.placement
      || threeStars(b)-threeStars(a)
      || b.level-a.level)[0]||null;

  const priorityDiagnosis=diagnoseMatch(priority);

  const items:ReviewQueueItem[]=[
    {
      kind:"priority",
      matchId:priority.id,
      placement:priority.placement,
      title:"Revisar primeiro",
      reason:plan.problem.title,
      evidence:describeEvidence(priority),
      signal:priorityDiagnosis.signal,
      focus:priorityDiagnosis.focus,
      tone:priorityDiagnosis.tone,
      score:reviewScore(priority),
    },
  ];

  if(compare){
    const same=priorityTrait&&coreTrait(compare)===priorityTrait;
    const diagnosis=diagnoseMatch(compare);
    items.push({
      kind:"compare",
      matchId:compare.id,
      placement:compare.placement,
      title:"Comparar depois",
      reason:same
        ?"Board de identidade parecida com resultado diferente."
        :"Uma partida útil para contrastar com o problema principal.",
      evidence:describeEvidence(compare),
      signal:diagnosis.signal,
      focus:diagnosis.focus,
      tone:diagnosis.tone,
      score:50,
    });
  }

  if(reference){
    const diagnosis=diagnoseMatch(reference);
    items.push({
      kind:"reference",
      matchId:reference.id,
      placement:reference.placement,
      title:"Usar como referência",
      reason:reference.placement===1
        ?"Uma vitória ajuda a enxergar o que estava presente quando o resultado fechou."
        :"Uma das melhores partidas restantes da amostra.",
      evidence:describeEvidence(reference),
      signal:diagnosis.signal,
      focus:diagnosis.focus,
      tone:diagnosis.tone,
      score:25,
    });
  }

  return items.slice(0,3);
}
