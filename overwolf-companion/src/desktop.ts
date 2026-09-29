import { SHARED_LEAGUE_TFT_GAME_ID } from "./game.js";

const statusElement = document.querySelector<HTMLDivElement>("#game-status");

function updateGameStatus(): void {
  overwolf.games.getRunningGameInfo2((result) => {
    if (!statusElement) return;

    const game = result.gameInfo;
    const gameId = game?.classId ?? (typeof game?.id === "number" ? Math.floor(game.id / 10) : undefined);
    const isTargetRunning = Boolean(result.success && game?.isRunning !== false && gameId === SHARED_LEAGUE_TFT_GAME_ID);

    statusElement.textContent = isTargetRunning ? "Jogo detectado" : "Aguardando o jogo";
    statusElement.classList.toggle("ok", isTargetRunning);
    statusElement.classList.toggle("wait", !isTargetRunning);
  });
}

updateGameStatus();
window.setInterval(updateGameStatus, 2_000);
