import { mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(import.meta.dirname, "..", "debug");
await mkdir(directory, { recursive: true });
for (const item of await readdir(directory)) {
  await rm(resolve(directory, item), { force: true, recursive: true });
}
console.info(`[OW][DEBUG] reset: ${directory}`);
