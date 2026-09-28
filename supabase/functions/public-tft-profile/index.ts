import { corsHeaders, json } from "../_shared/http.ts";
import {
  supportedPlatforms,
  regionFor,
  num,
  normalizeParticipant,
} from "../_shared/riot.ts";
import { observeRawMatches } from "../_shared/observations.ts";

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
          message:"A chave da Riot usada pelo Chibi expirou ou foi rejeitada. Atualize RIOT_API_KEY no Supabase.",
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
          "/ids?start=0&count=12",
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
        message:"A chave da Riot usada pelo Chibi expirou ou foi rejeitada. Atualize RIOT_API_KEY no Supabase.",
      },503);
    }

    if(summonerRes&&!summonerRes.ok) logUpstream("summoner",summonerRes.status);
    if(leagueRes&&!leagueRes.ok) logUpstream("league",leagueRes.status);
    if(idsRes&&!idsRes.ok) logUpstream("match ids",idsRes.status);

    const summoner=summonerRes?.ok?await summonerRes.json():{};
    const rankedRaw=leagueRes?.ok?await leagueRes.json():[];
    const matchIds=idsRes?.ok?await idsRes.json():[];

    const matchDetails=await Promise.all(
      (Array.isArray(matchIds)?matchIds:[])
        .slice(0,12)
        .map(async(matchId:string)=>{
          const res=await safeFetch(
            regionalBase+"/tft/match/v1/matches/"+encodeURIComponent(matchId),
            headers,
          );

          if(!res) return null;

          if(isAuthFailure(res.status)){
            logUpstream("match detail",res.status);
            return null;
          }

          if(!res.ok){
            if(res.status!==429) logUpstream("match detail",res.status);
            return null;
          }

          try{
            return await res.json();
          }catch{
            return null;
          }
        }),
    );

    // Dataset collection must never block the player lookup.
    try{
      await observeRawMatches(matchDetails.filter(Boolean));
    }catch(error){
      console.error(
        "[public-tft-profile] observation failed",
        error instanceof Error?error.message:String(error),
      );
    }

    const matches=matchDetails.map((match:any)=>{
      if(!match) return null;

      const info=match?.info||{};
      const me=(info?.participants||[]).find((participant:any)=>participant?.puuid===puuid);
      if(!me) return null;

      const normalized=normalizeParticipant(me);

      return {
        id:String(match?.metadata?.match_id||""),
        playedAt:num(info?.game_datetime),
        duration:num(info?.game_length),
        gameVersion:String(info?.game_version||""),
        queueId:num(info?.queue_id),
        setNumber:num(info?.tft_set_number),
        setName:String(info?.tft_set_core_name||""),
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
      partial:{
        summoner:!summonerRes?.ok,
        ranked:!leagueRes?.ok,
        history:!idsRes?.ok,
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
