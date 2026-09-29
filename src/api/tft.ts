import { supabase } from "../supabase";

export type TftTrait = {
  name: string;
  numUnits: number;
  style: number;
  tierCurrent?: number;
  tierTotal?: number;
};

export type TftCompanion = {
  contentId:string;
  itemId:string;
  skinId:string;
  species:string;
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
  companion?: TftCompanion|null;
  augments: string[];
  traits: TftTrait[];
  units: TftUnit[];
};

export type TftProfile = {
  player: { gameName:string; tagLine:string; platform:string; level:number; profileIconId:number };
  ranked: Array<{ queueType:string; tier:string; rank:string; leaguePoints:number; wins:number; losses:number }>;
  summary: { matches:number; averagePlacement:number|null; top4Rate:number; winRate:number; firsts:number; eighths:number };
  matches: TftMatch[];
  partial?: { summoner:boolean; ranked:boolean; history:boolean };
  source?: {
    account:"account-v1";
    summoner:"tft-summoner-v1";
    ranked:"tft-league-v1";
    matches:"tft-match-v1";
    retrievedAt:number;
    cache?:{hits:number;fetched:number};
  };
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

export type TftGlobalComp = {
  id:string;
  games:number;
  averagePlacement:number;
  top4Rate:number;
  winRate:number;
  volatility:number;
  averageLevel:number;
  averageGold:number;
  confidence:"alta"|"média"|"inicial";
  traits:Array<{id:string;rate:number}>;
  units:Array<{id:string;rate:number}>;
  items:Array<{id:string;rate:number}>;
  unitItems:Array<{unitId:string;items:Array<{id:string;rate:number}>}>;
};

export type TftGlobalComps = {
  context:{
    setNumber:number;
    queueId:number|null;
    minGames:number;
    signatureMode?:"adaptive-traits-v2";
    signatureThreshold?:number;
  };
  sampleParticipants:number;
  comps:TftGlobalComp[];
};

export type TftGlobalEntityStat = {
  id:string;
  games:number;
  averagePlacement:number;
  top4Rate:number;
  winRate:number;
  pickRate:number;
  averageLevel:number;
};

export type TftGlobalStats = {
  context:{setNumber:number;queueId:number|null;minGames:number};
  sampleParticipants:number;
  champions:TftGlobalEntityStat[];
  traits:TftGlobalEntityStat[];
  items:TftGlobalEntityStat[];
};


export type TftServiceStatus = {
  platform:string;
  id:string;
  name:string;
  locales:string[];
  maintenances:Array<{
    id:string;
    maintenanceStatus:string;
    incidentSeverity:string;
    titles:unknown[];
    updates:unknown[];
    createdAt:string;
    updatedAt:string;
    archiveAt:string;
  }>;
  incidents:Array<{
    id:string;
    maintenanceStatus:string;
    incidentSeverity:string;
    titles:unknown[];
    updates:unknown[];
    createdAt:string;
    updatedAt:string;
    archiveAt:string;
  }>;
  operational:boolean;
  checkedAt:number;
  source:"tft-status-v1";
};

export type TftLeaderboardPlayer = {
  gameName:string;
  tagLine:string;
  summonerId:string;
  leaguePoints:number;
  wins:number;
  losses:number;
  games:number;
  winRate:number;
  level:number;
  profileIconId:number;
  hotStreak:boolean;
  veteran:boolean;
  freshBlood:boolean;
};

export type TftLeaderboard = {
  platform:string;
  tier:"challenger"|"grandmaster"|"master";
  name:string;
  players:TftLeaderboardPlayer[];
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
      lastRound?: number;
      timeEliminated?: number;
      damageToPlayers: number;
      playersEliminated: number;
      companion?: TftCompanion|null;
      augments: string[];
      traits: TftTrait[];
      units: TftUnit[];
    }>;
  };
  source?: {
    match:"tft-match-v1";
    retrievedAt:number;
    cache?:"hit"|"miss";
  };
};

async function invoke<T>(name:string, body:Record<string,unknown>):Promise<T>{
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    const context=(error as {context?:unknown})?.context;
    if(context instanceof Response){
      try{
        const detail=await context.clone().json();
        if(detail?.message) throw new Error(String(detail.message));
        if(detail?.error) throw new Error(String(detail.error));
      }catch(parsed){
        if(parsed instanceof Error && parsed.message!==error.message) throw parsed;
      }
    }

    throw new Error(error.message || "Falha ao consultar os dados oficiais da Riot.");
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


export function fetchTftComps(setNumber:number,queueId?:number|null,minGames=3,limit=16){
  return invoke<TftGlobalComps>("public-tft-comps",{
    setNumber,
    queueId:queueId||0,
    minGames,
    limit,
  });
}


export function fetchTftStats(setNumber:number,queueId?:number|null,minGames=2,limit=120){
  return invoke<TftGlobalStats>("public-tft-stats",{
    setNumber,
    queueId:queueId||0,
    minGames,
    limit,
  });
}


export function fetchTftLeaderboard(
  platform:string,
  tier:"challenger"|"grandmaster"|"master"="challenger",
  limit=20,
){
  return invoke<TftLeaderboard>("public-tft-leaderboard",{
    platform,
    tier,
    limit,
  });
}


export function fetchTftStatus(platform:string){
  return invoke<TftServiceStatus>("public-tft-status",{ platform });
}
