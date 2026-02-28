#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const websiteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const contentRoot = path.join(websiteRoot, "content");
const blogContentDir = path.join(contentRoot, "blog");
const docsContentDir = path.join(contentRoot, "docs");

function escapeHtml(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) return { data: {}, body: markdown };
  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: markdown };

  const frontmatterRaw = markdown.slice(4, end);
  const body = markdown.slice(end + 5).trim();
  const data = {};

  for (const rawLine of frontmatterRaw.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value === "true" || value === "false") {
      value = value === "true";
    }
    data[key] = value;
  }

  return { data, body };
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safeHref = escapeHtml(href);
    return `<a href="${safeHref}">${escapeHtml(label)}</a>`;
  });
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  return out;
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const parts = [];
  let inList = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    parts.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!inList) return;
    parts.push("</ul>");
    inList = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      closeList();
      parts.push(`<h3>${renderInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      closeList();
      parts.push(`<h2>${renderInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      closeList();
      parts.push(`<h1>${renderInline(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      if (!inList) {
        parts.push("<ul>");
        inList = true;
      }
      parts.push(`<li>${renderInline(trimmed.slice(2))}</li>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return parts.join("\n");
}

function buildPage({ siteTitle, title, summary, dateLabel, htmlBody }) {
  const safeTitle = escapeHtml(title);
  const safeSummary = summary ? `<p class="summary">${escapeHtml(summary)}</p>` : "";
  const safeDate = dateLabel ? `<p class="meta">${escapeHtml(dateLabel)}</p>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} | ${escapeHtml(siteTitle)}</title>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.62;max-width:860px;margin:40px auto;padding:0 18px;color:#111}
    h1,h2,h3{line-height:1.25}
    a{color:#0a57b5}
    .meta{font-size:14px;color:#4b5563}
    .summary{background:#f7fafc;border-left:4px solid #3182ce;padding:12px 14px;border-radius:8px}
    code{background:#f3f4f6;padding:2px 5px;border-radius:6px}
    ul{padding-left:20px}
  </style>
</head>
<body>
  <a href="/">Hookwing</a>
  <article>
    <h1>${safeTitle}</h1>
    ${safeDate}
    ${safeSummary}
    ${htmlBody}
  </article>
</body>
</html>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readMarkdownFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

async function buildCollection({ inputDir, outputDir, kind }) {
  const files = await readMarkdownFiles(inputDir);
  const listing = [];

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const slug = data.slug || path.basename(filePath, ".md");
    const title = data.title || slug;
    const summary = typeof data.summary === "string" ? data.summary : "";
    const dateField = kind === "blog" ? data.date : data.updatedAt;
    const dateLabel = typeof dateField === "string" && dateField ? dateField.slice(0, 10) : "";
    const rendered = markdownToHtml(body);

    const pageHtml = buildPage({
      siteTitle: "Hookwing",
      title,
      summary,
      dateLabel,
      htmlBody: rendered,
    });

    const pageDir = path.join(outputDir, slug);
    await ensureDir(pageDir);
    await fs.writeFile(path.join(pageDir, "index.html"), pageHtml, "utf8");

    listing.push({ slug, title, summary, dateLabel });
  }

  return listing.sort((a, b) => (a.dateLabel < b.dateLabel ? 1 : -1));
}

function buildIndexPage({ title, basePath, items }) {
  const links = items
    .map((item) => {
      const meta = item.dateLabel ? ` <span style="color:#4b5563">(${escapeHtml(item.dateLabel)})</span>` : "";
      const summary = item.summary ? `<div style="color:#374151">${escapeHtml(item.summary)}</div>` : "";
      return `<li><a href="/${basePath}/${escapeHtml(item.slug)}/">${escapeHtml(item.title)}</a>${meta}${summary}</li>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | Hookwing</title>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.62;max-width:860px;margin:40px auto;padding:0 18px;color:#111}
    ul{padding-left:20px}
  </style>
</head>
<body>
  <a href="/">Hookwing</a>
  <h1>${escapeHtml(title)}</h1>
  <ul>
    ${links}
  </ul>
</body>
</html>`;
}

async function main() {
  const blogOut = path.join(websiteRoot, "blog");
  const docsOut = path.join(websiteRoot, "docs");
  await ensureDir(blogOut);
  await ensureDir(docsOut);

  const blogItems = await buildCollection({ inputDir: blogContentDir, outputDir: blogOut, kind: "blog" });
  const docsItems = await buildCollection({ inputDir: docsContentDir, outputDir: docsOut, kind: "docs" });

  await fs.writeFile(path.join(blogOut, "index.html"), buildIndexPage({ title: "Blog", basePath: "blog", items: blogItems }), "utf8");
  await fs.writeFile(path.join(docsOut, "index.html"), buildIndexPage({ title: "Docs", basePath: "docs", items: docsItems }), "utf8");

  process.stdout.write(`Built ${blogItems.length} blog page(s) and ${docsItems.length} docs page(s).\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
