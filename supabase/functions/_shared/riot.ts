export const supportedPlatforms = new Set([
  "br1","na1","la1","la2","euw1","eun1","kr","jp1","oc1","tr1","ru",
  "ph2","sg2","th2","tw2","vn2"
]);

export function regionFor(platform: string) {
  if (["br1","na1","la1","la2"].includes(platform)) return "americas";
  if (["kr","jp1"].includes(platform)) return "asia";
  if (["ph2","sg2","th2","tw2","vn2","oc1"].includes(platform)) return "sea";
  return "europe";
}

export function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function riotHeaders(apiKey: string) {
  return { "X-Riot-Token": apiKey };
}

export async function resolveRiotAccount(
  apiKey: string,
  gameName: string,
  tagLine: string,
  platform: string,
) {
  const region = regionFor(platform);
  const url =
    "https://" + region + ".api.riotgames.com/riot/account/v1/accounts/by-riot-id/" +
    encodeURIComponent(gameName) + "/" + encodeURIComponent(tagLine);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: riotHeaders(apiKey),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false as const, status: 502, account: null, region };
  }
  if (!response.ok) {
    return { ok: false as const, status: response.status, account: null, region };
  }

  return {
    ok: true as const,
    status: response.status,
    account: await response.json(),
    region,
  };
}

export function normalizeParticipant(me: any) {
  return {
    placement: num(me?.placement),
    level: num(me?.level),
    goldLeft: num(me?.gold_left),
    lastRound: num(me?.last_round),
    timeEliminated: num(me?.time_eliminated),
    damageToPlayers: num(me?.total_damage_to_players),
    playersEliminated: num(me?.players_eliminated),
    companion: me?.companion ? {
      contentId: String(me.companion?.content_ID || ""),
      itemId: String(me.companion?.item_ID || ""),
      skinId: String(me.companion?.skin_ID || ""),
      species: String(me.companion?.species || ""),
    } : null,
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
}
