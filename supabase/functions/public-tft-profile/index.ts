import { corsHeaders, json } from "../_shared/http.ts";
import {
  supportedPlatforms,
  regionFor,
  num,
  normalizeParticipant,
} from "../_shared/riot.ts";
import { observeRawMatches } from "../_shared/observations.ts";
import { getOrFetchMatches } from "../_shared/matchCache.ts";
import { recordedMatchMarkers, reconcileRecordedMatches } from "../_shared/recordedMatches.ts";

function percent(n:number,total:number){
  return total?Math.round((n/total)*100):0;
}

function riotHeaders(apiKey:string){
  return {"X-Riot-Token":apiKey};
}

function isAuthFailure(status:number){
  return status===401||status===403;
}

function logUpstream(label:string,status:number){
  console.error("[public-tft-profile] "+label+" upstream status="+status);
}

async function safeFetch(url:string,headers:Record<string,string>){
  try{
    return await fetch(url,{
      headers,
      signal:AbortSignal.timeout(8000),
    });
  }catch(error){
    console.error(
      "[public-tft-profile] fetch exception",
      error instanceof Error?error.message:String(error),
    );
    return null;
  }
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);

  try{
    const riotApiKey=Deno.env.get("RIOT_API_KEY");
    if(!riotApiKey){
      console.error("[public-tft-profile] RIOT_API_KEY missing");
      return json({
        error:"riot_api_key_not_configured",
        message:"A integração com a Riot não está configurada no servidor.",
      },503);
    }

    let body:any;
    try{
      body=await req.json();
    }catch{
      return json({error:"invalid_json"},400);
    }

    const gameName=String(body?.gameName||"").trim();
    const tagLine=String(body?.tagLine||"").trim();
    const platform=String(body?.platform||"br1").toLowerCase();

    if(gameName.length>64||tagLine.length>16){
      return json({error:"invalid_riot_id",message:"Riot ID acima do limite permitido."},400);
    }

    if(!gameName||!tagLine){
      return json({
        error:"riot_id_required",
        message:"Use o formato Nome#TAG.",
      },400);
    }

    if(!supportedPlatforms.has(platform)){
      return json({
        error:"unsupported_platform",
        message:"Região não suportada.",
      },400);
    }

    const region=regionFor(platform);
    const headers=riotHeaders(riotApiKey);
    const accountUrl=
      "https://"+region+".api.riotgames.com/riot/account/v1/accounts/by-riot-id/"+
      encodeURIComponent(gameName)+"/"+encodeURIComponent(tagLine);

    const accountRes=await safeFetch(accountUrl,headers);

    if(!accountRes){
      return json({
        error:"riot_unreachable",
        message:"A Riot não respondeu à consulta. Tente novamente em instantes.",
      },502);
    }

    if(!accountRes.ok){
      logUpstream("account",accountRes.status);

      if(accountRes.status===404){
        return json({
          error:"player_not_found",
          message:"Riot ID não encontrado.",
        },404);
      }

      if(accountRes.status===429){
        return json({
          error:"rate_limited",
          message:"Limite da Riot atingido. Tente novamente em instantes.",
        },429);
      }

      if(isAuthFailure(accountRes.status)){
        return json({
          error:"riot_api_key_rejected",
          upstreamStatus:accountRes.status,
          message:"A integração do Chibi com a Riot precisa ser renovada. Tente novamente mais tarde.",
        },503);
      }

      return json({
        error:"account_lookup_failed",
        upstreamStatus:accountRes.status,
        message:"A Riot recusou a consulta do Riot ID.",
      },502);
    }

    const account=await accountRes.json();
    const puuid=String(account?.puuid||"");
    if(!puuid){
      console.error("[public-tft-profile] account response missing puuid");
      return json({
        error:"missing_puuid",
        message:"A Riot respondeu sem o identificador do jogador.",
      },502);
    }

    const platformBase="https://"+platform+".api.riotgames.com";
    const regionalBase="https://"+region+".api.riotgames.com";

    const [summonerRes,leagueRes,idsRes]=await Promise.all([
      safeFetch(
        platformBase+"/tft/summoner/v1/summoners/by-puuid/"+encodeURIComponent(puuid),
        headers,
      ),
      safeFetch(
        platformBase+"/tft/league/v1/by-puuid/"+encodeURIComponent(puuid),
        headers,
      ),
      safeFetch(
        regionalBase+"/tft/match/v1/matches/by-puuid/"+encodeURIComponent(puuid)+
          "/ids?start=0&count=20",
        headers,
      ),
    ]);

    const secondary=[summonerRes,leagueRes,idsRes].filter(Boolean) as Response[];

    if(secondary.some(response=>response.status===429)){
      return json({
        error:"rate_limited",
        message:"Limite da Riot atingido. Tente novamente em instantes.",
      },429);
    }

    const authFailure=secondary.find(response=>isAuthFailure(response.status));
    if(authFailure){
      logUpstream("secondary",authFailure.status);
      return json({
        error:"riot_api_key_rejected",
        upstreamStatus:authFailure.status,
        message:"A integração do Chibi com a Riot precisa ser renovada. Tente novamente mais tarde.",
      },503);
    }

    if(summonerRes&&!summonerRes.ok) logUpstream("summoner",summonerRes.status);
    if(leagueRes&&!leagueRes.ok) logUpstream("league",leagueRes.status);
    if(idsRes&&!idsRes.ok) logUpstream("match ids",idsRes.status);

    const summoner=summonerRes?.ok?await summonerRes.json():{};
    const rankedRaw=leagueRes?.ok?await leagueRes.json():[];
    const matchIds=idsRes?.ok?await idsRes.json():[];

    const requestedIds=(Array.isArray(matchIds)?matchIds:[]).slice(0,20).map(String);
    const detailResult=await getOrFetchMatches(
      requestedIds,
      regionalBase,
      headers,
      region,
    );

    // Fresh Riot responses feed the observed dataset; cached rows were observed when first fetched.
    try{
      await observeRawMatches(detailResult.rawFetched);
    }catch(error){
      console.error(
        "[public-tft-profile] observation failed",
        error instanceof Error?error.message:String(error),
      );
    }

    await reconcileRecordedMatches(detailResult.matches);
    const recordedMarkers=await recordedMatchMarkers(requestedIds);

    const matches=detailResult.matches.map((match:any)=>{
      const me=(Array.isArray(match?.participants)?match.participants:[])
        .find((participant:any)=>participant?.puuid===puuid);
      if(!me)return null;

      const {puuid:_participantPuuid,...normalized}=me;
      return {
        id:String(match?.id||""),
        playedAt:num(match?.playedAt),
        duration:num(match?.duration),
        gameVersion:String(match?.gameVersion||""),
        queueId:num(match?.queueId),
        setNumber:num(match?.setNumber),
        setName:String(match?.setName||""),
        hasChibiTelemetry:recordedMarkers.get(String(match?.id||""))?.hasChibiTelemetry===true,
        chibiTelemetryStatus:recordedMarkers.get(String(match?.id||""))?.chibiTelemetryStatus,
        ...normalized,
      };
    }).filter(Boolean);

    const placements=matches
      .map((match:any)=>match.placement)
      .filter((value:number)=>value>0);

    const averagePlacement=placements.length
      ? Math.round(
          (placements.reduce((sum:number,placement:number)=>sum+placement,0)/
            placements.length)*100,
        )/100
      : null;

    const top4=placements.filter((placement:number)=>placement<=4).length;
    const firsts=placements.filter((placement:number)=>placement===1).length;
    const eighths=placements.filter((placement:number)=>placement===8).length;

    const ranked=(Array.isArray(rankedRaw)?rankedRaw:[rankedRaw])
      .filter(Boolean)
      .map((entry:any)=>({
        queueType:String(entry?.queueType||entry?.queue_type||""),
        tier:String(entry?.tier||""),
        rank:String(entry?.rank||""),
        leaguePoints:num(entry?.leaguePoints??entry?.league_points),
        wins:num(entry?.wins),
        losses:num(entry?.losses),
      }));

    return json({
      player:{
        gameName:String(account?.gameName||gameName),
        tagLine:String(account?.tagLine||tagLine),
        platform:platform.toUpperCase(),
        profileIconId:num(summoner?.profileIconId),
        level:num(summoner?.summonerLevel),
      },
      ranked,
      summary:{
        matches:placements.length,
        averagePlacement,
        top4Rate:percent(top4,placements.length),
        winRate:percent(firsts,placements.length),
        firsts,
        eighths,
      },
      matches,
      paging:{
        start:0,
        count:20,
        requested:requestedIds.length,
        returned:matches.length,
      },
      partial:{
        summoner:!summonerRes?.ok,
        ranked:!leagueRes?.ok,
        history:!idsRes?.ok,
      },
      source:{
        account:"account-v1",
        summoner:"tft-summoner-v1",
        ranked:"tft-league-v1",
        matches:"tft-match-v1",
        retrievedAt:Date.now(),
        cache:{
          hits:detailResult.cacheHits,
          fetched:detailResult.fetched,
        },
      },
    });
  }catch(error){
    console.error(
      "[public-tft-profile] unhandled",
      error instanceof Error?error.stack||error.message:String(error),
    );

    return json({
      error:"profile_unexpected_error",
      message:"Falha inesperada ao consultar a Riot. Tente novamente em instantes.",
    },502);
  }
});
