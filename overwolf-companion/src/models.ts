export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export const BRIDGE_VERSION = 1;
export const REQUESTED_FEATURES = ["me", "match_info", "board", "bench", "store"] as const;
export type RequestedFeature = (typeof REQUESTED_FEATURES)[number];

export interface BridgeEnvelope {
  type: "hello" | "heartbeat" | "gep_debug" | "feature_status" | "overwolf_game_status" | "tft_live_snapshot";
  version: number;
  timestamp: number;
  data?: JsonValue;
}

export interface FeatureStatus {
  requested: readonly RequestedFeature[];
  supported: string[];
  success: boolean;
  error?: string;
}

export type SourceStatus = "not_seen" | "observed" | "verified" | "failed";

export interface OverwolfTftSnapshot {
  connected: boolean;
  gameRunning: boolean;
  stage?: string;
  me: { gold?: number; health?: number; level?: number; xp?: number };
  board?: JsonValue[];
  bench?: JsonValue[];
  store?: JsonValue[];
  updatedAt: number;
  sources: Record<RequestedFeature, SourceStatus>;
}
