import { TftMatch } from "../api/tft";
import { buildChibiDNA } from "./chibiInsights";

export type StyleWindow={
  games:number;
  avgPlacement:number|null;
  flexibility:number;
  stability:number;
  rerollRate:number;
  avgLevel:number|null;
};

export type StyleShift={
  window:number;
  recent:StyleWindow;
  previous:StyleWindow;
  deltas:{
    avgPlacement:number|null;
    flexibility:number;
    stability:number;
    rerollRate:number;
    avgLevel:number|null;
  };
  confidence:"alta"|"média"|"baixa";
};

function avg(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}

function pct(n:number,d:number){
  return d?Math.round(n/d*100):0;
}

function metrics(matches:TftMatch[]):StyleWindow{
  const dna=buildChibiDNA(matches);
  return {
    games:matches.length,
    avgPlacement:dna.avgPlacement,
    flexibility:dna.flexibility,
    stability:dna.stability,
    rerollRate:pct(matches.filter(match=>match.units.some(unit=>unit.tier>=3)).length,matches.length),
    avgLevel:(()=>{
      const value=avg(matches.map(match=>match.level));
      return value==null?null:+value.toFixed(2);
    })(),
  };
}

function delta(a:number|null,b:number|null){
  if(a==null||b==null) return null;
  return +(a-b).toFixed(2);
}

export function buildStyleShift(matches:TftMatch[]):StyleShift|null{
  const valid=matches
    .filter(match=>match.placement>=1&&match.placement<=8)
    .slice()
    .sort((a,b)=>(Number(b.playedAt)||0)-(Number(a.playedAt)||0));

  const window=Math.min(6,Math.floor(valid.length/2));
  if(window<3) return null;

  const recentMatches=valid.slice(0,window);
  const previousMatches=valid.slice(window,window*2);
  const recent=metrics(recentMatches);
  const previous=metrics(previousMatches);

  return {
    window,
    recent,
    previous,
    deltas:{
      avgPlacement:delta(recent.avgPlacement,previous.avgPlacement),
      flexibility:recent.flexibility-previous.flexibility,
      stability:recent.stability-previous.stability,
      rerollRate:recent.rerollRate-previous.rerollRate,
      avgLevel:delta(recent.avgLevel,previous.avgLevel),
    },
    confidence:valid.length>=20?"alta":valid.length>=12?"média":"baixa",
  };
}
