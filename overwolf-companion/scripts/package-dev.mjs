import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const copy = async (from, to) => {
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to);
};

await copy(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
await copy(resolve(root, "index.html"), resolve(dist, "index.html"));
await mkdir(resolve(dist, "debug"), { recursive: true });

const icon = resolve(root, "..", "public", "img", "icon.png");
try {
  await stat(icon);
  await copy(icon, resolve(dist, "assets", "icon.png"));
} catch {
  throw new Error(`Missing required development icon: ${icon}`);
}

console.info(`[OW][BUILD] unpacked package ready: ${dist}`);
