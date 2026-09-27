export type JournalTag =
  | "forced"
  | "early-roll"
  | "weak-opener"
  | "awkward-items"
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
  {id:"good-scout",label:"Boa leitura do lobby",help:"Você sentiu que scout/contest ajudou suas decisões."},
  {id:"pivoted",label:"Fiz pivot",help:"Você mudou de plano de forma relevante durante a partida."},
];
