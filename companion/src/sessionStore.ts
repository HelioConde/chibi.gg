import { OverlayFrame } from "./live/types";

export type SessionMarker={
  id:string;
  createdAt:number;
  frameId:string;
  stage:string|null;
  hp:number|null;
  gold:number|null;
  level:number|null;
  boardStatus:string;
  action:string;
  problem:string;
};

const KEY="chibi-companion:session-markers:v1";

export function getSessionMarkers():SessionMarker[]{
  try{
    const raw=localStorage.getItem(KEY);
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

export function addSessionMarker(frame:OverlayFrame){
  const marker:SessionMarker={
    id:crypto.randomUUID(),
    createdAt:Date.now(),
    frameId:frame.id,
    stage:frame.snapshot.stage??null,
    hp:frame.snapshot.hp??null,
    gold:frame.snapshot.gold??null,
    level:frame.snapshot.level??null,
    boardStatus:frame.decision.boardStatus,
    action:frame.decision.actions[0]||frame.decision.title,
    problem:frame.decision.mainProblem,
  };

  const next=[marker,...getSessionMarkers()].slice(0,50);
  localStorage.setItem(KEY,JSON.stringify(next));
  return next;
}

export function clearSessionMarkers(){
  localStorage.removeItem(KEY);
  return [];
}
