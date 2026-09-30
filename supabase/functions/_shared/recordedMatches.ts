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


export async function reconcileRecordedMatches(matches: any[]) {
  const base = baseUrl();
  const key = serviceKey();
  if (!base || !key) return 0;

  let changed = 0;
  for (const match of Array.isArray(matches) ? matches : []) {
    const gameId = String(match?.id ?? "");
    if (!gameId) continue;

    let waiting: any[] = [];
    try {
      const response = await fetch(
        base +
          "/rest/v1/chibi_recorded_matches?select=session_id,owner_puuid&status=eq.waiting_riot_match&game_id=eq." +
          encodeURIComponent(gameId),
        { headers: headers(key), signal: AbortSignal.timeout(5000) },
      );
      if (!response.ok) continue;
      const rows = await response.json();
      waiting = Array.isArray(rows) ? rows : [];
    } catch {
      continue;
    }

    for (const row of waiting) {
      const ownerPuuid = String(row?.owner_puuid ?? "");
      const participant = (Array.isArray(match?.participants) ? match.participants : [])
        .find((item: any) => String(item?.puuid ?? "") === ownerPuuid);
      if (!participant) continue;

      const { puuid: _puuid, ...safeParticipant } = participant;
      const official = {
        source: "RIOT_MATCH",
        match: {
          id: gameId,
          playedAt: match?.playedAt ?? 0,
          duration: match?.duration ?? 0,
          queueId: match?.queueId ?? 0,
          setNumber: match?.setNumber ?? 0,
          setName: String(match?.setName ?? ""),
          gameVersion: String(match?.gameVersion ?? ""),
        },
        participant: safeParticipant,
      };

      try {
        const response = await fetch(
          base +
            "/rest/v1/chibi_recorded_matches?session_id=eq." +
            encodeURIComponent(String(row?.session_id ?? "")) +
            "&status=eq.waiting_riot_match",
          {
            method: "PATCH",
            headers: { ...headers(key), "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "reconciled",
              riot_match_status: "ready",
              riot_match_payload: official,
              reconciled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(5000),
          },
        );
        if (response.ok) changed += 1;
      } catch {
        // Best-effort; the next history/profile request retries.
      }
    }
  }
  return changed;
}
