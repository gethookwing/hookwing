#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const websiteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const contentRoot = path.join(websiteRoot, "content");
const blogContentDir = path.join(contentRoot, "blog");
const docsContentDir = path.join(contentRoot, "docs");

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseScalar(value) {
  const raw = value.trim();
  if (!raw) return "";
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (raw === "true" || raw === "false") return raw === "true";
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((token) => parseScalar(token));
  }
  return raw;
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) return { data: {}, body: markdown };
  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: markdown };

  const frontmatterRaw = markdown.slice(4, end);
  const body = markdown.slice(end + 5).trim();
  const data = {};
  const stack = [{ indent: -1, obj: data }];

  for (const rawLine of frontmatterRaw.split("\n")) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const valuePart = line.slice(sep + 1).trim();
    const current = stack[stack.length - 1].obj;

    if (!valuePart) {
      current[key] = {};
      stack.push({ indent, obj: current[key] });
      continue;
    }
    current[key] = parseScalar(valuePart);
  }

  return { data, body };
}

function formatDate(input) {
  if (!input) return "";
  return String(input).slice(0, 10);
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function estimateReadingTime(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} min read`;
}

function normalizeBlogMeta(raw, filePath, body) {
  const title = raw.title || path.basename(filePath, ".md");
  const slug = raw.slug || slugify(title);
  const author = typeof raw.author === "object" && raw.author ? raw.author : {};
  return {
    title,
    slug,
    description: raw.description || raw.summary || "",
    author: {
      name: author.name || "Hookwing Team",
      role: author.role || "Engineering",
      avatar: author.avatar || "/assets/logos/logo-03-air-route-badge.svg",
    },
    publishDate: raw.publishDate || raw.date || "",
    updatedDate: raw.updatedDate || raw.publishDate || raw.date || "",
    tags: ensureArray(raw.tags),
    category: raw.category || "General",
    readingTime: raw.readingTime || estimateReadingTime(body),
    heroImage: raw.heroImage || "",
    heroImageAlt: raw.heroImageAlt || `${title} hero image`,
    draft: Boolean(raw.draft),
  };
}

function normalizeDocsMeta(raw, filePath) {
  const title = raw.title || path.basename(filePath, ".md");
  const slug = raw.slug || slugify(title);
  return {
    title,
    slug,
    summary: raw.summary || "",
    updatedAt: raw.updatedAt || "",
  };
}

function renderInline(text) {
  const codeTokens = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_m, code) => {
    const token = `__CODE_${codeTokens.length}__`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_m, label, href) => {
    const safeHref = escapeHtml(href);
    return `<a href="${safeHref}">${escapeHtml(label)}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(>])\*([^*]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");

  for (let i = 0; i < codeTokens.length; i += 1) {
    out = out.replace(`__CODE_${i}__`, codeTokens[i]);
  }
  return out;
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const parts = [];
  let paragraph = [];
  let listType = null;
  let inCodeBlock = false;
  let codeFenceLanguage = "";
  let codeBlockLines = [];
  let quoteLines = [];

  const closeList = () => {
    if (!listType) return;
    parts.push(`</${listType}>`);
    listType = null;
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    parts.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushCodeBlock = () => {
    if (!inCodeBlock) return;
    const languageClass = codeFenceLanguage ? ` class="language-${escapeHtml(codeFenceLanguage)}"` : "";
    parts.push(`<pre><code${languageClass}>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`);
    inCodeBlock = false;
    codeFenceLanguage = "";
    codeBlockLines = [];
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;
    const quoteHtml = quoteLines.map((line) => `<p>${renderInline(line)}</p>`).join("");
    parts.push(`<blockquote>${quoteHtml}</blockquote>`);
    quoteLines = [];
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx].trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      closeList();
      flushQuote();
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        inCodeBlock = true;
        codeFenceLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeList();
      flushQuote();
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      closeList();
      quoteLines.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    flushQuote();

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

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/);
    if (imageMatch) {
      flushParagraph();
      closeList();
      const [, altRaw, srcRaw, titleRaw] = imageMatch;
      let caption = titleRaw ? titleRaw.trim() : "";
      if (!caption) {
        const nextLine = (lines[idx + 1] || "").trim();
        const captionMatch = nextLine.match(/^\*([^*]+)\*$/);
        if (captionMatch) {
          caption = captionMatch[1].trim();
          idx += 1;
        }
      }
      const safeAlt = escapeHtml(altRaw);
      const safeSrc = escapeHtml(srcRaw);
      const captionHtml = caption ? `<figcaption class="caption">${renderInline(caption)}</figcaption>` : "";
      parts.push(`<figure><img src="${safeSrc}" alt="${safeAlt}" loading="lazy" />${captionHtml}</figure>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        parts.push("<ul>");
        listType = "ul";
      }
      parts.push(`<li>${renderInline(trimmed.slice(2))}</li>`);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        parts.push("<ol>");
        listType = "ol";
      }
      parts.push(`<li>${renderInline(orderedMatch[1])}</li>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushCodeBlock();
  flushParagraph();
  closeList();
  flushQuote();
  return parts.join("\n");
}

function siteStyles() {
  return `
    :root{
      --bg:#f4f7fb;
      --paper:#ffffff;
      --ink:#101828;
      --muted:#475467;
      --line:#d0d5dd;
      --accent:#1451b8;
      --chip:#e9f2ff;
      --max:1100px;
      --radius:14px;
    }
    *{box-sizing:border-box}
    body{margin:0;background:radial-gradient(circle at 10% 0%,#e7f0ff 0,#f4f7fb 48%,#f8fafc 100%);color:var(--ink);font-family:ui-sans-serif,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6}
    a{color:var(--accent);text-decoration:none}
    a:hover{text-decoration:underline}
    .shell{max-width:var(--max);margin:0 auto;padding:22px 18px 40px}
    .topnav{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:10px 0 18px}
    .brand{font-weight:800;letter-spacing:.2px;color:#0f172a}
    .navlinks{display:flex;gap:14px;flex-wrap:wrap}
    .panel{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:20px}
    .lede{font-size:1.05rem;color:var(--muted)}
    .grid{display:grid;gap:16px}
    .cards{grid-template-columns:repeat(1,minmax(0,1fr))}
    .card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:16px}
    .meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:.92rem;margin:8px 0 12px}
    .chip{display:inline-block;background:var(--chip);color:#0b3c95;border:1px solid #c8dcff;border-radius:999px;padding:3px 9px;font-size:.78rem;font-weight:600}
    .hero{margin:14px 0 18px}
    .hero img{width:100%;height:auto;border-radius:12px;border:1px solid var(--line)}
    .hero figcaption,.caption{font-size:.88rem;color:var(--muted);margin-top:6px}
    article h1, article h2, article h3{line-height:1.25}
    article h1{font-size:2rem;margin:0 0 8px}
    article h2{margin-top:1.7rem}
    article p{margin:.75rem 0}
    article ul,article ol{padding-left:1.2rem}
    article blockquote{margin:1rem 0;padding:10px 14px;border-left:4px solid #99baf2;background:#eef4ff;border-radius:8px}
    code{background:#eef2f7;padding:2px 5px;border-radius:5px}
    pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:10px;overflow:auto}
    pre code{background:transparent;padding:0}
    .cta{margin-top:26px;background:#f0f6ff;border:1px solid #c8dcff;border-radius:12px;padding:16px}
    .footer-note{margin-top:28px;color:var(--muted);font-size:.92rem}
    @media (min-width:700px){
      .shell{padding:28px 24px 46px}
      .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media (min-width:1024px){
      .shell{padding:34px 30px 60px}
      .cards{grid-template-columns:repeat(3,minmax(0,1fr))}
    }
  `;
}

function renderLayout({ title, description, content, nav = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${escapeHtml(description || "")}" />
  <title>${escapeHtml(title)} | Hookwing</title>
  <style>${siteStyles()}</style>
</head>
<body>
  <div class="shell">
    <header class="topnav">
      <a class="brand" href="/">Hookwing</a>
      <nav class="navlinks">
        <a href="/blog/">Blog</a>
        <a href="/docs/">Docs</a>
        ${nav}
      </nav>
    </header>
    ${content}
    <footer class="footer-note">Built from Tina-managed markdown content.</footer>
  </div>
</body>
</html>`;
}

function renderPostCard(post) {
  const tagChip = post.tags.slice(0, 2).map((tag) => `<a class="chip" href="/blog/tags/${escapeHtml(slugify(tag))}/">${escapeHtml(tag)}</a>`).join(" ");
  return `<article class="card">
    <h3><a href="/blog/${escapeHtml(post.slug)}/">${escapeHtml(post.title)}</a></h3>
    <div class="meta">
      <span>${escapeHtml(formatDate(post.publishDate))}</span>
      <span>•</span>
      <span>${escapeHtml(post.readingTime)}</span>
      <span>•</span>
      <a href="/blog/categories/${escapeHtml(slugify(post.category))}/">${escapeHtml(post.category)}</a>
    </div>
    <p>${escapeHtml(post.description)}</p>
    <div>${tagChip}</div>
  </article>`;
}

function renderBlogIndex(posts) {
  const cards = posts.map((post) => renderPostCard(post)).join("\n");
  return renderLayout({
    title: "Blog",
    description: "Hookwing engineering and delivery insights",
    content: `<section class="panel">
      <h1>Hookwing Blog</h1>
      <p class="lede">Reliable webhook operations, deployment workflow, and platform engineering notes.</p>
    </section>
    <section class="grid cards" style="margin-top:16px">${cards}</section>`,
  });
}

function renderBlogPost(post) {
  const tags = post.tags.map((tag) => `<a class="chip" href="/blog/tags/${escapeHtml(slugify(tag))}/">${escapeHtml(tag)}</a>`).join(" ");
  const content = `<article class="panel">
    <h1>${escapeHtml(post.title)}</h1>
    <p class="lede">${escapeHtml(post.description)}</p>
    <div class="meta">
      <a href="/blog/authors/${escapeHtml(slugify(post.author.name))}/">${escapeHtml(post.author.name)}</a>
      <span>•</span>
      <span>${escapeHtml(post.author.role)}</span>
      <span>•</span>
      <span>${escapeHtml(formatDate(post.publishDate))}</span>
      <span>•</span>
      <span>${escapeHtml(post.readingTime)}</span>
      <span>•</span>
      <a href="/blog/categories/${escapeHtml(slugify(post.category))}/">${escapeHtml(post.category)}</a>
    </div>
    <div>${tags}</div>
    ${post.heroImage ? `<figure class="hero"><img src="${escapeHtml(post.heroImage)}" alt="${escapeHtml(post.heroImageAlt)}" /><figcaption>${escapeHtml(post.heroImageAlt)}</figcaption></figure>` : ""}
    ${post.bodyHtml}
    <section class="cta">
      <h3>Ship reliable events with less manual recovery</h3>
      <p>Use Hookwing delivery controls to combine retries, idempotency, and replay into one workflow.</p>
      <a href="/docs/getting-started/">Read docs</a>
    </section>
  </article>`;
  return renderLayout({
    title: post.title,
    description: post.description,
    content,
    nav: `<a href="/blog/">All Posts</a>`,
  });
}

function renderFilteredIndex({ title, subtitle, posts }) {
  const cards = posts.map((post) => renderPostCard(post)).join("\n");
  return renderLayout({
    title,
    description: subtitle,
    content: `<section class="panel">
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(subtitle)}</p>
    </section>
    <section class="grid cards" style="margin-top:16px">${cards}</section>`,
  });
}

function renderAuthorPage({ authorName, authorRole, authorAvatar, posts }) {
  const cards = posts.map((post) => renderPostCard(post)).join("\n");
  return renderLayout({
    title: `Author: ${authorName}`,
    description: `Posts by ${authorName}`,
    content: `<section class="panel">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <img src="${escapeHtml(authorAvatar)}" alt="${escapeHtml(authorName)} avatar" style="width:60px;height:60px;border-radius:999px;border:1px solid #d0d5dd;background:white;padding:8px" />
        <div>
          <h1 style="margin:0">${escapeHtml(authorName)}</h1>
          <p class="lede" style="margin:0">${escapeHtml(authorRole)}</p>
        </div>
      </div>
    </section>
    <section class="grid cards" style="margin-top:16px">${cards}</section>`,
  });
}

function renderDocsIndex(docs) {
  const cards = docs
    .map((doc) => `<article class="card">
      <h3><a href="/docs/${escapeHtml(doc.slug)}/">${escapeHtml(doc.title)}</a></h3>
      <div class="meta"><span>${escapeHtml(formatDate(doc.updatedAt))}</span></div>
      <p>${escapeHtml(doc.summary)}</p>
    </article>`)
    .join("\n");
  return renderLayout({
    title: "Docs",
    description: "Hookwing documentation",
    content: `<section class="panel">
      <h1>Documentation</h1>
      <p class="lede">Product setup, webhook delivery behavior, and integration guides.</p>
    </section>
    <section class="grid cards" style="margin-top:16px">${cards}</section>`,
  });
}

function renderDocsArticle(doc) {
  return renderLayout({
    title: doc.title,
    description: doc.summary,
    nav: `<a href="/docs/">Docs Home</a>`,
    content: `<article class="panel">
      <h1>${escapeHtml(doc.title)}</h1>
      <div class="meta"><span>Updated ${escapeHtml(formatDate(doc.updatedAt))}</span></div>
      <p class="lede">${escapeHtml(doc.summary)}</p>
      ${doc.bodyHtml}
    </article>`,
  });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writePage(filePath, html) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, html, "utf8");
}

async function readMarkdownFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.join(dir, entry.name))
      .sort();
  } catch {
    return [];
  }
}

function groupPosts(posts, getter) {
  const map = new Map();
  for (const post of posts) {
    const values = getter(post);
    for (const value of values) {
      const key = slugify(value);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { label: value, posts: [] });
      map.get(key).posts.push(post);
    }
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function buildBlog(publishedPosts) {
  const blogRoot = path.join(websiteRoot, "blog");
  await writePage(path.join(blogRoot, "index.html"), renderBlogIndex(publishedPosts));

  for (const post of publishedPosts) {
    await writePage(path.join(blogRoot, post.slug, "index.html"), renderBlogPost(post));
  }

  const tags = groupPosts(publishedPosts, (post) => post.tags);
  for (const [slug, group] of tags) {
    await writePage(
      path.join(blogRoot, "tags", slug, "index.html"),
      renderFilteredIndex({
        title: `Tag: ${group.label}`,
        subtitle: `Posts tagged with ${group.label}.`,
        posts: group.posts,
      }),
    );
  }

  const categories = groupPosts(publishedPosts, (post) => [post.category]);
  for (const [slug, group] of categories) {
    await writePage(
      path.join(blogRoot, "categories", slug, "index.html"),
      renderFilteredIndex({
        title: `Category: ${group.label}`,
        subtitle: `Posts in ${group.label}.`,
        posts: group.posts,
      }),
    );
  }

  const authors = groupPosts(publishedPosts, (post) => [post.author.name]);
  for (const [slug, group] of authors) {
    const first = group.posts[0];
    await writePage(
      path.join(blogRoot, "authors", slug, "index.html"),
      renderAuthorPage({
        authorName: first.author.name,
        authorRole: first.author.role,
        authorAvatar: first.author.avatar,
        posts: group.posts,
      }),
    );
  }

  return {
    posts: publishedPosts.length,
    tagPages: tags.size,
    categoryPages: categories.size,
    authorPages: authors.size,
  };
}

async function buildDocs(docs) {
  const docsRoot = path.join(websiteRoot, "docs");
  await writePage(path.join(docsRoot, "index.html"), renderDocsIndex(docs));
  for (const doc of docs) {
    await writePage(path.join(docsRoot, doc.slug, "index.html"), renderDocsArticle(doc));
  }
  return { docs: docs.length };
}

async function main() {
  const blogFiles = await readMarkdownFiles(blogContentDir);
  const docsFiles = await readMarkdownFiles(docsContentDir);

  const allPosts = [];
  for (const filePath of blogFiles) {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const meta = normalizeBlogMeta(data, filePath, body);
    allPosts.push({
      ...meta,
      bodyHtml: markdownToHtml(body),
    });
  }

  const sortedPosts = allPosts.sort((a, b) => String(b.publishDate).localeCompare(String(a.publishDate)));
  const publishedPosts = sortedPosts.filter((post) => !post.draft);

  const docs = [];
  for (const filePath of docsFiles) {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    docs.push({
      ...normalizeDocsMeta(data, filePath),
      bodyHtml: markdownToHtml(body),
    });
  }
  docs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const blogCounts = await buildBlog(publishedPosts);
  const docsCounts = await buildDocs(docs);

  process.stdout.write(
    `Built ${blogCounts.posts} blog posts, ${blogCounts.tagPages} tag pages, ${blogCounts.categoryPages} category pages, ${blogCounts.authorPages} author pages, ${docsCounts.docs} docs pages.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
