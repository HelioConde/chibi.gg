import { supabase } from "../supabase";

export type TftTrait = {
  name: string;
  numUnits: number;
  style: number;
  tierCurrent?: number;
  tierTotal?: number;
};

export type TftUnit = {
  characterId: string;
  rarity: number;
  tier: number;
  itemNames: string[];
};

export type TftMatch = {
  id: string;
  playedAt?: number;
  duration?: number;
  gameVersion?: string;
  queueId?: number;
  setNumber?: number;
  setName?: string;
  placement: number;
  level: number;
  goldLeft: number;
  lastRound?: number;
  timeEliminated?: number;
  damageToPlayers: number;
  playersEliminated?: number;
  augments: string[];
  traits: TftTrait[];
  units: TftUnit[];
};

export type TftProfile = {
  player: { gameName:string; tagLine:string; platform:string; level:number };
  ranked: Array<{ queueType:string; tier:string; rank:string; leaguePoints:number; wins:number; losses:number }>;
  summary: { matches:number; averagePlacement:number|null; top4Rate:number; winRate:number; firsts:number; eighths:number };
  matches: TftMatch[];
};

export type TftGlobalTraitStat = {
  id:string;
  games:number;
  averagePlacement:number;
  top4Rate:number;
  winRate:number;
  averageLevel:number;
};

export type TftGlobalMeta = {
  context:{setNumber:number;queueId:number|null;minGames:number};
  sampleParticipants:number;
  traits:TftGlobalTraitStat[];
};

export type TftMatchDetail = {
  match: {
    id: string;
    playedAt: number;
    duration: number;
    gameVersion: string;
    queueId: number;
    setNumber: number;
    setName: string;
    participants: Array<{
      placement: number;
      level: number;
      goldLeft: number;
      damageToPlayers: number;
      playersEliminated: number;
      augments: string[];
      traits: TftTrait[];
      units: TftUnit[];
    }>;
  };
};

async function invoke<T>(name:string, body:Record<string,unknown>):Promise<T>{
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    throw new Error(error.message || "Falha ao consultar o backend do chibi.gg.");
  }

  if (data?.error) {
    throw new Error(data.message || data.error);
  }

  return data as T;
}

export function fetchTftProfile(gameName:string, tagLine:string, platform:string){
  return invoke<TftProfile>("public-tft-profile",{ gameName, tagLine, platform });
}

export function fetchTftHistory(
  gameName:string,
  tagLine:string,
  platform:string,
  start:number,
  count=20,
){
  return invoke<{ matches:TftMatch[]; paging:{start:number;count:number;returned:number} }>(
    "public-tft-history",
    { gameName, tagLine, platform, start, count },
  );
}

export function fetchTftMatch(matchId:string){
  return invoke<TftMatchDetail>("public-tft-match",{ matchId });
}


export function fetchTftMeta(setNumber:number,queueId?:number|null,minGames=4,limit=20){
  return invoke<TftGlobalMeta>("public-tft-meta",{
    setNumber,
    queueId:queueId||0,
    minGames,
    limit,
  });
}
