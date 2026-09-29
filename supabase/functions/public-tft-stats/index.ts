import { corsHeaders, json } from "../_shared/http.ts";
import { num } from "../_shared/riot.ts";

type EntityType="champions"|"traits"|"items";

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

function round(value:number,digits=2){
  const p=Math.pow(10,digits);
  return Math.round(value*p)/p;
}

function activeTraitIds(row:any){
  return (Array.isArray(row?.traits)?row.traits:[])
    .filter((trait:any)=>num(trait?.numUnits)>0&&(num(trait?.style)>0||num(trait?.numUnits)>=2))
    .map((trait:any)=>String(trait?.name||""))
    .filter(Boolean);
}

function entityIds(row:any,type:EntityType){
  if(type==="traits"){
    return [...new Set(activeTraitIds(row))];
  }

  if(type==="champions"){
    return [...new Set(
      (Array.isArray(row?.units)?row.units:[])
        .map((unit:any)=>String(unit?.characterId||""))
        .filter(Boolean)
    )];
  }

  const items:string[]=[];
  for(const unit of Array.isArray(row?.units)?row.units:[]){
    for(const item of Array.isArray(unit?.itemNames)?unit.itemNames:[]){
      const id=String(item||"");
      if(id) items.push(id);
    }
  }
  return [...new Set(items)];
}

function aggregate(rows:any[],type:EntityType,minGames:number,limit:number){
  const map=new Map<string,{
    games:number;
    placements:number[];
    levels:number[];
    top4:number;
    wins:number;
  }>();

  for(const row of rows){
    const placement=num(row?.placement);
    if(placement<1||placement>8) continue;

    for(const id of entityIds(row,type)){
      const current=map.get(id)||{
        games:0,
        placements:[],
        levels:[],
        top4:0,
        wins:0,
      };
      current.games++;
      current.placements.push(placement);
      current.levels.push(num(row?.level));
      if(placement<=4) current.top4++;
      if(placement===1) current.wins++;
      map.set(id,current);
    }
  }

  return [...map.entries()]
    .filter(([,value])=>value.games>=minGames)
    .map(([id,value])=>({
      id,
      games:value.games,
      averagePlacement:round(value.placements.reduce((a,b)=>a+b,0)/value.games,2),
      top4Rate:round(value.top4/value.games*100,1),
      winRate:round(value.wins/value.games*100,1),
      pickRate:round(value.games/Math.max(1,rows.length)*100,1),
      averageLevel:round(value.levels.reduce((a,b)=>a+b,0)/Math.max(1,value.levels.length),2),
    }))
    .sort((a,b)=>{
      const scoreA=(8.5-a.averagePlacement)*.48+a.top4Rate*.025+Math.min(30,a.games)*.04;
      const scoreB=(8.5-b.averagePlacement)*.48+b.top4Rate*.025+Math.min(30,b.games)*.04;
      return scoreB-scoreA||b.games-a.games;
    })
    .slice(0,limit);
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);

  const supabaseUrl=env("SUPABASE_URL");
  const serviceRole=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!serviceRole){
    return json({error:"stats_backend_not_configured"},503);
  }

  let body:any={};
  try{body=await req.json();}catch{}

  let setNumber=Math.max(0,num(body?.setNumber));
  const queueId=Math.max(0,num(body?.queueId));
  const minGames=Math.max(1,Math.min(100,num(body?.minGames)||2));
  const limit=Math.max(1,Math.min(250,num(body?.limit)||100));

  if(!setNumber){
    const latestRes=await fetch(
      supabaseUrl+"/rest/v1/tft_participant_observations?select=set_number,played_at&set_number=gt.0&order=played_at.desc&limit=1",
      {headers:serviceHeaders()},
    );
    if(latestRes.ok){
      const latestRows=await latestRes.json();
      setNumber=Math.max(0,num(latestRows?.[0]?.set_number));
    }
  }

  if(!setNumber){
    return json({
      context:{setNumber:0,queueId:queueId||null,minGames},
      sampleParticipants:0,
      champions:[],
      traits:[],
      items:[],
    });
  }

  const filters=[
    "set_number=eq."+encodeURIComponent(setNumber),
    queueId?"queue_id=eq."+encodeURIComponent(queueId):"",
  ].filter(Boolean);

  const url=
    supabaseUrl+
    "/rest/v1/tft_participant_observations?select=placement,level,traits,units&"+
    filters.join("&")+
    "&limit=5000";

  const response=await fetch(url,{headers:serviceHeaders()});
  if(!response.ok){
    return json({error:"stats_query_failed",status:response.status},502);
  }

  const rows=await response.json();
  const safeRows=Array.isArray(rows)?rows:[];

  return json({
    context:{setNumber,queueId:queueId||null,minGames},
    sampleParticipants:safeRows.length,
    champions:aggregate(safeRows,"champions",minGames,limit),
    traits:aggregate(safeRows,"traits",minGames,limit),
    items:aggregate(safeRows,"items",minGames,limit),
  });
});
