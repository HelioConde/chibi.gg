import { TftMatch } from "./api/tft";

export type JournalTag =
  | "forced"
  | "early-roll"
  | "weak-opener"
  | "awkward-items"
  | "greeded-items"
  | "late-roll"
  | "missed-scout"
  | "bad-position"
  | "good-scout"
  | "pivoted";

export type MatchJournalEntry={
  matchId:string;
  tags:JournalTag[];
  note:string;
  updatedAt:number;
};

const STORAGE_KEY="chibi.gg:tft-journal:v1";

function readAll():Record<string,MatchJournalEntry>{
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return {};
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{
    return {};
  }
}

function writeAll(entries:Record<string,MatchJournalEntry>){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(entries));
}

export function getJournalEntry(matchId:string):MatchJournalEntry{
  return readAll()[matchId]||{matchId,tags:[],note:"",updatedAt:0};
}

export function saveJournalEntry(entry:MatchJournalEntry){
  const all=readAll();
  all[entry.matchId]={...entry,updatedAt:Date.now()};
  writeAll(all);
}

export function getJournalEntries(matchIds?:string[]){
  const all=readAll();
  if(!matchIds) return Object.values(all);
  const allowed=new Set(matchIds);
  return Object.values(all).filter(entry=>allowed.has(entry.matchId));
}

export const JOURNAL_TAGS:Array<{id:JournalTag;label:string;help:string}>=[
  {id:"forced",label:"Forcei uma linha",help:"Você entrou decidido a jogar uma linha específica."},
  {id:"early-roll",label:"Rolei cedo",help:"Você sentiu que gastou ouro antes do timing ideal."},
  {id:"weak-opener",label:"Opener fraco",help:"O começo da partida pareceu abaixo do esperado."},
  {id:"awkward-items",label:"Itens desconfortáveis",help:"Os componentes/itens limitaram suas opções."},
  {id:"greeded-items",label:"Segurei componentes",help:"Você adiou um slam esperando uma combinação melhor."},
  {id:"late-roll",label:"Rolei tarde",help:"Você sentiu que demorou demais para converter ouro em força."},
  {id:"missed-scout",label:"Não scoutei",help:"Você percebeu tarde contestação, posicionamento ou direção da lobby."},
  {id:"bad-position",label:"Posicionamento ruim",help:"Você acredita que o posicionamento final custou combates importantes."},
  {id:"good-scout",label:"Boa leitura do lobby",help:"Você sentiu que scout/contest ajudou suas decisões."},
  {id:"pivoted",label:"Fiz pivot",help:"Você mudou de plano de forma relevante durante a partida."},
];


export type JournalBehaviorSignal={
  tag:JournalTag;
  label:string;
  mentions:number;
  top4Rate:number;
  bottom4Rate:number;
  averagePlacement:number;
  confidence:"alta"|"média"|"inicial";
  tone:"warning"|"good";
  question:string;
  evidence:string;
  matchIds:string[];
};

const JOURNAL_QUESTIONS:Record<JournalTag,string>={
  "forced":"Antes de fechar uma linha, qual informação real confirma que ela está aberta?",
  "early-roll":"Quando sentir pressão, o que você precisa ver para decidir que vale gastar agora?",
  "weak-opener":"Com opener fraco, você está preservando HP ou perseguindo uma linha que ainda não existe?",
  "awkward-items":"Você consegue jogar o melhor holder disponível em vez de esperar o item perfeito?",
  "greeded-items":"Qual componente você poderia ter transformado em força antes sem destruir suas opções?",
  "late-roll":"Qual sinal mostrava que seu board precisava gastar uma rodada antes?",
  "missed-scout":"Qual informação da lobby teria mudado sua decisão se você tivesse visto uma rodada antes?",
  "bad-position":"Qual unidade adversária você precisava respeitar no posicionamento desta partida?",
  "good-scout":"Em que momento o scout mudou uma decisão sua de verdade?",
  "pivoted":"O pivot aconteceu por um sinal real da partida ou só porque o plano inicial falhou?",
};

export function buildJournalBehaviorSignal(matches:TftMatch[]):JournalBehaviorSignal|null{
  const byId=new Map(matches.map(match=>[match.id,match]));
  const entries=getJournalEntries(matches.map(match=>match.id))
    .filter(entry=>entry.tags.length>0);

  if(!entries.length)return null;

  const journaledMatches=entries
    .map(entry=>byId.get(entry.matchId))
    .filter((match):match is TftMatch=>Boolean(match));

  if(!journaledMatches.length)return null;

  const overallBottom4Rate=Math.round(
    journaledMatches.filter(match=>match.placement>=5).length/journaledMatches.length*100
  );

  const candidates:(typeof JOURNAL_TAGS)[number][]=[];
  for(const meta of JOURNAL_TAGS){
    const mentions=entries.filter(entry=>entry.tags.includes(meta.id)).length;
    if(mentions>=2)candidates.push(meta);
  }

  const rows=candidates.map(meta=>{
    const taggedEntries=entries.filter(entry=>entry.tags.includes(meta.id));
    const taggedMatches=taggedEntries
      .map(entry=>byId.get(entry.matchId))
      .filter((match):match is TftMatch=>Boolean(match));

    const mentions=taggedMatches.length;
    const top4Rate=Math.round(taggedMatches.filter(match=>match.placement<=4).length/mentions*100);
    const bottom4Rate=Math.round(taggedMatches.filter(match=>match.placement>=5).length/mentions*100);
    const averagePlacement=taggedMatches.reduce((sum,match)=>sum+match.placement,0)/mentions;
    const positive=meta.id==="good-scout"||meta.id==="pivoted";
    const tone:"warning"|"good"=positive&&top4Rate>=60?"good":"warning";
    const confidence:"alta"|"média"|"inicial"=
      mentions>=5?"alta":mentions>=3?"média":"inicial";
    const warningStrength=tone==="warning"
      ? Math.max(0,bottom4Rate-overallBottom4Rate)+bottom4Rate+mentions*5
      : top4Rate+mentions*5;

    return {
      tag:meta.id,
      label:meta.label,
      mentions,
      top4Rate,
      bottom4Rate,
      averagePlacement:+averagePlacement.toFixed(2),
      confidence,
      tone,
      question:JOURNAL_QUESTIONS[meta.id],
      evidence:tone==="good"
        ? mentions+" menções · Top 4 "+top4Rate+"% · média "+averagePlacement.toFixed(2)
        : mentions+" menções · Bottom 4 "+bottom4Rate+"% · média "+averagePlacement.toFixed(2),
      matchIds:taggedMatches.map(match=>match.id),
      strength:warningStrength,
    };
  })
    .filter(row=>
      row.tone==="good"
        ? row.top4Rate>=60
        : row.bottom4Rate>=60||row.averagePlacement>=5
    )
    .sort((a,b)=>b.strength-a.strength);

  const best=rows[0];
  if(!best)return null;

  const {strength,...signal}=best;
  void strength;
  return signal;
}
