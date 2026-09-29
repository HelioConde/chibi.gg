import { corsHeaders, json } from "../_shared/http.ts";
import {
  riotHeaders,
  supportedPlatforms,
} from "../_shared/riot.ts";

function cleanMessages(rows:any[]){
  return (Array.isArray(rows)?rows:[]).map((row:any)=>({
    id:String(row?.id||""),
    maintenanceStatus:String(row?.maintenance_status||""),
    incidentSeverity:String(row?.incident_severity||""),
    titles:Array.isArray(row?.titles)?row.titles:[],
    updates:Array.isArray(row?.updates)?row.updates:[],
    createdAt:String(row?.created_at||""),
    updatedAt:String(row?.updated_at||""),
    archiveAt:String(row?.archive_at||""),
  }));
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);

  const riotApiKey=Deno.env.get("RIOT_API_KEY");
  if(!riotApiKey){
    return json({
      error:"riot_api_key_not_configured",
      message:"A integração com a Riot não está configurada no servidor.",
    },503);
  }

  let body:any={};
  try{body=await req.json();}catch{}

  const platform=String(body?.platform||"br1").toLowerCase();
  if(!supportedPlatforms.has(platform)){
    return json({error:"unsupported_platform",message:"Região não suportada."},400);
  }

  let response:Response;
  try{
    response=await fetch(
      "https://"+platform+".api.riotgames.com/tft/status/v1/platform-data",
      {
        headers:riotHeaders(riotApiKey),
        signal:AbortSignal.timeout(8000),
      },
    );
  }catch(error){
    console.error("[public-tft-status] fetch exception",error instanceof Error?error.message:String(error));
    return json({
      error:"riot_unreachable",
      message:"A Riot não respondeu à consulta de status.",
    },502);
  }

  if(response.status===429){
    return json({error:"rate_limited",message:"Limite da Riot atingido."},429);
  }
  if(response.status===401||response.status===403){
    return json({
      error:"riot_api_key_rejected",
      upstreamStatus:response.status,
      message:"A integração do Chibi com a Riot precisa ser renovada.",
    },503);
  }
  if(!response.ok){
    return json({
      error:"tft_status_failed",
      upstreamStatus:response.status,
      message:"Não foi possível consultar o status do TFT.",
    },502);
  }

  const data=await response.json();
  const maintenances=cleanMessages(data?.maintenances||[]);
  const incidents=cleanMessages(data?.incidents||[]);

  return json({
    platform:platform.toUpperCase(),
    id:String(data?.id||platform),
    name:String(data?.name||"Teamfight Tactics"),
    locales:Array.isArray(data?.locales)?data.locales.map(String):[],
    maintenances,
    incidents,
    operational:maintenances.length===0&&incidents.length===0,
    checkedAt:Date.now(),
    source:"tft-status-v1",
  });
});
