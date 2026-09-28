import { LocalBridge } from "./bridge.js";

export const SHARED_LEAGUE_TFT_GAME_ID = 5426;

function gameId(game: overwolf.games.RunningGameInfo): number | undefined {
  return game.classId ?? (typeof game.id === "number" ? Math.floor(game.id / 10) : undefined);
}

export class GameWatcher {
  private running = false;

  constructor(private readonly bridge: LocalBridge, private readonly onTargetChanged: (running: boolean) => void) {}

  start(): void {
    console.info("[OW][GAME] waiting for game");
    overwolf.games.onGameInfoUpdated.addListener((event) => this.handle(event.gameInfo));
    overwolf.games.getRunningGameInfo2((result) => this.handle(result.gameInfo ?? undefined));
  }

  private handle(game: overwolf.games.RunningGameInfo | undefined): void {
    const id = game ? gameId(game) : undefined;
    const targetRunning = Boolean(game?.isRunning !== false && id === SHARED_LEAGUE_TFT_GAME_ID);
    if (targetRunning === this.running) return;
    this.running = targetRunning;
    if (targetRunning) console.info(`[OW][GAME] game detected game id=${id} running=true`);
    else console.info("[OW][GAME] game stopped");
    this.bridge.send("overwolf_game_status", { gameRunning: targetRunning, ...(id ? { gameId: id } : {}) });
    this.onTargetChanged(targetRunning);
  }
}
