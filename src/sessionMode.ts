import { TftMatch } from "./api/tft";
import { buildActionPlan } from "./analysis/actionPlan";
import { goalProgress, GoalType, suggestGoal } from "./goals";
import { buildJournalBehaviorSignal } from "./journal";

export type ChibiSession={
  id:string;
  playerKey:string;
  type:GoalType;
  title:string;
  description:string;
  focusTitle:string;
  focusSteps:string[];
  avoid:string;
  successMetric:string;
  journalPrompt?:string;
  journalSignal?:string;
  journalEvidence?:string;
  createdAt:number;
  baselineIds:string[];
  targetGames:number;
};

export type ChibiSessionRecord={
  id:string;
  playerKey:string;
  title:string;
  type:GoalType;
  endedAt:number;
  achieved:boolean;
  placements:number[];
  average:number|null;
  baselineAverage:number|null;
  delta:number|null;
  detail:string;
  matchIds:string[];
};

const ACTIVE_KEY="chibi.gg:session-mode:active:v1";
const HISTORY_KEY="chibi.gg:session-mode:history:v1";

function notifySessionChange(){
  window.dispatchEvent(new CustomEvent("chibi:session-change"));
}

function readActiveAll():Record<string,ChibiSession>{
  try{
    const raw=localStorage.getItem(ACTIVE_KEY);
    const parsed=raw?JSON.parse(raw):{};
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{
    return {};
  }
}

function writeActiveAll(data:Record<string,ChibiSession>){
  localStorage.setItem(ACTIVE_KEY,JSON.stringify(data));
}

function readHistoryAll():Record<string,ChibiSessionRecord[]>{
  try{
    const raw=localStorage.getItem(HISTORY_KEY);
    const parsed=raw?JSON.parse(raw):{};
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{
    return {};
  }
}

function writeHistoryAll(data:Record<string,ChibiSessionRecord[]>){
  localStorage.setItem(HISTORY_KEY,JSON.stringify(data));
}

function average(values:number[]){
  if(!values.length)return null;
  return values.reduce((sum,value)=>sum+value,0)/values.length;
}

export function getActiveSession(playerKey:string){
  return readActiveAll()[playerKey]||null;
}

export function startChibiSession(playerKey:string,matches:TftMatch[]){
  const goal=suggestGoal(playerKey,matches);
  const plan=buildActionPlan(matches);
  const journalSignal=buildJournalBehaviorSignal(matches);

  const session:ChibiSession={
    id:playerKey+":"+Date.now(),
    playerKey,
    type:goal.type,
    title:goal.title,
    description:goal.description,
    focusTitle:plan.action.title,
    focusSteps:plan.action.steps.slice(0,3),
    avoid:plan.action.avoid,
    successMetric:plan.success.metric,
    journalPrompt:journalSignal?.question,
    journalSignal:journalSignal?.label,
    journalEvidence:journalSignal?.evidence,
    createdAt:Date.now(),
    baselineIds:matches.map(match=>match.id),
    targetGames:3,
  };

  const all=readActiveAll();
  all[playerKey]=session;
  writeActiveAll(all);
  notifySessionChange();
  return session;
}

export function sessionProgress(session:ChibiSession,matches:TftMatch[]){
  const goalLike={
    id:session.id,
    playerKey:session.playerKey,
    type:session.type,
    title:session.title,
    description:session.description,
    createdAt:session.createdAt,
    baselineIds:session.baselineIds,
    targetGames:session.targetGames,
  };

  const progress=goalProgress(goalLike,matches);
  const currentIds=new Set(progress.matchIds);
  const games=matches
    .filter(match=>currentIds.has(match.id))
    .slice()
    .sort((a,b)=>(Number(a.playedAt)||0)-(Number(b.playedAt)||0));

  const baselineSet=new Set(session.baselineIds);
  const baselineGames=matches
    .filter(match=>baselineSet.has(match.id))
    .slice()
    .sort((a,b)=>(Number(b.playedAt)||0)-(Number(a.playedAt)||0))
    .slice(0,session.targetGames);

  const currentAverage=average(games.map(match=>match.placement));
  const baselineAverage=average(baselineGames.map(match=>match.placement));
  const delta=currentAverage!=null&&baselineAverage!=null
    ? +(currentAverage-baselineAverage).toFixed(2)
    : null;

  return {
    ...progress,
    games,
    placements:games.map(match=>match.placement),
    average:currentAverage==null?null:+currentAverage.toFixed(2),
    baselineAverage:baselineAverage==null?null:+baselineAverage.toFixed(2),
    delta,
  };
}

export function finishChibiSession(playerKey:string,matches:TftMatch[]){
  const all=readActiveAll();
  const session=all[playerKey];
  if(!session)return null;

  const progress=sessionProgress(session,matches);
  const history=readHistoryAll();

  const record:ChibiSessionRecord={
    id:session.id,
    playerKey,
    title:session.title,
    type:session.type,
    endedAt:Date.now(),
    achieved:progress.achieved,
    placements:progress.placements,
    average:progress.average,
    baselineAverage:progress.baselineAverage,
    delta:progress.delta,
    detail:progress.detail,
    matchIds:progress.matchIds,
  };

  const rows=history[playerKey]||[];
  if(!rows.some(item=>item.id===record.id)){
    history[playerKey]=[...rows,record].slice(-12);
    writeHistoryAll(history);
  }

  delete all[playerKey];
  writeActiveAll(all);
  notifySessionChange();
  return record;
}

export function cancelChibiSession(playerKey:string){
  const all=readActiveAll();
  delete all[playerKey];
  writeActiveAll(all);
  notifySessionChange();
}

export function getSessionHistory(playerKey:string){
  return (readHistoryAll()[playerKey]||[]).slice().reverse();
}
