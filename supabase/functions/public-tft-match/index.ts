import { corsHeaders, json } from "../_shared/http.ts";
import { normalizeParticipant, num, riotHeaders } from "../_shared/riot.ts";
import { observeRawMatches } from "../_shared/observations.ts";

function regionFromMatchId(matchId: string) {
  const prefix = matchId.split("_")[0]?.toUpperCase() || "";
  if (["BR1","NA1","LA1","LA2"].includes(prefix)) return "americas";
  if (["KR","JP1"].includes(prefix)) return "asia";
  if (["OC1","PH2","SG2","TH2","TW2","VN2"].includes(prefix)) return "sea";
  return "europe";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const riotApiKey = Deno.env.get("RIOT_API_KEY");
  if (!riotApiKey) return json({ error: "riot_api_key_not_configured", message: "A integração com a Riot está temporariamente indisponível." }, 503);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  const matchId = String(body?.matchId || "").trim();
  if (!matchId) return json({ error: "match_id_required" }, 400);

  const region = regionFromMatchId(matchId);
  let response: Response;
  try {
    response = await fetch(
      "https://" + region + ".api.riotgames.com/tft/match/v1/matches/" + encodeURIComponent(matchId),
      { headers: riotHeaders(riotApiKey), signal: AbortSignal.timeout(8000) },
    );
  } catch {
    return json({ error: "riot_unreachable", message: "A Riot não respondeu à consulta desta partida." }, 502);
  }

  if (!response.ok) {
    if (response.status === 404) return json({ error: "match_not_found", message: "Partida não encontrada." }, 404);
    if (response.status === 429) return json({ error: "rate_limited", message: "Limite da Riot atingido. Tente novamente em instantes." }, 429);
    if (response.status === 401 || response.status === 403) {
      return json({ error: "riot_api_key_rejected", message: "A integração do Chibi com a Riot precisa ser renovada. Tente novamente mais tarde." }, 503);
    }
    return json({ error: "match_lookup_failed", status: response.status, message: "Não foi possível abrir esta partida agora." }, 502);
  }

  const match = await response.json();
  await observeRawMatches([match]);
  const info = match?.info || {};

  const participants = (info?.participants || []).map((participant: any) => ({
    placement: num(participant?.placement),
    level: num(participant?.level),
    goldLeft: num(participant?.gold_left),
    damageToPlayers: num(participant?.total_damage_to_players),
    playersEliminated: num(participant?.players_eliminated),
    augments: Array.isArray(participant?.augments) ? participant.augments.map(String) : [],
    traits: normalizeParticipant(participant).traits,
    units: normalizeParticipant(participant).units,
  }));

  return json({
    match: {
      id: String(match?.metadata?.match_id || matchId),
      playedAt: num(info?.game_datetime),
      duration: num(info?.game_length),
      gameVersion: String(info?.game_version || ""),
      queueId: num(info?.queue_id),
      setNumber: num(info?.tft_set_number),
      setName: String(info?.tft_set_core_name || ""),
      participants,
    },
    source: { match: "tft-match-v1", retrievedAt: Date.now() },
  });
});
