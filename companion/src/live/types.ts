export type OverlayStateId="stable"|"weak"|"contested"|"spike";
export type OverlayTone="good"|"warning"|"danger";
export type OverlayConfidence="low"|"medium"|"high";

export type LiveUnit={
  id:string;
  tier?:number;
  items?:string[];
  hex?:{row:number;column:number}|null;
};

export type LiveSnapshot={
  source:"demo"|"capture"|"manual";
  capturedAt:number;
  stage?:string;
  hp?:number;
  gold?:number;
  level?:number;
  streak?:string;
  board?:LiveUnit[];
  boardStrength?:number;
  contestants?:number;
  upgradePairs?:number;
  frontlineReady?:boolean;
};

export type OverlayDecision={
  state:OverlayStateId;
  tone:OverlayTone;
  confidence:OverlayConfidence;
  boardStatus:string;
  boardScore:number|null;
  title:string;
  actions:string[];
  mainProblem:string;
  secondarySignals:string[];
  nextSpike:string;
};

export type OverlayFrame={
  id:OverlayStateId;
  label:string;
  snapshot:LiveSnapshot;
  decision:OverlayDecision;
};
