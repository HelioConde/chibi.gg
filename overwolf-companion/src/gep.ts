import { LocalBridge } from "./bridge.js";
import { REQUESTED_FEATURES, type FeatureStatus } from "./models.js";
import { sanitizePayload } from "./sanitize.js";
import { GepValidationState } from "./validation.js";

const RETRIES = [0, 1_000, 2_000, 5_000] as const;
const DEBUG_GEP = globalThis.localStorage?.getItem("DEBUG_GEP") === "true";

function requiredFeatures(): Promise<overwolf.games.events.SetFeaturesResult> {
  return new Promise((resolve) => overwolf.games.events.setRequiredFeatures([...REQUESTED_FEATURES], resolve));
}

export class GepValidator {
  private readonly state = new GepValidationState();
  private sendTimer: number | undefined;
  private started = false;

  constructor(private readonly bridge: LocalBridge) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    overwolf.games.events.onInfoUpdates2.addListener((update) => this.onInfo(update));
    overwolf.games.events.onNewEvents.addListener((event) => {
      if (DEBUG_GEP) console.info("[OW][EVENT] sanitized event received");
      this.bridge.send("gep_debug", { kind: "event", payload: sanitizePayload(event) });
    });
    overwolf.games.events.onError.addListener((error) => console.warn("[OW][GEP] error", sanitizePayload(error)));
  }

  async onGameChanged(running: boolean): Promise<void> {
    this.state.setGameRunning(running);
    if (!running) return;
    console.info(`[OW][FEATURES] requested features: ${REQUESTED_FEATURES.join(", ")}`);
    for (let attempt = 0; attempt < RETRIES.length; attempt += 1) {
      if (RETRIES[attempt]) {
        console.info(`[OW][FEATURES] feature registration retry ${attempt}`);
        await new Promise((resolve) => window.setTimeout(resolve, RETRIES[attempt]));
      }
      const result = await requiredFeatures();
      const status: FeatureStatus = { requested: REQUESTED_FEATURES, supported: result.supportedFeatures ?? [], success: result.success, ...(result.error ? { error: result.error } : {}) };
      console.info(`[OW][FEATURES] result success=${status.success} enabled=${status.supported.join(",") || "none"}`);
      this.bridge.send("feature_status", { requested: [...status.requested], supported: status.supported, success: status.success, ...(status.error ? { error: status.error } : {}) });
      if (result.success) { console.info("[OW][FEATURES] feature registration ready"); return; }
    }
    console.warn("[OW][FEATURES] registration failed after controlled retries");
  }

  private onInfo(update: unknown): void {
    const before = this.state.getSnapshot();
    const result = this.state.consume(update);
    const after = this.state.getSnapshot();
    for (const captured of result.first) {
      console.info(`[OW][${captured.feature.toUpperCase()}] first sanitized payload captured`);
      this.bridge.send("gep_debug", { kind: "first_payload", feature: captured.feature, payload: sanitizePayload(captured.payload) });
    }
    if (DEBUG_GEP && result.changed) console.info("[OW][GEP] normalized snapshot changed");
    this.logVerificationChanges(before, after);
    if (result.changed) this.queueSnapshot();
  }

  private logVerificationChanges(before: ReturnType<GepValidationState["getSnapshot"]>, after: ReturnType<GepValidationState["getSnapshot"]>): void {
    for (const key of ["gold", "health", "level"] as const) {
      if (before.me[key] !== after.me[key] && after.me[key] !== undefined) {
        console.info(`[VERIFY][${key}] ${before.me[key] ?? "—"} -> ${after.me[key]} timestamp=${after.updatedAt}`);
      }
    }
    if (before.stage !== after.stage && after.stage !== undefined) console.info(`[VERIFY][stage] ${before.stage ?? "—"} -> ${after.stage}`);
    for (const key of ["board", "bench", "store"] as const) {
      const oldSize = before[key]?.length;
      const newSize = after[key]?.length;
      if (oldSize !== newSize && newSize !== undefined) console.info(`[VERIFY][${key}] units: ${oldSize ?? 0} -> ${newSize} changed=true`);
    }
  }

  private queueSnapshot(): void {
    if (this.sendTimer !== undefined) return;
    this.sendTimer = window.setTimeout(() => {
      this.sendTimer = undefined;
      this.bridge.send("tft_live_snapshot", this.state.getSnapshot() as unknown as import("./models.js").JsonValue);
    }, 150);
  }
}
