import { TftMatch } from "./api/tft";
import { buildChibiDNA } from "./analysis/chibiInsights";
import { buildLeakMap } from "./analysis/chibiProduct";
import { buildChibiArchetype } from "./analysis/chibiArchetype";

export type ChibiMemorySnapshot={
  id:string;
  createdAt:number;
  latestMatchId:string;
  sampleSize:number;
  avgPlacement:number|null;
  top4Rate:number;
  bottom2Rate:number;
  primaryLeakId:string|null;
  primaryLeakTitle:string|null;
  primaryLeakConfidence:"alta"|"média"|"baixa"|null;
  primaryLeakSeverity:number|null;
  archetype:string;
};

export type ChibiMemoryInsight={
  title:string;
  body:string;
  tone:"good"|"warning"|"neutral";
  previous:ChibiMemorySnapshot|null;
  current:ChibiMemorySnapshot;
  recurringCount:number;
};

const PREFIX="chibi.gg:memory:v1:";

function key(playerKey:string){
  return PREFIX+encodeURIComponent(playerKey.toLowerCase());
}

function read(playerKey:string):ChibiMemorySnapshot[]{
  try{
    const raw=localStorage.getItem(key(playerKey));
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function write(playerKey:string,snapshots:ChibiMemorySnapshot[]){
  localStorage.setItem(key(playerKey),JSON.stringify(snapshots.slice(-20)));
}

function latestMatch(matches:TftMatch[]){
  return matches
    .slice()
    .sort((a,b)=>(Number(b.playedAt)||0)-(Number(a.playedAt)||0))[0]||null;
}

export function buildMemorySnapshot(matches:TftMatch[]):ChibiMemorySnapshot|null{
  if(!matches.length) return null;

  const dna=buildChibiDNA(matches);
  const leaks=buildLeakMap(matches);
  const archetype=buildChibiArchetype(matches);
  const latest=latestMatch(matches);
  if(!latest) return null;

  return {
    id:latest.id+":"+matches.length,
    createdAt:Date.now(),
    latestMatchId:latest.id,
    sampleSize:matches.length,
    avgPlacement:dna.avgPlacement,
    top4Rate:dna.top4Rate,
    bottom2Rate:dna.bottom2Rate,
    primaryLeakId:leaks.primary?.id||null,
    primaryLeakTitle:leaks.primary?.title||null,
    primaryLeakConfidence:leaks.primary?.confidence||null,
    primaryLeakSeverity:leaks.primary?.severity??null,
    archetype:archetype.title,
  };
}

export function recordMemorySnapshot(playerKey:string,matches:TftMatch[]){
  const snapshot=buildMemorySnapshot(matches);
  if(!snapshot) return read(playerKey);

  const history=read(playerKey);
  const duplicate=history.some(item=>
    item.latestMatchId===snapshot.latestMatchId &&
    item.sampleSize===snapshot.sampleSize
  );

  if(duplicate) return history;

  const next=[...history,snapshot].slice(-20);
  write(playerKey,next);
  return next;
}

export function getMemoryHistory(playerKey:string){
  return read(playerKey);
}

export function buildMemoryInsight(
  playerKey:string,
  matches:TftMatch[],
):ChibiMemoryInsight|null{
  const current=buildMemorySnapshot(matches);
  if(!current) return null;

  const history=read(playerKey);
  const previous=[...history]
    .reverse()
    .find(item=>item.latestMatchId!==current.latestMatchId)||null;

  const recurringCount=current.primaryLeakId
    ? history
        .slice()
        .reverse()
        .filter(item=>item.primaryLeakId===current.primaryLeakId)
        .slice(0,6)
        .length
    : 0;

  if(!previous){
    return {
      title:"Esta é a sua linha de base",
      body:"O Chibi vai usar esta leitura como referência quando novas partidas entrarem no histórico.",
      tone:"neutral",
      previous:null,
      current,
      recurringCount,
    };
  }

  if(
    current.primaryLeakId &&
    previous.primaryLeakId===current.primaryLeakId &&
    recurringCount>=2
  ){
    return {
      title:(current.primaryLeakTitle||"O mesmo sinal")+" continua aparecendo",
      body:"Esse foco apareceu em leituras consecutivas. Isso aumenta a prioridade de revisar o padrão, mas ainda não prova uma causa específica.",
      tone:"warning",
      previous,
      current,
      recurringCount,
    };
  }

  if(current.primaryLeakId!==previous.primaryLeakId){
    return {
      title:"Seu foco principal mudou",
      body:"Na análise anterior o principal sinal era "+(previous.primaryLeakTitle||"sem sinal dominante")+
        ". Agora é "+(current.primaryLeakTitle||"sem sinal dominante")+".",
      tone:"neutral",
      previous,
      current,
      recurringCount,
    };
  }

  if(current.avgPlacement!=null&&previous.avgPlacement!=null){
    const delta=current.avgPlacement-previous.avgPlacement;
    if(delta<=-.4){
      return {
        title:"Sua colocação média melhorou desde a última leitura",
        body:"A média passou de "+previous.avgPlacement.toFixed(2)+" para "+current.avgPlacement.toFixed(2)+".",
        tone:"good",
        previous,
        current,
        recurringCount,
      };
    }
    if(delta>=.4){
      return {
        title:"Sua colocação média piorou desde a última leitura",
        body:"A média passou de "+previous.avgPlacement.toFixed(2)+" para "+current.avgPlacement.toFixed(2)+".",
        tone:"warning",
        previous,
        current,
        recurringCount,
      };
    }
  }

  const bottomDelta=current.bottom2Rate-previous.bottom2Rate;
  if(Math.abs(bottomDelta)>=10){
    return {
      title:bottomDelta<0?"Seu Bottom 2 caiu":"Seu Bottom 2 subiu",
      body:"Bottom 2 foi de "+previous.bottom2Rate+"% para "+current.bottom2Rate+"% entre as duas leituras.",
      tone:bottomDelta<0?"good":"warning",
      previous,
      current,
      recurringCount,
    };
  }

  return {
    title:"Seu perfil está relativamente estável",
    body:"A última leitura e a atual não mostram uma mudança grande nos indicadores principais.",
    tone:"neutral",
    previous,
    current,
    recurringCount,
  };
}
