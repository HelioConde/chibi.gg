import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const distRoot = fileURLToPath(new URL("../dist/img/output-v2/", import.meta.url));
const keep = new Set(["icon/element_001.png"]);
let total = 0, removed = 0, savedBytes = 0, missing = [];
async function scan(dir, relative = "") {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const nextRel = relative ? relative + "/" + item.name : item.name;
    const full = join(dir, item.name);
    if (item.isDirectory()) { await scan(full, nextRel); continue; }
    if (!item.isFile() || !item.name.toLowerCase().endsWith(".png")) continue;
    total++;
    if (keep.has(nextRel)) continue;
    const counterpart = full.replace(/\.png$/i, ".webp");
    const webp = await stat(counterpart).catch(() => null);
    if (!webp || webp.size < 100) { missing.push(nextRel); continue; }
    const source = await stat(full);
    await unlink(full);
    removed++;
    savedBytes += source.size;
  }
}
try {
  await scan(distRoot);
} catch (error) {
  console.error("Could not safely prune duplicate images from the production build",error);
  process.exitCode=1;
}
if(missing.length){
  console.error("Unoptimized images still present:",missing.slice(0,20));
  process.exitCode=1;
}
console.log(`Build artwork audit: ${total} PNGs checked, ${removed} duplicates removed, ${(savedBytes / 1048576).toFixed(1)} MB saved from deployment; favicon PNG preserved.`);
