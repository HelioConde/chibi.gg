import { corsHeaders, json } from "../_shared/http.ts";
import { num } from "../_shared/riot.ts";

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

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);

  const supabaseUrl=env("SUPABASE_URL");
  const serviceRole=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!serviceRole){
    return json({error:"meta_backend_not_configured"},503);
  }

  let body:any={};
  try{ body=await req.json(); }catch{}

  let setNumber=Math.max(0,num(body?.setNumber));
  const queueId=Math.max(0,num(body?.queueId));
  const minGames=Math.max(2,Math.min(100,num(body?.minGames)||4));
  const limit=Math.max(1,Math.min(50,num(body?.limit)||20));

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
      traits:[],
    });
  }

  const filters=[
    "set_number=eq."+encodeURIComponent(setNumber),
    queueId?"queue_id=eq."+encodeURIComponent(queueId):"",
  ].filter(Boolean);

  const statsUrl=
    supabaseUrl+
    "/rest/v1/tft_trait_global_stats?select=set_number,queue_id,trait_id,games,avg_placement,top4_rate,win_rate,avg_level&"+
    filters.join("&")+
    "&games=gte."+encodeURIComponent(minGames)+
    "&order=games.desc,avg_placement.asc&limit="+limit;

  const countUrl=
    supabaseUrl+
    "/rest/v1/tft_participant_observations?select=match_id&"+
    filters.join("&");

  const [statsRes,countRes]=await Promise.all([
    fetch(statsUrl,{headers:serviceHeaders()}),
    fetch(countUrl,{
      method:"HEAD",
      headers:{
        ...serviceHeaders(),
        Prefer:"count=exact",
      },
    }),
  ]);

  if(!statsRes.ok){
    return json({error:"meta_query_failed",status:statsRes.status},502);
  }

  const rows=await statsRes.json();
  const contentRange=countRes.headers.get("content-range")||"";
  const totalPart=contentRange.split("/")[1]||"0";
  const sampleParticipants=Number(totalPart)||0;

  return json({
    context:{setNumber,queueId:queueId||null,minGames},
    sampleParticipants,
    traits:(Array.isArray(rows)?rows:[]).map((row:any)=>({
      id:String(row?.trait_id||""),
      games:num(row?.games),
      averagePlacement:num(row?.avg_placement),
      top4Rate:num(row?.top4_rate),
      winRate:num(row?.win_rate),
      averageLevel:num(row?.avg_level),
    })),
  });
});
