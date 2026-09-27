import { corsHeaders, json } from "../_shared/http.ts";
import {
  normalizeParticipant,
  regionFor,
  resolveRiotAccount,
  riotHeaders,
  supportedPlatforms,
  num,
} from "../_shared/riot.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const riotApiKey = Deno.env.get("RIOT_API_KEY");
  if (!riotApiKey) return json({ error: "riot_api_key_not_configured" }, 503);

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
    if (accountResult.status === 404) return json({ error: "player_not_found" }, 404);
    if (accountResult.status === 429) return json({ error: "rate_limited" }, 429);
    return json({ error: "account_lookup_failed", status: accountResult.status }, 502);
  }

  const puuid = String(accountResult.account?.puuid || "");
  const region = regionFor(platform);
  const regionalBase = "https://" + region + ".api.riotgames.com";
  const headers = riotHeaders(riotApiKey);

  const idsRes = await fetch(
    regionalBase + "/tft/match/v1/matches/by-puuid/" + encodeURIComponent(puuid) +
      "/ids?start=" + start + "&count=" + count,
    { headers },
  );

  if (!idsRes.ok) {
    if (idsRes.status === 429) return json({ error: "rate_limited" }, 429);
    return json({ error: "match_ids_failed", status: idsRes.status }, 502);
  }

  const ids = await idsRes.json();

  const matches = await Promise.all(
    (Array.isArray(ids) ? ids : []).map(async (matchId: string) => {
      try {
        const response = await fetch(
          regionalBase + "/tft/match/v1/matches/" + encodeURIComponent(matchId),
          { headers },
        );
        if (!response.ok) return null;

        const match = await response.json();
        const info = match?.info || {};
        const me = (info?.participants || []).find((p: any) => p?.puuid === puuid);
        if (!me) return null;

        return {
          id: String(match?.metadata?.match_id || matchId),
          playedAt: num(info?.game_datetime),
          duration: num(info?.game_length),
          gameVersion: String(info?.game_version || ""),
          queueId: num(info?.queue_id),
          setNumber: num(info?.tft_set_number),
          setName: String(info?.tft_set_core_name || ""),
          ...normalizeParticipant(me),
        };
      } catch {
        return null;
      }
    }),
  );

  return json({
    player: {
      gameName: String(accountResult.account?.gameName || gameName),
      tagLine: String(accountResult.account?.tagLine || tagLine),
      platform: platform.toUpperCase(),
    },
    paging: { start, count, returned: matches.filter(Boolean).length },
    matches: matches.filter(Boolean),
  });
});
