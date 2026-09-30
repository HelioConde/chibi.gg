import { corsHeaders, json } from "../_shared/http.ts";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const FORBIDDEN_KEYS = new Set(["players", "participants", "opponents"]);

function serviceKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function adminHeaders(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    ...extra,
  };
}

async function authUser(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!token || !url || !key) return null;

  const res = await fetch(url + "/auth/v1/user", {
    headers: { Authorization: "Bearer " + token, apikey: key },
    signal: AbortSignal.timeout(5000),
  });
  return res.ok ? await res.json() : null;
}

async function gunzip(data: ArrayBuffer) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

function containsForbiddenKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKeys);
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (containsForbiddenKeys(child)) return true;
  }
  return false;
}

async function getExisting(
  base: string,
  key: string,
  userId: string,
  sessionId: string,
  gameId: string | null,
  ownerPuuid: string,
) {
  let res = await fetch(
    base +
      "/rest/v1/chibi_recorded_matches?select=id,session_id,game_id,owner_puuid,status&user_id=eq." +
      encodeURIComponent(userId) +
      "&session_id=eq." +
      encodeURIComponent(sessionId),
    { headers: adminHeaders(key) },
  );
  if (res.ok) {
    const rows = await res.json();
    if (rows.length) return rows[0];
  }

  if (gameId) {
    res = await fetch(
      base +
        "/rest/v1/chibi_recorded_matches?select=id,session_id,game_id,owner_puuid,status&user_id=eq." +
        encodeURIComponent(userId) +
        "&game_id=eq." +
        encodeURIComponent(gameId) +
        "&owner_puuid=eq." +
        encodeURIComponent(ownerPuuid),
      { headers: adminHeaders(key) },
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows.length) return rows[0];
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await authUser(req);
  if (!user?.id) return json({ error: "unauthorized" }, 401);

  const raw = await req.arrayBuffer();
  if (!raw.byteLength || raw.byteLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  let payload: any;
  try {
    payload = await gunzip(raw);
  } catch {
    return json({ error: "invalid_gzip_payload" }, 400);
  }

  const session = payload?.session ?? {};
  const sessionId = String(session.sessionId ?? "");
  const ownerPuuid = String(session.ownerPuuid ?? "");
  const gameId = session.gameId == null ? null : String(session.gameId);

  if (payload?.schemaVersion !== 1 || !sessionId || !ownerPuuid) {
    return json({ error: "invalid_schema" }, 400);
  }
  if (containsForbiddenKeys(payload?.telemetry)) {
    return json({ error: "opponent_data_not_allowed" }, 400);
  }

  const base = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!base || !key) return json({ error: "server_not_configured" }, 503);

  const links = await fetch(
    base +
      "/rest/v1/chibi_riot_account_links?select=puuid&user_id=eq." +
      encodeURIComponent(user.id) +
      "&puuid=eq." +
      encodeURIComponent(ownerPuuid),
    { headers: adminHeaders(key) },
  );
  if (!links.ok || !(await links.json()).length) {
    return json({ error: "riot_account_not_linked" }, 403);
  }

  const existing = await getExisting(base, key, user.id, sessionId, gameId, ownerPuuid);
  if (existing) {
    return json(
      {
        ok: true,
        idempotent: true,
        recordedMatchId: existing.id,
        sessionId: existing.session_id,
        gameId: existing.game_id,
        status: existing.status,
      },
      200,
    );
  }

  const row = {
    session_id: sessionId,
    user_id: user.id,
    owner_puuid: ownerPuuid,
    game_id: gameId,
    status: "waiting_riot_match",
    riot_match_status: "waiting",
    schema_version: payload.schemaVersion,
    quality: payload.quality ?? {},
    payload,
    uploaded_at: new Date().toISOString(),
  };

  const stored = await fetch(base + "/rest/v1/chibi_recorded_matches", {
    method: "POST",
    headers: adminHeaders(key, {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(row),
  });

  if (!stored.ok) {
    const raced = await getExisting(base, key, user.id, sessionId, gameId, ownerPuuid);
    if (raced) {
      return json(
        {
          ok: true,
          idempotent: true,
          recordedMatchId: raced.id,
          sessionId: raced.session_id,
          gameId: raced.game_id,
          status: raced.status,
        },
        200,
      );
    }
    return json({ error: "storage_failed" }, 502);
  }

  const [created] = await stored.json();
  return json(
    {
      ok: true,
      idempotent: false,
      recordedMatchId: created.id,
      sessionId: created.session_id,
      gameId: created.game_id,
      status: created.status,
    },
    202,
  );
});
