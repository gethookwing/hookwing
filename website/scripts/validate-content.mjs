#!/usr/bin/env node
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const websiteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

async function listHtmlFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listHtmlFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

async function listGeneratedFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listGeneratedFiles(fullPath)));
    } else if (entry.isFile() && /\.(html|json|xml|webp)$/i.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

async function snapshot() {
  const targets = [
    path.join(websiteRoot, "blog"),
    path.join(websiteRoot, "docs"),
    path.join(websiteRoot, "assets", "blog", "optimized"),
  ];
  const files = [];
  for (const target of targets) {
    try {
      files.push(...(await listGeneratedFiles(target)));
    } catch {
      // Ignore missing folders in early setup.
    }
  }
  files.push(path.join(websiteRoot, "sitemap.xml"));
  files.push(path.join(websiteRoot, "blog", "rss.xml"));
  files.push(path.join(websiteRoot, "blog", "search-index.json"));

  const digest = crypto.createHash("sha256");
  for (const filePath of files.sort()) {
    const rel = path.relative(websiteRoot, filePath);
    const content = await fs.readFile(filePath);
    digest.update(rel);
    digest.update(content);
  }
  return digest.digest("hex");
}

async function runBuild() {
  await execFileAsync("npm", ["run", "build:content"], {
    cwd: websiteRoot,
  });
}

async function assertMetadataIntegrity() {
  const expectedSiteUrl = (process.env.HOOKWING_SITE_URL || "https://hookwing.com").replace(/\/$/, "");
  const defaultOgPath = path.join(websiteRoot, "assets", "og", "default.png");
  await fs.access(defaultOgPath);

  const htmlFiles = await listHtmlFiles(websiteRoot);
  const htmlTargets = htmlFiles.filter((filePath) => {
    const rel = path.relative(websiteRoot, filePath);
    return !rel.startsWith("admin/") && !rel.startsWith(".preview-dist/");
  });

  const failures = [];
  for (const filePath of htmlTargets) {
    const rel = path.relative(websiteRoot, filePath);
    const html = await fs.readFile(filePath, "utf8");

    if (/(<meta[^>]+property="og:image"[^>]+default\.png|<meta[^>]+name="twitter:image"[^>]+default\.png)/i.test(html) && !html.includes(`${expectedSiteUrl}/assets/og/default.png`)) {
      failures.push(`${rel}: default OG image is not pinned to ${expectedSiteUrl}`);
    }

    if ((rel.startsWith("blog/") || rel.startsWith("docs/")) && html.includes("https://dev.hookwing.com") && expectedSiteUrl === "https://hookwing.com") {
      failures.push(`${rel}: leaked dev.hookwing.com into production build output`);
    }
  }

  if (failures.length) {
    throw new Error(`Metadata integrity check failed:\n${failures.join("\n")}`);
  }
}

async function main() {
  await runBuild();
  const first = await snapshot();
  await runBuild();
  const second = await snapshot();

  if (first !== second) {
    throw new Error("Non-deterministic content build detected.");
  }

  await assertMetadataIntegrity();

  process.stdout.write(`Deterministic content build verified: ${first}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
