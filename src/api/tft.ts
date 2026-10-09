// Public TFT functions do not require a signed-in Supabase client.
// Keep the browser's auth SDK out of the landing page bundle.
const PUBLIC_FUNCTIONS_BASE="https://bieihhaobdztjyoweewa.supabase.co/functions/v1/";
const PUBLIC_API_KEY="sb_publishable_2T2H_S0Lu3qlM42kDUWI9g_3FtYXjUt";

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
  hasChibiTelemetry?: boolean;
  chibiTelemetryStatus?: "waiting_riot_match"|"reconciled";
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
  paging?: {start:number;count:number;requested:number;returned:number};
  partial?: { summoner:boolean; ranked:boolean; history:boolean; matchDetails?:boolean };
  source?: {
    account:"account-v1";
    summoner:"tft-summoner-v1";
    ranked:"tft-league-v1";
    matches:"tft-match-v1";
    retrievedAt:number;
    cache?:{hits:number;fetched:number;failed?:number;rateLimited?:boolean};
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
    hasChibiTelemetry?: boolean;
    chibiTelemetryStatus?: "waiting_riot_match"|"reconciled";
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

// Public, non-personal aggregates are safe to share across widgets for a short time.
// Never cache player profiles, match history or match details in memory.
const aggregateTtl:Record<string,number>={
  "public-tft-meta":45_000,
  "public-tft-comps":45_000,
  "public-tft-stats":45_000,
  "public-tft-status":90_000,
  "public-tft-leaderboard":30_000,
};
const aggregateCache=new Map<string,{expires:number,promise:Promise<unknown>}>();
const MAX_AGGREGATE_CACHE=24;

export class RiotApiError extends Error{
  constructor(
    message:string,
    readonly status:number,
    readonly code:string,
    readonly retryAfterSeconds:number|null=null,
  ){
    super(message);
    this.name="RiotApiError";
  }
}

async function requestTft<T>(name:string,body:Record<string,unknown>):Promise<T>{
  if(!/^public-tft-[a-z-]+$/.test(name)){
    throw new RiotApiError("Endpoint não disponível para consultas públicas.",400,"invalid_endpoint");
  }

  let response:Response;
  try{
    response=await fetch(PUBLIC_FUNCTIONS_BASE+name,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        apikey:PUBLIC_API_KEY,
        Authorization:"Bearer "+PUBLIC_API_KEY,
      },
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(15000),
    });
  }catch(error){
    const timeout=error instanceof Error&&(error.name==="TimeoutError"||error.name==="AbortError");
    throw new RiotApiError(
      timeout?"A consulta demorou demais. Tente novamente.":"Não foi possível conectar ao serviço de TFT. Confira sua conexão.",
      0,
      timeout?"network_timeout":"network_unavailable",
    );
  }

  const data:unknown=await response.json().catch(()=>null);
  const payload=data&&typeof data==="object"&&!Array.isArray(data)
    ?data as Record<string,unknown>:null;
  if(!response.ok||!payload||typeof payload.error==="string"){
    const code=typeof payload?.error==="string"?payload.error:response.ok?"invalid_response":"upstream_failed";
    const retryAfter=Number(response.headers.get("retry-after"));
    const wait=Number.isFinite(retryAfter)&&retryAfter>0
      ?Math.min(Math.ceil(retryAfter),3600):null;
    const fallback=response.status===429?"Limite de consultas atingido. Aguarde e tente novamente."
      :response.status>=500?"Serviço de TFT temporariamente indisponível."
      :"Não foi possível consultar os dados oficiais da Riot.";
    throw new RiotApiError(
      typeof payload?.message==="string"&&payload.message?payload.message:fallback,
      response.status,
      code,
      wait,
    );
  }
  return payload as T;
}

function invoke<T>(name:string,body:Record<string,unknown>):Promise<T>{
  const ttl=aggregateTtl[name];
  if(!ttl)return requestTft<T>(name,body);

  const key=name+":"+JSON.stringify(body);
  const now=Date.now();
  const existing=aggregateCache.get(key);
  if(existing&&existing.expires>now)return existing.promise as Promise<T>;
  aggregateCache.delete(key);

  // Clear old entries first, and cap distinct query variations (sets/regions).
  for(const [cacheKey,entry] of aggregateCache){
    if(entry.expires<=now)aggregateCache.delete(cacheKey);
  }
  while(aggregateCache.size>=MAX_AGGREGATE_CACHE){
    const oldest=aggregateCache.keys().next().value;
    if(!oldest)break;
    aggregateCache.delete(oldest);
  }

  const promise=requestTft<T>(name,body);
  aggregateCache.set(key,{expires:now+ttl,promise});
  // Rejections must never be cached: a recovered Riot or Supabase service can
  // immediately be queried again using the existing retry buttons.
  void promise.catch(()=>{
    if(aggregateCache.get(key)?.promise===promise)aggregateCache.delete(key);
  });
  return promise;
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
  return invoke<{ matches:TftMatch[]; paging:{start:number;count:number;requested:number;returned:number}; partial?:{matchDetails:boolean} }>(
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
