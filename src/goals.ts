import { TftMatch } from "./api/tft";
import { buildLeakMap, buildSessionCoach } from "./analysis/chibiProduct";

export type GoalType="protect-floor"|"convert-top4"|"diversify"|"stabilize";

export type GoalSnapshot={
  sample:number;
  avgPlacement:number|null;
  top4Rate:number;
  bottom2Rate:number;
  winRate:number;
  conversionRate:number;
  uniqueLines:number;
};

export type GoalOutcome={
  verdict:"improved"|"mixed"|"unchanged"|"worse";
  title:string;
  summary:string;
  nextFocus:string;
  before:GoalSnapshot;
  after:GoalSnapshot;
  metricLabel:string;
  metricBefore:string;
  metricAfter:string;
  metricDelta:string;
  matchIds:string[];
  achieved:boolean;
};

export type ChibiGoal={
  id:string;
  playerKey:string;
  type:GoalType;
  title:string;
  description:string;
  createdAt:number;
  baselineIds:string[];
  baseline?:GoalSnapshot;
  targetGames:number;
  completedAt?:number;
};

export type GoalHistoryRecord={
  id:string;
  playerKey:string;
  title:string;
  type:GoalType;
  createdAt:number;
  completedAt:number;
  outcome:GoalOutcome;
};

const KEY="chibi.gg:session-goals:v1";
const HISTORY_KEY="chibi.gg:session-goal-history:v1";

function readAll():Record<string,ChibiGoal>{
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw) return {};
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{
    return {};
  }
}

function writeAll(data:Record<string,ChibiGoal>){
  localStorage.setItem(KEY,JSON.stringify(data));
}

export function getGoal(playerKey:string){
  return readAll()[playerKey]||null;
}

export function saveGoal(goal:ChibiGoal){
  const all=readAll();
  all[goal.playerKey]=goal;
  writeAll(all);
}

export function clearGoal(playerKey:string){
  const all=readAll();
  delete all[playerKey];
  writeAll(all);
}

function round(value:number,decimals=1){
  const factor=10**decimals;
  return Math.round(value*factor)/factor;
}

function pct(value:number,total:number){
  return total?Math.round(value/total*100):0;
}

function primaryTrait(match:TftMatch){
  return match.traits
    .filter(t=>t.numUnits>0&&(t.style>0||t.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)[0]?.name||"";
}

function snapshot(list:TftMatch[]):GoalSnapshot{
  const valid=list.filter(match=>match.placement>=1&&match.placement<=8);
  const sample=valid.length;
  const top4=valid.filter(match=>match.placement<=4);
  const wins=valid.filter(match=>match.placement===1).length;
  const bottom2=valid.filter(match=>match.placement>=7).length;
  const average=sample?valid.reduce((sum,match)=>sum+match.placement,0)/sample:null;
  return {
    sample,
    avgPlacement:average==null?null:round(average,2),
    top4Rate:pct(top4.length,sample),
    bottom2Rate:pct(bottom2,sample),
    winRate:pct(wins,sample),
    conversionRate:pct(wins,top4.length),
    uniqueLines:new Set(valid.map(primaryTrait).filter(Boolean)).size,
  };
}

function signed(value:number,suffix=""){
  const rounded=round(value,1);
  return (rounded>0?"+":"")+rounded+suffix;
}

function historyAll():Record<string,GoalHistoryRecord[]>{
  try{
    const raw=localStorage.getItem(HISTORY_KEY);
    if(!raw)return {};
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{
    return {};
  }
}

function writeHistory(data:Record<string,GoalHistoryRecord[]>){
  localStorage.setItem(HISTORY_KEY,JSON.stringify(data));
}

export function suggestGoal(playerKey:string,matches:TftMatch[]):ChibiGoal{
  const leaks=buildLeakMap(matches);
  const session=buildSessionCoach(matches);
  let type:GoalType="stabilize";
  let title="Estabilizar a próxima sessão";
  let description="Buscar colocação média de 4,5 ou melhor nas próximas 5 partidas.";

  if(leaks.primary?.id==="bottom2"){
    type="protect-floor";
    title="Proteger o piso";
    description="Terminar no máximo 1 das próximas 5 partidas em 7º/8º.";
  }else if(leaks.primary?.id==="conversion"){
    type="convert-top4";
    title="Converter um Top 4";
    description="Nas próximas 5 partidas, transformar pelo menos um Top 4 em vitória.";
  }else if(leaks.primary?.id==="dominance"||session.focus.toLowerCase().includes("segunda linha")){
    type="diversify";
    title="Abrir uma segunda linha";
    description="Jogar pelo menos 2 identidades principais de board nas próximas 5 partidas.";
  }

  const baselineMatches=matches
    .filter(match=>match.placement>=1&&match.placement<=8)
    .slice(0,5);

  return {
    id:playerKey+":"+Date.now(),
    playerKey,
    type,
    title,
    description,
    createdAt:Date.now(),
    baselineIds:matches.map(match=>match.id),
    baseline:snapshot(baselineMatches),
    targetGames:5,
  };
}

export function goalProgress(goal:ChibiGoal,matches:TftMatch[]){
  const baseline=new Set(goal.baselineIds);
  const newGames=matches
    .filter(match=>!baseline.has(match.id))
    .slice()
    .sort((a,b)=>(Number(a.playedAt)||0)-(Number(b.playedAt)||0))
    .slice(0,goal.targetGames);

  const played=newGames.length;
  let achieved=false;
  let detail="";
  let score=0;

  if(goal.type==="protect-floor"){
    const bottom2=newGames.filter(match=>match.placement>=7).length;
    achieved=played>=goal.targetGames&&bottom2<=1;
    score=played?Math.max(0,100-Math.round(bottom2/Math.max(1,played)*100)):0;
    detail=`${bottom2} Bottom 2 em ${played}/${goal.targetGames} partidas`;
  }else if(goal.type==="convert-top4"){
    const top4=newGames.filter(match=>match.placement<=4).length;
    const wins=newGames.filter(match=>match.placement===1).length;
    achieved=played>=goal.targetGames&&wins>=1;
    score=wins?100:top4?50:0;
    detail=`${wins} vitória(s) · ${top4} Top 4 · ${played}/${goal.targetGames} partidas`;
  }else if(goal.type==="diversify"){
    const lines=new Set(newGames.map(primaryTrait).filter(Boolean));
    achieved=played>=goal.targetGames&&lines.size>=2;
    score=Math.min(100,lines.size*50);
    detail=`${lines.size} linha(s) principal(is) · ${played}/${goal.targetGames} partidas`;
  }else{
    const mean=played?newGames.reduce((sum,match)=>sum+match.placement,0)/played:null;
    achieved=played>=goal.targetGames&&mean!=null&&mean<=4.5;
    score=mean==null?0:Math.max(0,Math.min(100,Math.round((8.5-mean)/4*100)));
    detail=`Média ${mean==null?"—":mean.toFixed(2)} · ${played}/${goal.targetGames} partidas`;
  }

  return {
    played,
    achieved,
    detail,
    score,
    finished:played>=goal.targetGames,
    matchIds:newGames.map(match=>match.id),
  };
}


export function goalOutcome(goal:ChibiGoal,matches:TftMatch[]):GoalOutcome|null{
  const progress=goalProgress(goal,matches);
  if(!progress.finished)return null;

  const afterMatches=progress.matchIds
    .map(id=>matches.find(match=>match.id===id))
    .filter((match):match is TftMatch=>Boolean(match));
  const baselineMatches=goal.baselineIds
    .map(id=>matches.find(match=>match.id===id))
    .filter((match):match is TftMatch=>Boolean(match))
    .slice(0,5);

  const before=goal.baseline||snapshot(baselineMatches);
  const after=snapshot(afterMatches);

  const avgBefore=before.avgPlacement;
  const avgAfter=after.avgPlacement;
  const avgImprovement=avgBefore!=null&&avgAfter!=null?avgBefore-avgAfter:0;

  let metricLabel="Colocação média";
  let metricBefore=avgBefore==null?"—":avgBefore.toFixed(2);
  let metricAfter=avgAfter==null?"—":avgAfter.toFixed(2);
  let metricDirection=avgImprovement;
  let metricDelta=avgBefore!=null&&avgAfter!=null?signed(avgAfter-avgBefore):"—";

  if(goal.type==="protect-floor"){
    metricLabel="Bottom 2";
    metricBefore=before.bottom2Rate+"%";
    metricAfter=after.bottom2Rate+"%";
    metricDirection=before.bottom2Rate-after.bottom2Rate;
    metricDelta=signed(after.bottom2Rate-before.bottom2Rate,"%");
  }else if(goal.type==="convert-top4"){
    metricLabel="Conversão Top 4 → 1º";
    metricBefore=before.conversionRate+"%";
    metricAfter=after.conversionRate+"%";
    metricDirection=after.conversionRate-before.conversionRate;
    metricDelta=signed(after.conversionRate-before.conversionRate,"%");
  }else if(goal.type==="diversify"){
    metricLabel="Linhas principais";
    metricBefore=String(before.uniqueLines);
    metricAfter=String(after.uniqueLines);
    metricDirection=after.uniqueLines-before.uniqueLines;
    metricDelta=signed(after.uniqueLines-before.uniqueLines);
  }

  let verdict:GoalOutcome["verdict"]="unchanged";
  if(progress.achieved&&metricDirection>0)verdict="improved";
  else if(progress.achieved)verdict="mixed";
  else if(metricDirection>0||avgImprovement>=.35)verdict="mixed";
  else if(metricDirection<0||avgImprovement<=-.5)verdict="worse";

  const title=verdict==="improved"
    ?"O experimento mostrou melhora nesta amostra"
    :verdict==="mixed"
      ?"O resultado foi misto"
      :verdict==="worse"
        ?"Esta amostra piorou no foco testado"
        :"Não apareceu mudança clara";

  const summary=goal.type==="protect-floor"
    ? `Bottom 2 foi de ${before.bottom2Rate}% para ${after.bottom2Rate}%. A colocação média foi de ${metricValue(before.avgPlacement)} para ${metricValue(after.avgPlacement)}.`
    :goal.type==="convert-top4"
      ? `Conversão de Top 4 em vitória foi de ${before.conversionRate}% para ${after.conversionRate}%. Top 4 geral foi de ${before.top4Rate}% para ${after.top4Rate}%.`
      :goal.type==="diversify"
        ? `Você saiu de ${before.uniqueLines} para ${after.uniqueLines} linha(s) principal(is) na amostra comparada. A colocação média foi de ${metricValue(before.avgPlacement)} para ${metricValue(after.avgPlacement)}.`
        : `A colocação média foi de ${metricValue(before.avgPlacement)} para ${metricValue(after.avgPlacement)}, com Top 4 de ${before.top4Rate}% para ${after.top4Rate}%.`;

  const nextFocus=verdict==="improved"
    ?"Repita o foco em outra sessão antes de tratá-lo como padrão estável."
    :verdict==="worse"
      ?"Não aumente a intervenção ainda. Revise as cinco partidas e procure qual variável mudou junto com o foco."
      :"Mantenha apenas uma variável de teste e colete outra sessão comparável antes de tirar uma conclusão.";

  return {
    verdict,
    title,
    summary,
    nextFocus,
    before,
    after,
    metricLabel,
    metricBefore,
    metricAfter,
    metricDelta,
    matchIds:progress.matchIds,
    achieved:progress.achieved,
  };
}

function metricValue(value:number|null){
  return value==null?"—":value.toFixed(2);
}

export function completeGoal(playerKey:string,matches:TftMatch[]){
  const goal=getGoal(playerKey);
  if(!goal)return null;
  const outcome=goalOutcome(goal,matches);
  if(!outcome)return null;

  const record:GoalHistoryRecord={
    id:goal.id,
    playerKey,
    title:goal.title,
    type:goal.type,
    createdAt:goal.createdAt,
    completedAt:Date.now(),
    outcome,
  };

  const all=historyAll();
  all[playerKey]=[record,...(all[playerKey]||[]).filter(item=>item.id!==record.id)].slice(0,8);
  writeHistory(all);
  clearGoal(playerKey);
  return record;
}

export function getGoalHistory(playerKey:string){
  return historyAll()[playerKey]||[];
}
