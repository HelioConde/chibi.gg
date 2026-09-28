import { corsHeaders, json } from "../_shared/http.ts";
import {
  num,
  regionFor,
  riotHeaders,
  supportedPlatforms,
} from "../_shared/riot.ts";

type Tier="challenger"|"grandmaster"|"master";

function env(name:string){
  return Deno.env.get(name)||"";
}

async function resolveEntry(
  apiKey:string,
  platform:string,
  region:string,
  row:any,
){
  const fallbackName=String(row?.summonerName||"");
  const summonerId=String(row?.summonerId||"");

  let puuid="";
  let level=0;
  let profileIconId=0;

  if(summonerId){
    const summonerRes=await fetch(
      "https://"+platform+".api.riotgames.com/tft/summoner/v1/summoners/"+encodeURIComponent(summonerId),
      {headers:riotHeaders(apiKey)},
    );
    if(summonerRes.ok){
      const summoner=await summonerRes.json();
      puuid=String(summoner?.puuid||"");
      level=num(summoner?.summonerLevel);
      profileIconId=num(summoner?.profileIconId);
    }
  }

  let gameName=fallbackName;
  let tagLine="";

  if(puuid){
    const accountRes=await fetch(
      "https://"+region+".api.riotgames.com/riot/account/v1/accounts/by-puuid/"+encodeURIComponent(puuid),
      {headers:riotHeaders(apiKey)},
    );
    if(accountRes.ok){
      const account=await accountRes.json();
      gameName=String(account?.gameName||gameName);
      tagLine=String(account?.tagLine||"");
    }
  }

  const wins=num(row?.wins);
  const losses=num(row?.losses);
  const games=wins+losses;

  return {
    gameName:gameName||"Jogador",
    tagLine,
    summonerId,
    leaguePoints:num(row?.leaguePoints),
    wins,
    losses,
    games,
    winRate:games?Math.round(wins/games*1000)/10:0,
    level,
    profileIconId,
    hotStreak:Boolean(row?.hotStreak),
    veteran:Boolean(row?.veteran),
    freshBlood:Boolean(row?.freshBlood),
  };
}

async function mapLimited<T,U>(
  rows:T[],
  limit:number,
  mapper:(row:T,index:number)=>Promise<U>,
){
  const result:U[]=[];
  for(let start=0;start<rows.length;start+=limit){
    const chunk=rows.slice(start,start+limit);
    const mapped=await Promise.all(chunk.map((row,index)=>mapper(row,start+index)));
    result.push(...mapped);
  }
  return result;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);

  const apiKey=env("RIOT_API_KEY");
  if(!apiKey) return json({error:"riot_api_key_missing"},503);

  let body:any={};
  try{body=await req.json();}catch{}

  const platform=String(body?.platform||"br1").toLowerCase();
  const tierRaw=String(body?.tier||"challenger").toLowerCase();
  const tier:Tier=tierRaw==="master"?"master":tierRaw==="grandmaster"?"grandmaster":"challenger";
  const limit=Math.max(5,Math.min(30,num(body?.limit)||20));

  if(!supportedPlatforms.has(platform)){
    return json({error:"unsupported_platform"},400);
  }

  const url=
    "https://"+platform+".api.riotgames.com/tft/league/v1/"+tier+
    "?queue=RANKED_TFT";

  const response=await fetch(url,{headers:riotHeaders(apiKey)});
  if(!response.ok){
    return json({error:"leaderboard_fetch_failed",status:response.status},response.status);
  }

  const league=await response.json();
  const entries=(Array.isArray(league?.entries)?league.entries:[])
    .slice()
    .sort((a:any,b:any)=>num(b?.leaguePoints)-num(a?.leaguePoints))
    .slice(0,limit);

  const region=regionFor(platform);
  const players=await mapLimited(entries,5,(row)=>resolveEntry(apiKey,platform,region,row));

  return json({
    platform,
    tier,
    name:String(league?.name||""),
    players,
  });
});
