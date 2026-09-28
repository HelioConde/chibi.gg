import { LocalBridge } from "./bridge.js";
import { GameWatcher } from "./game.js";
import { GepValidator } from "./gep.js";

const bridge = new LocalBridge();
bridge.connect();
const validator = new GepValidator(bridge);
validator.start();
new GameWatcher(bridge, (running) => { void validator.onGameChanged(running); }).start();
