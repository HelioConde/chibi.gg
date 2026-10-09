import { corsHeaders, json } from "../_shared/http.ts";
import { normalizeParticipant, num, riotHeaders } from "../_shared/riot.ts";
import { observeRawMatches } from "../_shared/observations.ts";
import { normalizeMatchForCache, readCachedMatches, writeCachedMatches } from "../_shared/matchCache.ts";
import { recordedMatchMarker, reconcileRecordedMatches } from "../_shared/recordedMatches.ts";

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
  if (!/^(BR1|NA1|LA1|LA2|EUW1|EUN1|KR|JP1|OC1|TR1|RU|PH2|SG2|TH2|TW2|VN2)_[0-9]{4,20}$/i.test(matchId)) {
    return json({
      error: "invalid_match_id",
      message: "Identificador de partida inválido.",
    }, 400);
  }

  const region = regionFromMatchId(matchId);
  const cached=await readCachedMatches([matchId]);
  let normalized=cached.get(matchId)||null;
  let cacheState:"hit"|"miss"=normalized?"hit":"miss";

  if(!normalized){
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

    const rawMatch = await response.json();
    try{
      await observeRawMatches([rawMatch]);
    }catch(error){
      console.error("[public-tft-match] optional observation failure", error instanceof Error?error.name:"unknown");
    }
    await writeCachedMatches([rawMatch],region);
    normalized=normalizeMatchForCache(rawMatch);
  }

  if(!normalized){
    return json({error:"match_normalization_failed",message:"Não foi possível interpretar esta partida."},502);
  }

  await reconcileRecordedMatches([normalized]);
  const recordedMarker=await recordedMatchMarker(matchId);

  const participants=(Array.isArray(normalized.participants)?normalized.participants:[]).map((participant:any)=>{
    const {puuid:_participantPuuid,...safe}=participant;
    return safe;
  });

  return json({
    match: {
      id: String(normalized.id || matchId),
      playedAt: num(normalized.playedAt),
      duration: num(normalized.duration),
      gameVersion: String(normalized.gameVersion || ""),
      queueId: num(normalized.queueId),
      setNumber: num(normalized.setNumber),
      setName: String(normalized.setName || ""),
      participants,
      ...recordedMarker,
    },
    source: {
      match: "tft-match-v1",
      retrievedAt: Date.now(),
      cache: cacheState,
    },
  });
});
