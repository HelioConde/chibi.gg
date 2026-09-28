import { REQUESTED_FEATURES, type JsonValue, type OverwolfTftSnapshot, type RequestedFeature, type SourceStatus } from "./models.js";
import { isRecord } from "./sanitize.js";

function parse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}
function numberValue(value: unknown): number | undefined {
  const parsed = parse(value);
  if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
  if (typeof parsed === "string" && /^-?\d+(\.\d+)?$/.test(parsed)) return Number(parsed);
  return undefined;
}
function asList(value: unknown): JsonValue[] | undefined {
  const parsed = parse(value);
  if (Array.isArray(parsed)) return parsed as JsonValue[];
  if (isRecord(parsed)) return Object.values(parsed) as JsonValue[];
  return undefined;
}
function featurePayload(update: unknown, feature: RequestedFeature): unknown {
  if (!isRecord(update)) return undefined;
  if (update.feature === feature) return isRecord(update.info) ? update.info[feature] ?? update : update;
  return isRecord(update.info) ? update.info[feature] : undefined;
}

export class GepValidationState {
  private readonly sources: Record<RequestedFeature, SourceStatus> = Object.fromEntries(REQUESTED_FEATURES.map((feature) => [feature, "not_seen"])) as Record<RequestedFeature, SourceStatus>;
  private readonly firstPayloads = new Set<RequestedFeature>();
  private snapshot: OverwolfTftSnapshot = { connected: true, gameRunning: false, me: {}, updatedAt: 0, sources: this.sources };

  consume(update: unknown): { changed: boolean; first: Array<{ feature: RequestedFeature; payload: JsonValue }> } {
    const first: Array<{ feature: RequestedFeature; payload: JsonValue }> = [];
    let changed = false;
    for (const feature of REQUESTED_FEATURES) {
      const payload = featurePayload(update, feature);
      if (payload === undefined) continue;
      if (this.sources[feature] === "not_seen") {
        this.sources[feature] = "observed";
        if (!this.firstPayloads.has(feature)) { this.firstPayloads.add(feature); first.push({ feature, payload: payload as JsonValue }); }
      }
      changed = this.merge(feature, payload) || changed;
    }
    if (changed) this.snapshot = { ...this.snapshot, updatedAt: Date.now(), sources: { ...this.sources } };
    return { changed, first };
  }

  setGameRunning(gameRunning: boolean): void { this.snapshot = { ...this.snapshot, gameRunning, updatedAt: Date.now(), sources: { ...this.sources } }; }
  getSnapshot(): OverwolfTftSnapshot { return { ...this.snapshot, me: { ...this.snapshot.me }, sources: { ...this.sources } }; }

  private merge(feature: RequestedFeature, payload: unknown): boolean {
    if (feature === "me" && isRecord(payload)) {
      const xp = parse(payload.xp);
      const values = { gold: numberValue(payload.gold), health: numberValue(payload.health), level: isRecord(xp) ? numberValue(xp.level) : numberValue(payload.level), xp: isRecord(xp) ? numberValue(xp.current_xp) : numberValue(payload.xp) };
      const me = { ...this.snapshot.me, ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) };
      const changed = JSON.stringify(me) !== JSON.stringify(this.snapshot.me);
      this.snapshot = { ...this.snapshot, me };
      return changed;
    }
    if (feature === "match_info" && isRecord(payload)) {
      const round = parse(payload.round_type);
      const stage = isRecord(round) && typeof round.stage === "string" ? round.stage : typeof payload.stage === "string" ? payload.stage : undefined;
      if (stage !== undefined && stage !== this.snapshot.stage) { this.snapshot = { ...this.snapshot, stage }; return true; }
      return false;
    }
    const listFeature = feature as "board" | "bench" | "store";
    const list = asList(payload);
    if (!list) return false;
    const current = this.snapshot[listFeature];
    if (JSON.stringify(current) === JSON.stringify(list)) return false;
    this.snapshot = { ...this.snapshot, [listFeature]: list };
    return true;
  }
}
