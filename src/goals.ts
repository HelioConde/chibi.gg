import { TftMatch } from "./api/tft";
import { buildLeakMap, buildSessionCoach } from "./analysis/chibiProduct";

export type GoalType="protect-floor"|"convert-top4"|"diversify"|"stabilize";

export type ChibiGoal={
  id:string;
  playerKey:string;
  type:GoalType;
  title:string;
  description:string;
  createdAt:number;
  baselineIds:string[];
  targetGames:number;
  completedAt?:number;
};

const KEY="chibi.gg:session-goals:v1";

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

function primaryTrait(match:TftMatch){
  return match.traits
    .filter(t=>t.numUnits>0&&(t.style>0||t.numUnits>=2))
    .sort((a,b)=>b.style-a.style||b.numUnits-a.numUnits)[0]?.name||"";
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

  return {
    id:playerKey+":"+Date.now(),
    playerKey,
    type,
    title,
    description,
    createdAt:Date.now(),
    baselineIds:matches.map(match=>match.id),
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
