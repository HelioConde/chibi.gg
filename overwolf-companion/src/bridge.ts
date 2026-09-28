import { BRIDGE_VERSION, type BridgeEnvelope, type JsonValue } from "./models.js";

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;

export function bridgeRetryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempt, 0), RETRY_DELAYS_MS.length - 1)];
}

export class LocalBridge {
  private socket: WebSocket | undefined;
  private reconnectTimer: number | undefined;
  private heartbeatTimer: number | undefined;
  private retryAttempt = 0;

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    console.info("[OW][BRIDGE] connecting ws://127.0.0.1:8765");
    this.socket = new WebSocket("ws://127.0.0.1:8765");
    this.socket.addEventListener("open", () => {
      this.retryAttempt = 0;
      console.info("[OW][BRIDGE] connected");
      this.send("hello", { source: "chibi-overwolf" });
      this.heartbeatTimer = window.setInterval(() => this.send("heartbeat"), 5_000);
    });
    this.socket.addEventListener("message", (event) => {
      if (typeof event.data === "string" && event.data.includes("hello_ack")) console.info("[OW][BRIDGE] hello acknowledged");
    });
    this.socket.addEventListener("close", () => {
      console.info("[OW][BRIDGE] disconnected");
      this.scheduleReconnect();
    });
    this.socket.addEventListener("error", () => this.socket?.close());
  }

  send(type: BridgeEnvelope["type"], data?: JsonValue): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type, version: BRIDGE_VERSION, timestamp: Date.now(), data } satisfies BridgeEnvelope));
  }

  private scheduleReconnect(): void {
    if (this.heartbeatTimer !== undefined) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
    if (this.reconnectTimer !== undefined) return;
    const delay = bridgeRetryDelay(this.retryAttempt++);
    console.info(`[OW][BRIDGE] retrying in ${delay}ms`);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }
}
