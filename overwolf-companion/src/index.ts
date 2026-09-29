import { LocalBridge } from "./bridge.js";
import { GameWatcher } from "./game.js";
import { GepValidator } from "./gep.js";

function openDesktopWindow(): void {
  overwolf.windows.obtainDeclaredWindow("desktop", (result) => {
    if (result.status !== "success" || !result.window?.id) {
      console.warn("[OW][WINDOW] failed to obtain desktop window", result.error ?? "unknown error");
      return;
    }

    overwolf.windows.restore(result.window.id, (restoreResult) => {
      if (restoreResult?.status === "error") {
        console.warn("[OW][WINDOW] failed to restore desktop window", restoreResult.error ?? "unknown error");
        return;
      }
      console.info("[OW][WINDOW] desktop window ready");
    });
  });
}

openDesktopWindow();

const bridge = new LocalBridge();
bridge.connect();
const validator = new GepValidator(bridge);
validator.start();
new GameWatcher(bridge, (running) => { void validator.onGameChanged(running); }).start();
