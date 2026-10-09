import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../public/img/", import.meta.url));
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
// Thumbnail-only assets prevent multi-megabyte source icons competing with the LCP headline.
async function writeThumb(source, target, width, format="webp") {
  const data = sharp(source, { limitInputPixels: 100_000_000 }).resize(width, width, {
    fit: "contain",
    withoutEnlargement: true,
  });
  if (format === "png") await data.png({ compressionLevel: 9 }).toFile(target);
  else await data.webp({ quality: 84, effort: 4, alphaQuality: 90 }).toFile(target);
}
const brand = join(root, "output-v2", "icon", "element_001.png");
await writeThumb(brand, join(root, "output-v2", "icon", "brand-96.webp"), 96);
await writeThumb(brand, fileURLToPath(new URL("../public/favicon-64.png", import.meta.url)), 64, "png");
await writeThumb(brand, fileURLToPath(new URL("../public/apple-touch-icon.png", import.meta.url)), 180, "png");
await writeThumb(join(root,"icon.png"), join(root,"icon-small.webp"), 96);
for (let i=1;i<=11;i++) {
  const file="element_"+String(i).padStart(3,"0");
  const base=join(root,"output-v2","icons");
  await writeThumb(join(base,file+".png"),join(base,file+"-small.webp"),64);
}

if (failures.length) {
  for (const failure of failures.slice(0, 12)) console.error("WebP conversion failed", failure);
  process.exitCode = 1;
} else {
  const gain = fromBytes ? ((1 - toBytes / fromBytes) * 100).toFixed(1) : "n/a";
  console.log(`TFT artwork: ${pngs.length} PNG inputs, ${converted} optimized, ${skipped} already current; ${(fromBytes / 1024 / 1024).toFixed(1)} MB → ${(toBytes / 1024 / 1024).toFixed(1)} MB for converted assets (${gain}% reduction).`);
}
