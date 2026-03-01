#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const websiteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const contentRoot = path.join(websiteRoot, "content");
const blogContentDir = path.join(contentRoot, "blog");
const docsContentDir = path.join(contentRoot, "docs");
const authorsContentDir = path.join(contentRoot, "authors");
const siteUrl = process.env.HOOKWING_SITE_URL || "https://design-lab.hookwing-design-lab.pages.dev";

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

function canonicalUrl(routePath) {
  const normalized = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${siteUrl}${normalized}`;
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
  return input ? String(input).slice(0, 10) : "";
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
    return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(>])\*([^*]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");

  for (let i = 0; i < codeTokens.length; i += 1) {
    out = out.replace(`__CODE_${i}__`, codeTokens[i]);
  }
  return out;
}

function ensureUniqueHeadingId(base, existing) {
  const root = slugify(base) || "section";
  let candidate = root;
  let count = 2;
  while (existing.has(candidate)) {
    candidate = `${root}-${count}`;
    count += 1;
  }
  existing.add(candidate);
  return candidate;
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const parts = [];
  const toc = [];
  const headingIds = new Set();

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

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      flushParagraph();
      closeList();
      const id = ensureUniqueHeadingId(h3[1], headingIds);
      toc.push({ level: 3, text: h3[1], id });
      parts.push(`<h3 id="${id}">${renderInline(h3[1])}</h3>`);
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flushParagraph();
      closeList();
      const id = ensureUniqueHeadingId(h2[1], headingIds);
      toc.push({ level: 2, text: h2[1], id });
      parts.push(`<h2 id="${id}">${renderInline(h2[1])}</h2>`);
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      flushParagraph();
      closeList();
      const id = ensureUniqueHeadingId(h1[1], headingIds);
      parts.push(`<h1 id="${id}">${renderInline(h1[1])}</h1>`);
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
      const captionHtml = caption ? `<figcaption class="caption">${renderInline(caption)}</figcaption>` : "";
      parts.push(`<figure><img src="${escapeHtml(srcRaw)}" alt="${escapeHtml(altRaw)}" loading="lazy" decoding="async" />${captionHtml}</figure>`);
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

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        parts.push("<ol>");
        listType = "ol";
      }
      parts.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushCodeBlock();
  flushParagraph();
  closeList();
  flushQuote();

  return { html: parts.join("\n"), toc };
}

function siteStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    :root{
      --color-bg:#FDFBF4;
      --color-surface:#FFFFFF;
      --color-ink-strong:#0B1220;
      --color-ink-muted:#475569;
      --color-brand-primary:#002A3A;
      --color-brand-action:#009D64;
      --color-brand-signal:#FFC107;
      --color-border:#DCE3EA;
      --color-focus:#86B7FE;
      --radius-control:12px;
      --radius-card:14px;
      --radius-hero:22px;
      --shadow-card:0 8px 22px rgba(2,6,23,.06);
      --max:1120px;
    }
    *{box-sizing:border-box}
    body{margin:0;background:var(--color-bg);color:var(--color-ink-strong);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6}
    h1,h2,h3,h4,.brand,.btn{font-family:Geist,Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    code,pre{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
    a{color:var(--color-brand-primary);text-decoration:none}
    a:hover{text-decoration:underline}
    .shell{max-width:var(--max);margin:0 auto;padding:24px 16px 48px}
    .topnav{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:8px 0 20px}
    .brand{font-weight:700;letter-spacing:.2px;color:var(--color-brand-primary);font-size:1.1rem}
    .navlinks{display:flex;gap:12px;flex-wrap:wrap}
    .panel{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-card);box-shadow:var(--shadow-card);padding:20px}
    .lede{font-size:1rem;color:var(--color-ink-muted);margin-top:8px}
    .grid{display:grid;gap:16px}
    .cards{grid-template-columns:repeat(1,minmax(0,1fr))}
    .card{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-card);padding:16px;box-shadow:var(--shadow-card)}
    .meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--color-ink-muted);font-size:.9rem;margin:8px 0 12px}
    .chip{display:inline-block;background:var(--color-surface);border:1px solid var(--color-border);border-radius:999px;padding:3px 9px;color:var(--color-brand-primary);font-size:.78rem;font-weight:500}
    .hero{margin:14px 0 18px}
    .hero img{width:100%;height:auto;border-radius:var(--radius-hero);border:1px solid var(--color-border)}
    .hero figcaption,.caption{font-size:.85rem;color:var(--color-ink-muted);margin-top:6px}
    article h1{font-size:2.2rem;line-height:1.15;margin:0}
    article h2{font-size:1.6rem;line-height:1.25;margin-top:1.6rem}
    article h3{font-size:1.2rem;line-height:1.3;margin-top:1.2rem}
    article p{margin:.8rem 0}
    article ul,article ol{padding-left:1.2rem}
    article blockquote{margin:1rem 0;padding:10px 14px;border-left:4px solid var(--color-brand-action);background:#F3F8F6;border-radius:10px}
    code{background:#EEF4F8;padding:2px 5px;border-radius:6px}
    pre{background:#0B1220;color:#E6EDF7;padding:12px;border-radius:12px;overflow:auto}
    pre code{background:transparent;padding:0}
    .btn-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    .btn{display:inline-block;padding:10px 14px;border-radius:12px;font-weight:600;transition:all .18s cubic-bezier(.2,.8,.2,1);outline:0}
    .btn:focus-visible{box-shadow:0 0 0 3px var(--color-focus)}
    .btn-primary{background:var(--color-brand-action);color:#fff;border:1px solid var(--color-brand-action)}
    .btn-secondary{background:#fff;color:var(--color-brand-primary);border:1px solid var(--color-brand-primary)}
    .btn:hover{text-decoration:none;transform:translateY(-1px)}
    .cta{margin-top:28px;background:#F6FAF8;border:1px solid #CBE3D9;border-radius:14px;padding:16px}
    .toc{background:#F8FAFC;border:1px solid var(--color-border);border-radius:12px;padding:14px;margin:10px 0 16px}
    .toc ul{margin:8px 0 0;padding-left:1rem}
    .toc .toc-l3{margin-left:14px}
    .search-box{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid var(--color-border);border-radius:12px;padding:10px 12px}
    .search-box input{border:0;outline:none;flex:1;font:inherit;background:transparent;color:var(--color-ink-strong)}
    .footer-note{margin-top:28px;color:var(--color-ink-muted);font-size:.9rem}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media (min-width:700px){
      .shell{padding:28px 24px 56px}
      .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
      article h1{font-size:2.5rem}
    }
    @media (min-width:1024px){
      .shell{padding:34px 30px 70px}
      .cards{grid-template-columns:repeat(3,minmax(0,1fr))}
      .article-layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;align-items:start}
      .toc{position:sticky;top:20px}
    }
  `;
}

function renderMetaTags({ title, description, canonical, ogImage, type = "website", jsonLd = null }) {
  const tags = [
    `<meta name="description" content="${escapeHtml(description || "")}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:site_name" content="Hookwing" />`,
    `<meta property="og:type" content="${escapeHtml(type)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description || "")}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description || "")}" />`,
  ];

  if (ogImage) {
    const absoluteImage = ogImage.startsWith("http") ? ogImage : `${siteUrl}${ogImage}`;
    tags.push(`<meta property="og:image" content="${escapeHtml(absoluteImage)}" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(absoluteImage)}" />`);
  }

  if (jsonLd) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
  }

  return tags.join("\n  ");
}

function renderLayout({ title, description, content, routePath, nav = "", ogImage = "", type = "website", jsonLd = null }) {
  const canonical = canonicalUrl(routePath);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${renderMetaTags({ title: `${title} | Hookwing`, description, canonical, ogImage, type, jsonLd })}
  <title>${escapeHtml(title)} | Hookwing</title>
  <style>${siteStyles()}</style>
</head>
<body>
  <div class="shell">
    <header class="topnav">
      <a class="brand" href="/">Hookwing</a>
      <nav class="navlinks" aria-label="Primary">
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
  const tagChip = post.tags.slice(0, 3).map((tag) => `<a class="chip" href="/blog/tags/${escapeHtml(slugify(tag))}/">${escapeHtml(tag)}</a>`).join(" ");
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

function renderSearchScript() {
  return `<script>
(async function(){
  const input = document.getElementById('blog-search');
  const cards = Array.from(document.querySelectorAll('[data-post-card]'));
  if (!input || cards.length === 0) return;

  let idx = [];
  try {
    const res = await fetch('/blog/search-index.json');
    idx = await res.json();
  } catch {
    idx = cards.map(function(card){
      return { slug: card.dataset.slug || '', search: (card.textContent || '').toLowerCase() };
    });
  }

  function filter() {
    const q = input.value.trim().toLowerCase();
    const keep = new Set();
    if (!q) {
      cards.forEach(function(card){ card.style.display = ''; });
      return;
    }

    idx.forEach(function(item){
      if (item.search && item.search.includes(q)) keep.add(item.slug);
    });

    cards.forEach(function(card){
      card.style.display = keep.has(card.dataset.slug || '') ? '' : 'none';
    });
  }

  input.addEventListener('input', filter);
})();
</script>`;
}

function renderBlogIndex(posts) {
  const cards = posts
    .map((post) => `<div data-post-card data-slug="${escapeHtml(post.slug)}">${renderPostCard(post)}</div>`)
    .join("\n");
  return renderLayout({
    title: "Blog",
    description: "Reliable webhook operations, deployment workflow, and platform engineering notes.",
    routePath: "/blog/",
    content: `<section class="panel">
      <h1>Hookwing Blog</h1>
      <p class="lede">Clear operating guides for delivery reliability, incident response, and production-ready webhook systems.</p>
      <div class="search-box" role="search">
        <label class="sr-only" for="blog-search">Search blog</label>
        <input id="blog-search" type="search" placeholder="Search title, summary, body, tags" autocomplete="off" />
      </div>
      <div class="btn-row" style="margin-top:12px">
        <a class="chip" href="/blog/tags/">All tags</a>
        <a class="chip" href="/blog/categories/">All categories</a>
      </div>
    </section>
    <section class="grid cards" style="margin-top:16px">${cards}</section>
    ${renderSearchScript()}`,
  });
}

function renderToc(toc) {
  if (!toc.length) return "";
  const links = toc
    .map((item) => `<li class="toc-l${item.level}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`)
    .join("\n");
  return `<aside class="toc" aria-label="Table of contents">
    <strong>On this page</strong>
    <ul>${links}</ul>
  </aside>`;
}

function renderBlogPost(post) {
  const tags = post.tags.map((tag) => `<a class="chip" href="/blog/tags/${escapeHtml(slugify(tag))}/">${escapeHtml(tag)}</a>`).join(" ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishDate,
    dateModified: post.updatedDate,
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    image: post.heroImage ? [post.heroImage.startsWith("http") ? post.heroImage : `${siteUrl}${post.heroImage}`] : [],
    mainEntityOfPage: canonicalUrl(`/blog/${post.slug}/`),
  };

  const content = `<article class="panel">
    <h1>${escapeHtml(post.title)}</h1>
    <p class="lede">${escapeHtml(post.description)}</p>
    <div class="meta" aria-label="Post metadata">
      <a href="/blog/authors/${escapeHtml(slugify(post.author.slug || post.author.name))}/">${escapeHtml(post.author.name)}</a>
      <span>•</span>
      <span>${escapeHtml(post.author.role)}</span>
      <span>•</span>
      <span>Published ${escapeHtml(formatDate(post.publishDate))}</span>
      <span>•</span>
      <span>Updated ${escapeHtml(formatDate(post.updatedDate))}</span>
      <span>•</span>
      <span>${escapeHtml(post.readingTime)}</span>
      <span>•</span>
      <a href="/blog/categories/${escapeHtml(slugify(post.category))}/">${escapeHtml(post.category)}</a>
    </div>
    <div>${tags}</div>
    ${post.heroImage ? `<figure class="hero"><img src="${escapeHtml(post.heroImage)}" alt="${escapeHtml(post.heroImageAlt)}" loading="eager" decoding="async" /><figcaption>${escapeHtml(post.heroImageAlt)}</figcaption></figure>` : ""}
    <div class="article-layout">
      ${renderToc(post.toc)}
      <div>${post.bodyHtml}</div>
    </div>
    <section class="panel" style="margin-top:22px">
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <img src="${escapeHtml(post.author.avatar)}" alt="${escapeHtml(post.author.name)} avatar" style="width:56px;height:56px;border-radius:999px;border:1px solid var(--color-border);background:white;padding:8px" />
        <div>
          <strong>${escapeHtml(post.author.name)}</strong>
          <div class="meta" style="margin:4px 0 0">${escapeHtml(post.author.role)}</div>
          <p style="margin:6px 0 0">${escapeHtml(post.author.bio || "Hookwing author")}</p>
        </div>
      </div>
    </section>
    <section class="cta">
      <h3>Ready to ship event delivery with confidence?</h3>
      <p>Start free and use retries, replay, and observability with clear operational controls.</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="/">Start free</a>
        <a class="btn btn-secondary" href="/docs/getting-started/">Read docs</a>
      </div>
    </section>
  </article>`;

  return renderLayout({
    title: post.title,
    description: post.description,
    routePath: `/blog/${post.slug}/`,
    content,
    nav: `<a href="/blog/">All posts</a>`,
    ogImage: post.heroImage,
    type: "article",
    jsonLd,
  });
}

function renderFilteredIndex({ title, subtitle, posts, routePath }) {
  const cards = posts.map((post) => renderPostCard(post)).join("\n");
  return renderLayout({
    title,
    description: subtitle,
    routePath,
    content: `<section class="panel">
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(subtitle)}</p>
    </section>
    <section class="grid cards" style="margin-top:16px">${cards}</section>`,
  });
}

function renderTaxonomyList({ title, subtitle, items, basePath, singular }) {
  const rows = items
    .map((item) => `<article class="card">
      <h3><a href="/${basePath}/${escapeHtml(item.slug)}/">${escapeHtml(item.label)}</a></h3>
      <p class="lede">${escapeHtml(item.count)} ${singular}${item.count === 1 ? "" : "s"}</p>
    </article>`)
    .join("\n");

  return renderLayout({
    title,
    description: subtitle,
    routePath: `/${basePath}/`,
    content: `<section class="panel">
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(subtitle)}</p>
    </section>
    <section class="grid cards" style="margin-top:16px">${rows}</section>`,
  });
}

function renderAuthorPage(author, posts) {
  const cards = posts.map((post) => renderPostCard(post)).join("\n");
  return renderLayout({
    title: `Author: ${author.name}`,
    description: `Posts by ${author.name}`,
    routePath: `/blog/authors/${author.slug}/`,
    content: `<section class="panel">
      <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
        <img src="${escapeHtml(author.avatar)}" alt="${escapeHtml(author.name)} avatar" style="width:60px;height:60px;border-radius:999px;border:1px solid var(--color-border);background:white;padding:8px" />
        <div>
          <h1 style="margin:0">${escapeHtml(author.name)}</h1>
          <p class="lede" style="margin:4px 0">${escapeHtml(author.role)}</p>
          <p style="margin:0">${escapeHtml(author.bio || "")}</p>
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
    routePath: "/docs/",
    content: `<section class="panel">
      <h1>Documentation</h1>
      <p class="lede">Practical setup and delivery guides with low-theme density and high readability.</p>
    </section>
    <section class="grid cards" style="margin-top:16px">${cards}</section>`,
  });
}

function renderDocsArticle(doc) {
  return renderLayout({
    title: doc.title,
    description: doc.summary,
    routePath: `/docs/${doc.slug}/`,
    nav: `<a href="/docs/">Docs home</a>`,
    content: `<article class="panel">
      <h1>${escapeHtml(doc.title)}</h1>
      <div class="meta"><span>Updated ${escapeHtml(formatDate(doc.updatedAt))}</span></div>
      <p class="lede">${escapeHtml(doc.summary)}</p>
      ${doc.bodyHtml}
    </article>`,
  });
}

function buildSitemap(routes) {
  const urls = routes
    .map((route) => `<url><loc>${escapeHtml(canonicalUrl(route))}</loc></url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function buildRss(posts) {
  const items = posts
    .map((post) => {
      const link = canonicalUrl(`/blog/${post.slug}/`);
      return `<item>
  <title>${escapeHtml(post.title)}</title>
  <link>${escapeHtml(link)}</link>
  <guid>${escapeHtml(link)}</guid>
  <description>${escapeHtml(post.description)}</description>
  <pubDate>${escapeHtml(new Date(post.publishDate || Date.now()).toUTCString())}</pubDate>
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Hookwing Blog</title>
  <link>${escapeHtml(canonicalUrl("/blog/"))}</link>
  <description>Webhook delivery and reliability insights from Hookwing.</description>
  ${items}
</channel>
</rss>`;
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

async function loadAuthors() {
  const files = await readMarkdownFiles(authorsContentDir);
  const authorsBySlug = new Map();

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf8");
    const { data } = parseFrontmatter(raw);
    const slug = data.slug || path.basename(filePath, ".md");
    authorsBySlug.set(slug, {
      slug,
      name: data.name || slug,
      role: data.role || "Hookwing Team",
      avatar: data.avatar || "/assets/logos/logo-03-air-route-badge.svg",
      bio: data.bio || "",
    });
  }

  return authorsBySlug;
}

function normalizeBlogMeta(raw, filePath, body, authorsBySlug) {
  const title = raw.title || path.basename(filePath, ".md");
  const slug = raw.slug || slugify(title);
  const authorSlug = typeof raw.author === "string" ? raw.author : "";
  const author = authorsBySlug.get(authorSlug) || {
    slug: "hookwing-team",
    name: "Hookwing Team",
    role: "Engineering",
    avatar: "/assets/logos/logo-03-air-route-badge.svg",
    bio: "",
  };

  return {
    title,
    slug,
    description: raw.description || raw.summary || "",
    author,
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

async function buildBlog(publishedPosts) {
  const blogRoot = path.join(websiteRoot, "blog");
  await writePage(path.join(blogRoot, "index.html"), renderBlogIndex(publishedPosts));

  const routes = ["/blog/"];

  for (const post of publishedPosts) {
    await writePage(path.join(blogRoot, post.slug, "index.html"), renderBlogPost(post));
    routes.push(`/blog/${post.slug}/`);
  }

  const tags = groupPosts(publishedPosts, (post) => post.tags);
  const tagList = [];
  for (const [slug, group] of tags) {
    await writePage(
      path.join(blogRoot, "tags", slug, "index.html"),
      renderFilteredIndex({
        title: `Tag: ${group.label}`,
        subtitle: `Posts tagged with ${group.label}.`,
        posts: group.posts,
        routePath: `/blog/tags/${slug}/`,
      }),
    );
    routes.push(`/blog/tags/${slug}/`);
    tagList.push({ slug, label: group.label, count: group.posts.length });
  }
  await writePage(
    path.join(blogRoot, "tags", "index.html"),
    renderTaxonomyList({
      title: "All tags",
      subtitle: "Browse topics across Hookwing blog posts.",
      items: tagList,
      basePath: "blog/tags",
      singular: "post",
    }),
  );
  routes.push("/blog/tags/");

  const categories = groupPosts(publishedPosts, (post) => [post.category]);
  const categoryList = [];
  for (const [slug, group] of categories) {
    await writePage(
      path.join(blogRoot, "categories", slug, "index.html"),
      renderFilteredIndex({
        title: `Category: ${group.label}`,
        subtitle: `Posts in ${group.label}.`,
        posts: group.posts,
        routePath: `/blog/categories/${slug}/`,
      }),
    );
    routes.push(`/blog/categories/${slug}/`);
    categoryList.push({ slug, label: group.label, count: group.posts.length });
  }
  await writePage(
    path.join(blogRoot, "categories", "index.html"),
    renderTaxonomyList({
      title: "All categories",
      subtitle: "Browse operational topics by category.",
      items: categoryList,
      basePath: "blog/categories",
      singular: "post",
    }),
  );
  routes.push("/blog/categories/");

  const authors = groupPosts(publishedPosts, (post) => [post.author.slug]);
  for (const [slug, group] of authors) {
    const author = group.posts[0].author;
    await writePage(path.join(blogRoot, "authors", slug, "index.html"), renderAuthorPage(author, group.posts));
    routes.push(`/blog/authors/${slug}/`);
  }

  const searchIndex = publishedPosts.map((post) => ({
    slug: post.slug,
    title: post.title,
    summary: post.description,
    tags: post.tags,
    search: `${post.title} ${post.description} ${post.tags.join(" ")} ${post.bodyText}`.toLowerCase(),
  }));
  await fs.writeFile(path.join(blogRoot, "search-index.json"), JSON.stringify(searchIndex, null, 2), "utf8");

  await fs.writeFile(path.join(websiteRoot, "blog", "rss.xml"), buildRss(publishedPosts), "utf8");
  routes.push("/blog/rss.xml");

  return {
    routes,
    posts: publishedPosts.length,
    tagPages: tags.size,
    categoryPages: categories.size,
    authorPages: authors.size,
  };
}

async function buildDocs(docs) {
  const docsRoot = path.join(websiteRoot, "docs");
  await writePage(path.join(docsRoot, "index.html"), renderDocsIndex(docs));
  const routes = ["/docs/"];

  for (const doc of docs) {
    await writePage(path.join(docsRoot, doc.slug, "index.html"), renderDocsArticle(doc));
    routes.push(`/docs/${doc.slug}/`);
  }

  return { docs: docs.length, routes };
}

async function main() {
  const blogFiles = await readMarkdownFiles(blogContentDir);
  const docsFiles = await readMarkdownFiles(docsContentDir);
  const authorsBySlug = await loadAuthors();

  const allPosts = [];
  for (const filePath of blogFiles) {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const meta = normalizeBlogMeta(data, filePath, body, authorsBySlug);
    const rendered = markdownToHtml(body);
    allPosts.push({
      ...meta,
      bodyHtml: rendered.html,
      toc: rendered.toc,
      bodyText: body.replace(/[#>*`\-\[\]\(\)!]/g, " "),
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
      bodyHtml: markdownToHtml(body).html,
    });
  }
  docs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const blogCounts = await buildBlog(publishedPosts);
  const docsCounts = await buildDocs(docs);

  const sitemapRoutes = ["/", ...blogCounts.routes, ...docsCounts.routes];
  await fs.writeFile(path.join(websiteRoot, "sitemap.xml"), buildSitemap(sitemapRoutes), "utf8");

  process.stdout.write(
    `Built ${blogCounts.posts} blog posts, ${blogCounts.tagPages} tag pages, ${blogCounts.categoryPages} category pages, ${blogCounts.authorPages} author pages, ${docsCounts.docs} docs pages.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
