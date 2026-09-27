import { corsHeaders, json } from "../_shared/http.ts";
import { supportedPlatforms, regionFor, num } from "../_shared/riot.ts";
import { observeRawMatches } from "../_shared/observations.ts";

function percent(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const riotApiKey = Deno.env.get("RIOT_API_KEY");
  if (!riotApiKey) return json({ error: "riot_api_key_not_configured" }, 503);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const gameName = String(body?.gameName || "").trim();
  const tagLine = String(body?.tagLine || "").trim();
  const platform = String(body?.platform || "br1").toLowerCase();

  if (!gameName || !tagLine) {
    return json({ error: "riot_id_required", message: "Use o formato Nome#TAG." }, 400);
  }

  if (!supportedPlatforms.has(platform)) {
    return json({ error: "unsupported_platform" }, 400);
  }

  const region = regionFor(platform);
  const headers = { "X-Riot-Token": riotApiKey };
  const accountUrl =
    "https://" + region + ".api.riotgames.com/riot/account/v1/accounts/by-riot-id/" +
    encodeURIComponent(gameName) + "/" + encodeURIComponent(tagLine);

  const accountRes = await fetch(accountUrl, { headers });

  if (!accountRes.ok) {
    if (accountRes.status === 404) {
      return json({ error: "player_not_found", message: "Riot ID não encontrado." }, 404);
    }
    if (accountRes.status === 429) {
      return json({ error: "rate_limited", message: "Limite da Riot atingido. Tente novamente em instantes." }, 429);
    }
    return json({ error: "account_lookup_failed", status: accountRes.status }, 502);
  }

  const account = await accountRes.json();
  const puuid = String(account?.puuid || "");
  if (!puuid) return json({ error: "missing_puuid" }, 502);

  const platformBase = "https://" + platform + ".api.riotgames.com";
  const regionalBase = "https://" + region + ".api.riotgames.com";

  const requests = await Promise.all([
    fetch(platformBase + "/tft/summoner/v1/summoners/by-puuid/" + encodeURIComponent(puuid), { headers }),
    fetch(platformBase + "/tft/league/v1/by-puuid/" + encodeURIComponent(puuid), { headers }),
    fetch(regionalBase + "/tft/match/v1/matches/by-puuid/" + encodeURIComponent(puuid) + "/ids?start=0&count=12", { headers }),
  ]);

  const summonerRes = requests[0];
  const leagueRes = requests[1];
  const idsRes = requests[2];

  if ([summonerRes.status, leagueRes.status, idsRes.status].includes(429)) {
    return json({ error: "rate_limited", message: "Limite da Riot atingido. Tente novamente em instantes." }, 429);
  }

  const summoner = summonerRes.ok ? await summonerRes.json() : {};
  const rankedRaw = leagueRes.ok ? await leagueRes.json() : [];
  const matchIds = idsRes.ok ? await idsRes.json() : [];

  const matchDetails = await Promise.all(
    (Array.isArray(matchIds) ? matchIds : []).slice(0, 12).map(async (matchId: string) => {
      try {
        const res = await fetch(
          regionalBase + "/tft/match/v1/matches/" + encodeURIComponent(matchId),
          { headers },
        );
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    }),
  );

  await observeRawMatches(matchDetails.filter(Boolean));

  const matches = matchDetails.map((match: any) => {
    if (!match) return null;
    const info = match?.info || {};
    const me = (info?.participants || []).find((p: any) => p?.puuid === puuid);
    if (!me) return null;

    return {
      id: String(match?.metadata?.match_id || ""),
      playedAt: num(info?.game_datetime),
      duration: num(info?.game_length),
      gameVersion: String(info?.game_version || ""),
      queueId: num(info?.queue_id),
      setNumber: num(info?.tft_set_number),
      setName: String(info?.tft_set_core_name || ""),
      placement: num(me?.placement),
      level: num(me?.level),
      goldLeft: num(me?.gold_left),
      lastRound: num(me?.last_round),
      timeEliminated: num(me?.time_eliminated),
      damageToPlayers: num(me?.total_damage_to_players),
      augments: Array.isArray(me?.augments) ? me.augments.map(String) : [],
      traits: (me?.traits || []).map((trait: any) => ({
        name: String(trait?.name || ""),
        numUnits: num(trait?.num_units),
        style: num(trait?.style),
        tierCurrent: num(trait?.tier_current),
        tierTotal: num(trait?.tier_total),
      })),
      units: (me?.units || []).map((unit: any) => ({
        characterId: String(unit?.character_id || ""),
        rarity: num(unit?.rarity),
        tier: num(unit?.tier),
        itemNames: Array.isArray(unit?.itemNames) ? unit.itemNames.map(String) : [],
      })),
    };
  }).filter(Boolean);

  const placements = matches.map((m: any) => m.placement).filter((v: number) => v > 0);
  const averagePlacement = placements.length
    ? Math.round((placements.reduce((sum: number, p: number) => sum + p, 0) / placements.length) * 100) / 100
    : null;

  const top4 = placements.filter((p: number) => p <= 4).length;
  const firsts = placements.filter((p: number) => p === 1).length;
  const eighths = placements.filter((p: number) => p === 8).length;

  const ranked = (Array.isArray(rankedRaw) ? rankedRaw : [rankedRaw]).filter(Boolean).map((entry: any) => ({
    queueType: String(entry?.queueType || entry?.queue_type || ""),
    tier: String(entry?.tier || ""),
    rank: String(entry?.rank || ""),
    leaguePoints: num(entry?.leaguePoints ?? entry?.league_points),
    wins: num(entry?.wins),
    losses: num(entry?.losses),
  }));

  return json({
    player: {
      gameName: String(account?.gameName || gameName),
      tagLine: String(account?.tagLine || tagLine),
      platform: platform.toUpperCase(),
      profileIconId: num(summoner?.profileIconId),
      level: num(summoner?.summonerLevel),
    },
    ranked,
    summary: {
      matches: placements.length,
      averagePlacement,
      top4Rate: percent(top4, placements.length),
      winRate: percent(firsts, placements.length),
      firsts,
      eighths,
    },
    matches,
  });
});
