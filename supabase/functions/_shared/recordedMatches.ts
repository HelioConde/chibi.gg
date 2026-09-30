export type RecordedMatchMarker = {
  hasChibiTelemetry: boolean;
  chibiTelemetryStatus?: "waiting_riot_match" | "reconciled";
};

function serviceKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function baseUrl() {
  return Deno.env.get("SUPABASE_URL") ?? "";
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
  };
}

export async function recordedMatchMarkers(matchIds: string[]) {
  const unique = [...new Set(matchIds.map(String).filter(Boolean))];
  const result = new Map<string, RecordedMatchMarker>();
  if (!unique.length) return result;

  const base = baseUrl();
  const key = serviceKey();
  if (!base || !key) return result;

  const encoded = unique
    .map((id) => '"' + id.replaceAll('"', '') + '"')
    .join(",");

  try {
    const response = await fetch(
      base +
        "/rest/v1/chibi_recorded_matches?select=game_id,status&game_id=in.(" +
        encodeURIComponent(encoded) +
        ")",
      {
        headers: headers(key),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return result;

    const rows = await response.json();
    for (const row of Array.isArray(rows) ? rows : []) {
      const gameId = String(row?.game_id ?? "");
      const status = String(row?.status ?? "");
      if (!gameId) continue;
      result.set(gameId, {
        hasChibiTelemetry: true,
        chibiTelemetryStatus:
          status === "reconciled" ? "reconciled" : "waiting_riot_match",
      });
    }
  } catch {
    // This marker is additive metadata. Riot-backed history must keep working
    // even if the private telemetry store is temporarily unavailable.
  }

  return result;
}

export async function recordedMatchMarker(matchId: string): Promise<RecordedMatchMarker> {
  const markers = await recordedMatchMarkers([matchId]);
  return markers.get(matchId) ?? { hasChibiTelemetry: false };
}
