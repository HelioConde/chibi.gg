import { BRIDGE_VERSION, type BridgeEnvelope, type JsonValue } from "./models.js";

export class LocalBridge {
  private socket: WebSocket | undefined;
  private reconnectTimer: number | undefined;
  private heartbeatTimer: number | undefined;

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    this.socket = new WebSocket("ws://127.0.0.1:8765");
    this.socket.addEventListener("open", () => {
      this.send("hello", { source: "chibi-overwolf" });
      this.heartbeatTimer = window.setInterval(() => this.send("heartbeat"), 5_000);
    });
    this.socket.addEventListener("close", () => this.scheduleReconnect());
    this.socket.addEventListener("error", () => this.socket?.close());
  }

  send(type: BridgeEnvelope["type"], data?: JsonValue): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type, version: BRIDGE_VERSION, timestamp: Date.now(), data } satisfies BridgeEnvelope));
  }

  private scheduleReconnect(): void {
    if (this.heartbeatTimer !== undefined) window.clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer !== undefined) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, 5_000);
  }
}
