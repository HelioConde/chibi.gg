import { corsHeaders, json } from "../_shared/http.ts";

async function authUser(req:Request){
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!token||!url||!key)return null;
  const res=await fetch(url+"/auth/v1/user",{headers:{Authorization:"Bearer "+token,apikey:key},signal:AbortSignal.timeout(5000)});
  return res.ok?await res.json():null;
}
async function gunzip(data:ArrayBuffer){
  const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const user=await authUser(req); if(!user?.id)return json({error:"unauthorized"},401);
  let payload:any; try{payload=await gunzip(await req.arrayBuffer());}catch{return json({error:"invalid_gzip_payload"},400);}
  const session=payload?.session||{}, sessionId=String(session.sessionId||""), ownerPuuid=String(session.ownerPuuid||"");
  if(payload?.schemaVersion!==1||!sessionId||!ownerPuuid)return json({error:"invalid_schema"},400);
  const base=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!base||!key)return json({error:"server_not_configured"},503);
  const links=await fetch(base+"/rest/v1/chibi_riot_account_links?select=puuid&user_id=eq."+encodeURIComponent(user.id)+"&puuid=eq."+encodeURIComponent(ownerPuuid),{headers:{apikey:key,Authorization:"Bearer "+key}});
  if(!links.ok||!(await links.json()).length)return json({error:"riot_account_not_linked"},403);
  const row={session_id:sessionId,user_id:user.id,owner_puuid:ownerPuuid,game_id:session.gameId||null,status:"waiting_riot_match",quality:payload.quality||{},payload};
  const stored=await fetch(base+"/rest/v1/chibi_recorded_matches?on_conflict=session_id",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(row)});
  if(!stored.ok)return json({error:"storage_failed"},502);
  return json({ack:true,sessionId,status:"waiting_riot_match"},202);
});
