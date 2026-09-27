import { normalizeParticipant, num } from "./riot.ts";

function env(name:string){
  return Deno.env.get(name)||"";
}

function normalizeRawMatch(match:any){
  const info=match?.info||{};
  const matchId=String(match?.metadata?.match_id||"");
  if(!matchId) return [];

  return (info?.participants||[])
    .map((participant:any)=>({
      match_id:matchId,
      placement:num(participant?.placement),
      played_at:num(info?.game_datetime),
      queue_id:num(info?.queue_id),
      set_number:num(info?.tft_set_number),
      set_name:String(info?.tft_set_core_name||""),
      game_version:String(info?.game_version||""),
      level:num(participant?.level),
      gold_left:num(participant?.gold_left),
      damage_to_players:num(participant?.total_damage_to_players),
      players_eliminated:num(participant?.players_eliminated),
      augments:Array.isArray(participant?.augments)?participant.augments.map(String):[],
      traits:normalizeParticipant(participant).traits,
      units:normalizeParticipant(participant).units,
    }))
    .filter((row:any)=>row.placement>=1&&row.placement<=8);
}

export async function observeRawMatches(matches:any[]){
  const supabaseUrl=env("SUPABASE_URL");
  const serviceRole=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!supabaseUrl||!serviceRole) return;

  const rows=matches.flatMap(normalizeRawMatch);
  if(!rows.length) return;

  try{
    await fetch(
      supabaseUrl+"/rest/v1/tft_participant_observations?on_conflict=match_id,placement",
      {
        method:"POST",
        headers:{
          apikey:serviceRole,
          Authorization:"Bearer "+serviceRole,
          "Content-Type":"application/json",
          Prefer:"resolution=merge-duplicates,return=minimal",
        },
        body:JSON.stringify(rows),
      },
    );
  }catch{
    // Telemetry is best-effort and must never break player lookup.
  }
}
