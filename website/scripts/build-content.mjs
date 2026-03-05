#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const websiteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const contentRoot = path.join(websiteRoot, "content");
const blogContentDir = path.join(contentRoot, "blog");
const docsContentDir = path.join(contentRoot, "docs");
const authorsContentDir = path.join(contentRoot, "authors");
const siteUrl = process.env.HOOKWING_SITE_URL || "https://dev.hookwing.com";

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

// Headings that should NOT be auto-numbered (CSS counters skipped)
const UNNUMBERED_PATTERNS = [
  /^in short$/i,
  /^tl;?dr$/i,
  /^summary$/i,
  /^key takeaways$/i,
  /^introduction$/i,
  /^conclusion$/i,
  /^ready to /i,       // CTA headings like "Ready to ship..."
  /^where hookwing/i,  // CTA-adjacent
  /^why this matters/i, // Intro-style
  /^recap/i,           // Recap sections
];

function isUnnumberedHeading(text) {
  const plain = text.replace(/[*_`]/g, '').trim();
  return UNNUMBERED_PATTERNS.some(p => p.test(plain));
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
      const h3NoNum = isUnnumberedHeading(h3[1]) ? ' class="no-number"' : '';
      parts.push(`<h3 id="${id}"${h3NoNum}>${renderInline(h3[1])}</h3>`);
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flushParagraph();
      closeList();
      const id = ensureUniqueHeadingId(h2[1], headingIds);
      toc.push({ level: 2, text: h2[1], id });
      const h2NoNum = isUnnumberedHeading(h2[1]) ? ' class="no-number"' : '';
      parts.push(`<h2 id="${id}"${h2NoNum}>${renderInline(h2[1])}</h2>`);
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
      let renderedSrc = srcRaw;
      if (renderedSrc.startsWith("/assets/blog/") && !renderedSrc.includes("/optimized/")) {
        renderedSrc = renderedSrc.replace("/assets/blog/", "/assets/blog/optimized/").replace(/\.(png|jpg|jpeg)$/i, ".webp");
      }
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
      parts.push(`<figure><img src="${escapeHtml(renderedSrc)}" alt="${escapeHtml(altRaw)}" loading="lazy" decoding="async" />${captionHtml}</figure>`);
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
  // Returns CSS <link> tags instead of inline styles.
  // Shared CSS is in: styles/tokens.css, styles/base.css, styles/components.css, styles/pages/blog.css
  return null; // unused — see renderLayout for <link> tags
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
  <link rel="stylesheet" href="/styles/tokens.css" />
  <link rel="stylesheet" href="/styles/base.css" />
  <link rel="stylesheet" href="/styles/components.css" />
  <link rel="stylesheet" href="/styles/patterns.css" />
  <link rel="stylesheet" href="/styles/pages/blog.css" />
</head>
<body>
  <div class="page-grid-bg" aria-hidden="true"></div>
  <nav class="nav" aria-label="Main navigation">
    <div class="container">
      <div class="nav-inner">
        <a href="/" class="nav-logo" aria-label="Hookwing - home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M21 3L3 10.5l7.5 3L14 21l7-18z"/>
            <path d="M10.5 13.5L14 10"/>
          </svg>
          Hookwing
        </a>
        <ul class="nav-links" role="list">
          <li><a href="/why-hookwing/" class="nav-link">Why Hookwing</a></li>
          <li><a href="/playground/" class="nav-link">Playground</a></li>
          <li><a href="/pricing/" class="nav-link">Pricing</a></li>
          <li><a href="/docs/" class="nav-link">Documentation</a></li>
          <li><a href="/blog/" class="nav-link active" aria-current="page">Blog</a></li>
          <li><a href="/getting-started/" class="nav-link">Get started</a></li>
        </ul>
        <div class="nav-actions">
          <button class="btn btn-ghost btn-md" id="theme-toggle" aria-label="Toggle dark mode">
            <svg class="icon-moon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6.5 6.5 0 1 0 7 7z" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <svg class="icon-sun" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
              <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <a href="/signin/" class="nav-signin">Sign in</a>
          <a href="/getting-started/" class="btn btn-primary btn-md nav-cta">Start free</a>
        </div>
        <button class="nav-hamburger" id="nav-toggle" aria-expanded="false" aria-controls="nav-mobile" aria-label="Toggle navigation menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </nav>
  <div id="nav-mobile" class="nav-mobile" aria-hidden="true">
    <nav aria-label="Mobile navigation links">
      <ul class="nav-mobile-links" role="list">
        <li><a href="/why-hookwing/" class="nav-mobile-link">Why Hookwing</a></li>
        <li><a href="/playground/" class="nav-mobile-link">Playground</a></li>
        <li><a href="/pricing/" class="nav-mobile-link">Pricing</a></li>
        <li><a href="/docs/" class="nav-mobile-link">Documentation</a></li>
        <li><a href="/blog/" class="nav-mobile-link">Blog</a></li>
        <li><a href="/getting-started/" class="nav-mobile-link">Get started</a></li>
        <li><a href="/signin/" class="nav-mobile-link">Sign in</a></li>
      </ul>
    </nav>
    <div class="nav-mobile-actions">
      <a href="/getting-started/" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;">Start free</a>
      <a href="/playground/" class="nav-mobile-link">Try the playground</a>
    </div>
  </div>
  <main id="main-content">
    <div class="shell">
      ${content}
    </div>
  </main>
  <footer class="footer" aria-label="Site footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand-wrap">
          <a href="/" class="footer-brand-name" aria-label="Hookwing home">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
              <path d="M21 3L3 10.5l7.5 3L14 21l7-18z"/>
              <path d="M10.5 13.5L14 10"/>
            </svg>
            Hookwing
          </a>
          <p class="footer-brand-desc">Webhook infrastructure for developers and agents. Test free. Ship with confidence.</p>
          <a href="/status/" class="footer-status" style="margin-top:var(--space-4);display:inline-flex;" target="_blank" rel="noopener noreferrer" aria-label="System status: all systems operational">
            <span class="status-dot" aria-hidden="true"></span>
            All systems operational
          </a>
        </div>
        <div>
          <p class="footer-col-heading">Product</p>
          <ul class="footer-links" role="list">
            <li><a href="/playground/" class="footer-link">Playground</a></li>
            <li><a href="/pricing/" class="footer-link">Pricing</a></li>
            <li><a href="/docs/" class="footer-link">Docs</a></li>
            <li><a href="/getting-started/" class="footer-link">Agent integrations</a></li>
          </ul>
        </div>
        <div>
          <p class="footer-col-heading">Developers</p>
          <ul class="footer-links" role="list">
            <li><a href="/getting-started/" class="footer-link">API reference</a></li>
            <li><a href="/getting-started/" class="footer-link">Getting started</a></li>
            <li><a href="/docs/" class="footer-link">OpenAPI spec</a></li>
            <li><a href="/status/" class="footer-link">Status page</a></li>
          </ul>
        </div>
        <div>
          <p class="footer-col-heading">Company</p>
          <ul class="footer-links" role="list">
            <li><a href="/why-hookwing/" class="footer-link">Why Hookwing</a></li>
            <li><a href="/blog/" class="footer-link">Blog</a></li>
            <li><a href="mailto:hello@hookwing.com" class="footer-link">Contact</a></li>
          </ul>
          <p class="footer-col-heading" style="margin-top:var(--space-6);">Legal</p>
          <ul class="footer-links" role="list">
            <li><a href="/privacy/" class="footer-link">Privacy policy</a></li>
            <li><a href="/terms/" class="footer-link">Terms of service</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-copy">&copy; ${new Date().getFullYear()} Hookwing Inc. All rights reserved.</p>
        <p class="footer-copy" style="color:rgba(255,255,255,.25);">Built for developers and AI agents.</p>
      </div>
    </div>
  </footer>
  <script>
    (function(){
      var saved=localStorage.getItem('theme'),prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
      if(saved){document.documentElement.dataset.theme=saved}else if(prefersDark){document.documentElement.dataset.theme='dark'}
      var tt=document.getElementById('theme-toggle');if(tt){tt.addEventListener('click',function(){var c=document.documentElement.dataset.theme||'light';var n=c==='dark'?'light':'dark';document.documentElement.dataset.theme=n;localStorage.setItem('theme',n)})}
      var toggle=document.getElementById('nav-toggle'),mobileNav=document.getElementById('nav-mobile');
      if(toggle&&mobileNav){toggle.addEventListener('click',function(){var e=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!e));mobileNav.classList.toggle('is-open',!e);mobileNav.setAttribute('aria-hidden',String(e))});document.addEventListener('click',function(e){if(mobileNav.classList.contains('is-open')&&!mobileNav.contains(e.target)&&!toggle.contains(e.target)){toggle.setAttribute('aria-expanded','false');mobileNav.classList.remove('is-open');mobileNav.setAttribute('aria-hidden','true')}});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&mobileNav.classList.contains('is-open')){toggle.setAttribute('aria-expanded','false');mobileNav.classList.remove('is-open');mobileNav.setAttribute('aria-hidden','true');toggle.focus()}});mobileNav.querySelectorAll('a').forEach(function(l){l.addEventListener('click',function(){toggle.setAttribute('aria-expanded','false');mobileNav.classList.remove('is-open');mobileNav.setAttribute('aria-hidden','true')})})}
      var yr=document.getElementById('footer-year');if(yr)yr.textContent=new Date().getFullYear();
    })();
  </script>
</body>
</html>`;
}

function renderPostCard(post) {
  const tagChip = post.tags.slice(0, 3).map((tag) => `<a class="chip" href="/blog/tags/${escapeHtml(slugify(tag))}/">${escapeHtml(tag)}</a>`).join(" ");
  const authorName = post.author ? post.author.name : "";
  return `<article class="card" style="display:flex;flex-direction:column;">
    ${post.heroImage ? `<a class="card-hero" href="/blog/${escapeHtml(post.slug)}/"><img src="${escapeHtml(post.heroImage)}" alt="${escapeHtml(post.heroImageAlt || post.title)}" loading="lazy" decoding="async" /></a>` : ""}
    <h3 style="flex:0;"><a href="/blog/${escapeHtml(post.slug)}/">${escapeHtml(post.title)}</a></h3>
    <div class="meta">
      <span>${escapeHtml(formatDate(post.publishDate))}</span>
      <span>•</span>
      <span>${escapeHtml(post.readingTime)}</span>
      <span>•</span>
      <a href="/blog/categories/${escapeHtml(slugify(post.category))}/">${escapeHtml(post.category)}</a>
    </div>
    ${authorName ? `<div style="font-size:.85rem;color:var(--color-ink-muted);margin:-4px 0 8px;">By ${escapeHtml(authorName)}</div>` : ""}
    <p style="flex:1;">${escapeHtml(post.description)}</p>
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
    <div class="toc-title"><span>On this page</span><span>${toc.length}</span></div>
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

  const content = `<article class="panel article-panel">
    <header class="article-header">
      <span class="post-eyebrow">${escapeHtml(post.category)}</span>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="lede">${escapeHtml(post.description)}</p>
    </header>
    <div class="post-meta-stack" aria-label="Post metadata">
      <section class="post-author">
        <img class="author-avatar" src="${escapeHtml(post.author.avatar)}" alt="${escapeHtml(post.author.name)} avatar" />
        <div>
          <div class="author-name"><a href="/blog/authors/${escapeHtml(slugify(post.author.slug || post.author.name))}/">${escapeHtml(post.author.name)}</a></div>
          <div class="meta" style="margin:4px 0 0">${escapeHtml(post.author.role)}</div>
        </div>
      </section>
      <div class="post-dates">
        <span class="meta-item">Published ${escapeHtml(formatDate(post.publishDate))}</span>
        <span class="meta-item">Updated ${escapeHtml(formatDate(post.updatedDate))}</span>
        <span class="meta-item">${escapeHtml(post.readingTime)}</span>
      </div>
      <div class="post-dates">
        <span class="meta-item"><a href="/blog/categories/${escapeHtml(slugify(post.category))}/">${escapeHtml(post.category)}</a></span>
        ${tags}
      </div>
    </div>
    ${post.heroImage ? `<figure class="hero"><div class="hero-media"><img src="${escapeHtml(post.heroImage)}" alt="${escapeHtml(post.heroImageAlt)}" loading="eager" decoding="async" fetchpriority="high" /></div><figcaption>${escapeHtml(post.heroImageAlt)}</figcaption></figure>` : ""}
    <div class="article-layout">
      ${renderToc(post.toc)}
      <div class="article-body">${post.bodyHtml}</div>
    </div>
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
