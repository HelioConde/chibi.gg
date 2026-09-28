import type { JsonObject, JsonValue } from "./models.js";

const SENSITIVE = ["token", "password", "authorization", "auth", "credential", "spectator", "secret", "cookie", "session", "puuid", "summonerid", "summoner_name", "displayname", "gameid"];

export function sanitizePayload(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitizePayload);
  if (isRecord(value)) {
    const output: JsonObject = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = SENSITIVE.some((part) => key.toLowerCase().includes(part)) ? "[redacted]" : sanitizePayload(child);
    }
    return output;
  }
  return String(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
