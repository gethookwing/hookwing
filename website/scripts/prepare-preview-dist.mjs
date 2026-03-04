#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const websiteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const previewDir = path.join(websiteRoot, ".preview-dist");

async function rmrf(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(src, dst) {
  await ensureDir(dst);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

function previewIndexHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hookwing Tina CMS Dev Preview</title>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;margin:0;background:#FDFBF4;color:#0B1220}
    main{max-width:760px;margin:40px auto;padding:0 16px}
    .panel{background:#fff;border:1px solid #DCE3EA;border-radius:14px;padding:20px}
    h1{margin:0 0 10px;font-size:2rem;color:#002A3A}
    p{margin:0 0 10px;color:#475569}
    ul{padding-left:20px}
    a{color:#002A3A;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <h1>Hookwing Tina CMS Dev Preview</h1>
      <p>This preview serves only the active CMS surfaces.</p>
      <ul>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/docs/">Docs</a></li>
        <li><a href="/admin/">CMS Admin</a></li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

async function main() {
  await rmrf(previewDir);
  await ensureDir(previewDir);

  const whitelist = ["blog", "docs", "admin", "assets"];
  for (const rel of whitelist) {
    const src = path.join(websiteRoot, rel);
    const dst = path.join(previewDir, rel);
    try {
      const stat = await fs.stat(src);
      if (stat.isDirectory()) await copyDir(src, dst);
    } catch {
      // Optional directory, skip when not present.
    }
  }

  for (const file of ["sitemap.xml"]) {
    const src = path.join(websiteRoot, file);
    const dst = path.join(previewDir, file);
    try {
      await fs.copyFile(src, dst);
    } catch {
      // Skip if missing.
    }
  }

  await fs.writeFile(path.join(previewDir, "index.html"), previewIndexHtml(), "utf8");
  process.stdout.write(`Prepared preview artifact at ${path.relative(websiteRoot, previewDir)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
