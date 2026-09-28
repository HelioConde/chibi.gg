import { LocalBridge } from "./bridge.js";
import { startGepDebug } from "./gep.js";

const bridge = new LocalBridge();
bridge.connect();
startGepDebug(bridge);
