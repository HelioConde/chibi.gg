import { readdir, stat, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import sharp from "sharp";

const root = new URL("../public/img/", import.meta.url).pathname;
const pngs = [];

async function discover(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await discover(full);
    else if (entry.isFile() && extname(entry.name).toLowerCase() === ".png") pngs.push(full);
  }
}

await discover(root);
let cursor = 0, converted = 0, skipped = 0, fromBytes = 0, toBytes = 0;
const failures = [];

async function worker() {
  while (cursor < pngs.length) {
    const path = pngs[cursor++];
    const output = path.replace(/\.png$/i, ".webp");
    try {
      const source = await stat(path);
      const current = await stat(output).catch(() => null);
      if (current && current.mtimeMs >= source.mtimeMs) {
        skipped++;
        continue;
      }
      await mkdir(new URL(".", "file://" + output).pathname, { recursive: true });
      const result = await sharp(path, { limitInputPixels: 100_000_000 })
        .webp({ quality: 82, effort: 4, alphaQuality: 90 })
        .toFile(output);
      converted++;
      fromBytes += source.size;
      toBytes += result.size;
    } catch (error) {
      failures.push({ path, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()));
if (failures.length) {
  for (const failure of failures.slice(0, 12)) console.error("WebP conversion failed", failure);
  process.exitCode = 1;
} else {
  const gain = fromBytes ? ((1 - toBytes / fromBytes) * 100).toFixed(1) : "n/a";
  console.log(`TFT artwork: ${pngs.length} PNG inputs, ${converted} optimized, ${skipped} already current; ${(fromBytes / 1024 / 1024).toFixed(1)} MB → ${(toBytes / 1024 / 1024).toFixed(1)} MB for converted assets (${gain}% reduction).`);
}
