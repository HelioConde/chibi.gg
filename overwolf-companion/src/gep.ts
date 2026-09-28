import { LocalBridge } from "./bridge.js";
import { BRIDGE_VERSION, REQUESTED_FEATURES, type FeatureStatus } from "./models.js";
import { sanitizePayload } from "./sanitize.js";

export function startGepDebug(bridge: LocalBridge): void {
  overwolf.games.events.setRequiredFeatures([...REQUESTED_FEATURES], (result) => {
    const status: FeatureStatus = {
      requested: REQUESTED_FEATURES,
      supported: result.supportedFeatures ?? [],
      ...(result.error ? { error: result.error } : {})
    };
    console.info("[OW] features", status.supported.join(",") || "none");
    bridge.send("feature_status", {
      requested: [...status.requested],
      supported: status.supported,
      ...(status.error ? { error: status.error } : {})
    });
  });
  overwolf.games.events.onInfoUpdates2.addListener((update) => {
    console.info("[OW][info] sanitized update received");
    bridge.send("gep_debug", sanitizePayload(update));
  });
  overwolf.games.events.onNewEvents.addListener((event) => {
    console.info("[OW][event] sanitized event received");
    bridge.send("gep_debug", sanitizePayload(event));
  });
  overwolf.games.events.onError.addListener((error) => {
    console.warn("[OW] GEP error", sanitizePayload(error));
  });
  void BRIDGE_VERSION;
}
