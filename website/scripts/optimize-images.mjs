#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const websiteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sourceDir = path.join(websiteRoot, "assets", "blog");
const outputDir = path.join(websiteRoot, "assets", "blog", "optimized");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  let sharpModule;
  try {
    sharpModule = await import("sharp");
  } catch {
    throw new Error("Image optimization requires `sharp`. Run `npm --prefix website install`.");
  }

  const sharp = sharpModule.default;
  await ensureDir(outputDir);
  const files = await walk(sourceDir);
  let count = 0;

  for (const src of files) {
    if (src.includes(`${path.sep}optimized${path.sep}`)) continue;
    const rel = path.relative(sourceDir, src).replace(/\.(png|jpe?g)$/i, ".webp");
    const out = path.join(outputDir, rel);
    await ensureDir(path.dirname(out));
    await sharp(src).rotate().webp({ quality: 80, effort: 5 }).toFile(out);
    count += 1;
  }

  process.stdout.write(`Optimized ${count} image(s) to ${path.relative(websiteRoot, outputDir)}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
