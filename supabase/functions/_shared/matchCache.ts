import { normalizeParticipant, num } from "./riot.ts";

function env(name:string){
  return Deno.env.get(name)||"";
}

function serviceHeaders(){
  const key=env("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey:key,
    Authorization:"Bearer "+key,
    "Content-Type":"application/json",
  };
}

export function normalizeMatchForCache(match:any){
  const info=match?.info||{};
  const id=String(match?.metadata?.match_id||"");
  if(!id)return null;

  return {
    cacheVersion:2,
    id,
    playedAt:num(info?.game_datetime),
    duration:num(info?.game_length),
    gameVersion:String(info?.game_version||""),
    queueId:num(info?.queue_id),
    setNumber:num(info?.tft_set_number),
    setName:String(info?.tft_set_core_name||""),
    participants:(Array.isArray(info?.participants)?info.participants:[]).map((participant:any)=>({
      puuid:String(participant?.puuid||""),
      ...normalizeParticipant(participant),
    })),
  };
}

export async function readCachedMatches(matchIds:string[]){
  const supabaseUrl=env("SUPABASE_URL");
  const serviceRole=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!serviceRole||!matchIds.length)return new Map<string,any>();

  const safeIds=[...new Set(matchIds.map(id=>String(id||"").trim()).filter(id=>/^[A-Za-z0-9_-]+$/.test(id)))];
  if(!safeIds.length)return new Map<string,any>();

  try{
    const filter=encodeURIComponent("("+safeIds.join(",")+")");
    const response=await fetch(
      supabaseUrl+"/rest/v1/tft_match_cache?select=match_id,payload&match_id=in."+filter,
      {headers:serviceHeaders()},
    );
    if(!response.ok)return new Map<string,any>();

    const rows=await response.json();
    return new Map(
      (Array.isArray(rows)?rows:[])
        .map((row:any)=>[String(row?.match_id||""),row?.payload] as const)
        .filter(([id,payload])=>Boolean(id&&payload&&Number(payload?.cacheVersion)===2))
    );
  }catch{
    return new Map<string,any>();
  }
}

export async function writeCachedMatches(matches:any[],region:string){
  const supabaseUrl=env("SUPABASE_URL");
  const serviceRole=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!serviceRole||!matches.length)return;

  const rows=matches
    .map(normalizeMatchForCache)
    .filter(Boolean)
    .map((payload:any)=>({
      match_id:payload.id,
      region,
      played_at:payload.playedAt||null,
      queue_id:payload.queueId||null,
      set_number:payload.setNumber||null,
      game_version:payload.gameVersion||null,
      payload,
      updated_at:new Date().toISOString(),
    }));

  if(!rows.length)return;

  try{
    await fetch(
      supabaseUrl+"/rest/v1/tft_match_cache?on_conflict=match_id",
      {
        method:"POST",
        headers:{
          ...serviceHeaders(),
          Prefer:"resolution=merge-duplicates,return=minimal",
        },
        body:JSON.stringify(rows),
      },
    );
  }catch{
    // Cache is best-effort and must never break Riot lookups.
  }
}

export async function getOrFetchMatches(
  matchIds:string[],
  regionalBase:string,
  headers:Record<string,string>,
  region:string,
){
  const cache=await readCachedMatches(matchIds);
  const missing=matchIds.filter(id=>!cache.has(id));

  // Developer Riot keys have strict request budgets. A burst of 20 calls at
  // once can exhaust the shared quota even if the initial account lookup worked.
  // Keep the input order stable while limiting active upstream lookups to four.
  const MAX_PARALLEL_RIOT_MATCHES=4;
  const fetchedRaw:Array<any|null>=new Array(missing.length).fill(null);
  let cursor=0;
  let rateLimited=false;
  const workers=Array.from({length:Math.min(MAX_PARALLEL_RIOT_MATCHES,missing.length)},async()=>{
    while(!rateLimited){
      const index=cursor++;
      if(index>=missing.length)return;
      try{
        const response=await fetch(
          regionalBase+"/tft/match/v1/matches/"+encodeURIComponent(missing[index]),
          {headers,signal:AbortSignal.timeout(8000)},
        );
        if(response.status===429){
          rateLimited=true;
          return;
        }
        if(response.ok)fetchedRaw[index]=await response.json();
      }catch{
        // A missing detail cannot stop already cached history from rendering.
      }
    }
  });
  await Promise.all(workers);

  const freshRaw=fetchedRaw.filter(Boolean);
  if(freshRaw.length)await writeCachedMatches(freshRaw,region);

  const freshNormalized=new Map<string,any>();
  for(const raw of freshRaw){
    const normalized=normalizeMatchForCache(raw);
    if(normalized?.id)freshNormalized.set(normalized.id,normalized);
  }

  return {
    matches:matchIds
      .map(id=>cache.get(id)||freshNormalized.get(id)||null)
      .filter(Boolean),
    rawFetched:freshRaw,
    cacheHits:matchIds.filter(id=>cache.has(id)).length,
    fetched:freshRaw.length,
    failed:missing.length-freshRaw.length,
    rateLimited,
  };
}
