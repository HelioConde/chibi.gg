import { corsHeaders, json } from "../_shared/http.ts";
import {
  normalizeParticipant,
  regionFor,
  resolveRiotAccount,
  riotHeaders,
  supportedPlatforms,
  num,
} from "../_shared/riot.ts";
import { observeRawMatches } from "../_shared/observations.ts";
import { getOrFetchMatches } from "../_shared/matchCache.ts";
import { recordedMatchMarkers } from "../_shared/recordedMatches.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const riotApiKey = Deno.env.get("RIOT_API_KEY");
  if (!riotApiKey) return json({ error: "riot_api_key_not_configured", message: "A integração com a Riot está temporariamente indisponível." }, 503);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  const gameName = String(body?.gameName || "").trim();
  const tagLine = String(body?.tagLine || "").trim();
  const platform = String(body?.platform || "br1").toLowerCase();
  const start = Math.max(0, Math.min(100, num(body?.start)));
  const count = Math.max(1, Math.min(20, num(body?.count) || 10));

  if (!gameName || !tagLine) {
    return json({ error: "riot_id_required", message: "Use o formato Nome#TAG." }, 400);
  }
  if (!supportedPlatforms.has(platform)) {
    return json({ error: "unsupported_platform" }, 400);
  }

  const accountResult = await resolveRiotAccount(riotApiKey, gameName, tagLine, platform);
  if (!accountResult.ok) {
    if (accountResult.status === 404) return json({ error: "player_not_found", message: "Riot ID não encontrado." }, 404);
    if (accountResult.status === 429) return json({ error: "rate_limited", message: "Limite da Riot atingido. Tente novamente em instantes." }, 429);
    if (accountResult.status === 401 || accountResult.status === 403) {
      return json({ error: "riot_api_key_rejected", message: "A integração do Chibi com a Riot precisa ser renovada. Tente novamente mais tarde." }, 503);
    }
    return json({ error: "account_lookup_failed", status: accountResult.status, message: "Não foi possível consultar este Riot ID agora." }, 502);
  }

  const puuid = String(accountResult.account?.puuid || "");
  const region = regionFor(platform);
  const regionalBase = "https://" + region + ".api.riotgames.com";
  const headers = riotHeaders(riotApiKey);

  const idsRes = await fetch(
    regionalBase + "/tft/match/v1/matches/by-puuid/" + encodeURIComponent(puuid) +
      "/ids?start=" + start + "&count=" + count,
    { headers, signal: AbortSignal.timeout(8000) },
  );

  if (!idsRes.ok) {
    if (idsRes.status === 429) return json({ error: "rate_limited", message: "Limite da Riot atingido. Tente novamente em instantes." }, 429);
    if (idsRes.status === 401 || idsRes.status === 403) {
      return json({ error: "riot_api_key_rejected", message: "A integração do Chibi com a Riot precisa ser renovada. Tente novamente mais tarde." }, 503);
    }
    return json({ error: "match_ids_failed", status: idsRes.status, message: "Não foi possível carregar o histórico agora." }, 502);
  }

  const ids = await idsRes.json();

  const requestedIds=(Array.isArray(ids)?ids:[]).map(String);
  const detailResult=await getOrFetchMatches(
    requestedIds,
    regionalBase,
    headers,
    region,
  );

  try{
    await observeRawMatches(detailResult.rawFetched);
  }catch{
    // Dataset collection is best-effort.
  }

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

  return json({
    player: {
      gameName: String(accountResult.account?.gameName || gameName),
      tagLine: String(accountResult.account?.tagLine || tagLine),
      platform: platform.toUpperCase(),
    },
    paging: { start, count, returned: matches.length },
    matches,
    source: {
      matches: "tft-match-v1",
      retrievedAt: Date.now(),
      cache: { hits: detailResult.cacheHits, fetched: detailResult.fetched },
    },
  });
});
