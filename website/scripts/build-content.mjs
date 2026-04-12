#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("typescript", typescript);

const websiteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const contentRoot = path.join(websiteRoot, "content");
const blogContentDir = path.join(contentRoot, "blog");
const docsContentDir = path.join(contentRoot, "docs");
const authorsContentDir = path.join(contentRoot, "authors");
const siteUrl = process.env.HOOKWING_SITE_URL || "https://hookwing.com";

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

/** Convert a tag slug like "ai-agents" to "AI Agents". */
function tagTitleCase(tag) {
  const upper = { ai: "AI", mcp: "MCP", api: "API", sdk: "SDK", cli: "CLI", ux: "UX", dlq: "DLQ", tls: "TLS", http: "HTTP" };
  return String(tag)
    .split(/[-_]+/)
    .map(w => upper[w.toLowerCase()] || (w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
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

function renderDocsSearchScript() {
  return `<script>
(async function(){
  var input = document.getElementById('docs-search');
  var resultsEl = document.getElementById('docs-search-results');
  if (!input || !resultsEl) return;

  var idx = [];
  try {
    var res = await fetch('/docs/search-index.json');
    idx = await res.json();
  } catch(_e) { return; }

  function show(html) {
    resultsEl.innerHTML = html;
    resultsEl.style.display = html ? 'block' : 'none';
  }

  function search() {
    var q = input.value.trim().toLowerCase();
    if (!q) { show(''); return; }
    var matches = idx.filter(function(item){ return item.search && item.search.includes(q); });
    if (!matches.length) {
      show('<div style="padding:10px 12px;font-size:.8125rem;color:var(--color-ink-muted);">No results</div>');
      return;
    }
    var html = matches.slice(0, 8).map(function(item){
      return '<a href="/docs/' + item.slug + '/" style="display:block;padding:8px 12px;font-size:.8125rem;color:var(--color-ink-strong);text-decoration:none;border-bottom:1px solid var(--color-border);">'
        + '<div style="font-weight:600;">' + item.title + '</div>'
        + (item.summary ? '<div style="color:var(--color-ink-muted);margin-top:2px;font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.summary + '</div>' : '')
        + '</a>';
    }).join('');
    show(html);
  }

  input.addEventListener('input', search);
  input.addEventListener('keydown', function(e){ if (e.key === 'Escape') { input.value = ''; show(''); } });
  document.addEventListener('click', function(e){
    if (!input.contains(e.target) && !resultsEl.contains(e.target)) show('');
  });
})();
</script>`;
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
    const raw = codeBlockLines.join("\n");
    let highlighted;
    if (codeFenceLanguage && hljs.getLanguage(codeFenceLanguage)) {
      highlighted = hljs.highlight(raw, { language: codeFenceLanguage, ignoreIllegals: true }).value;
    } else {
      highlighted = hljs.highlightAuto(raw).value;
    }
    const langAttr = codeFenceLanguage ? ` class="hljs language-${escapeHtml(codeFenceLanguage)}"` : ' class="hljs"';
    parts.push(`<pre><code${langAttr}>${highlighted}</code></pre>`);

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

    // Markdown table: | col | col |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushParagraph();
      closeList();
      // Collect all contiguous table lines
      const tableLines = [trimmed];
      while (idx + 1 < lines.length) {
        const nextTrimmed = lines[idx + 1].trim();
        if (nextTrimmed.startsWith("|") && nextTrimmed.endsWith("|")) {
          tableLines.push(nextTrimmed);
          idx += 1;
        } else {
          break;
        }
      }
      if (tableLines.length >= 2) {
        const parseRow = (row) =>
          row.split("|").slice(1, -1).map((c) => c.trim());
        const headers = parseRow(tableLines[0]);
        // Check for separator row (|---|---|)
        const hasSeparator = /^\|[\s:|-]+\|$/.test(tableLines[1]);
        const dataStart = hasSeparator ? 2 : 1;
        let tableHtml = '<table><thead><tr>';
        for (const h of headers) {
          tableHtml += `<th>${renderInline(h)}</th>`;
        }
        tableHtml += '</tr></thead><tbody>';
        for (let r = dataStart; r < tableLines.length; r += 1) {
          const cells = parseRow(tableLines[r]);
          tableHtml += '<tr>';
          for (const c of cells) {
            tableHtml += `<td>${renderInline(c)}</td>`;
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table>';
        parts.push(tableHtml);
      }
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
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    :root{
      --primitive-blue-950:#001A24;--primitive-blue-900:#002A3A;--primitive-blue-800:#003D54;--primitive-blue-700:#005070;--primitive-blue-100:#E8F4F9;--primitive-blue-50:#F4F9FC;
      --primitive-green-700:#006B44;--primitive-green-600:#009D64;--primitive-green-500:#00C07A;--primitive-green-100:#D6F5E9;--primitive-green-50:#EDFAF4;
      --primitive-yellow-600:#E6A800;--primitive-yellow-500:#FFC107;--primitive-yellow-400:#FFCD38;--primitive-yellow-100:#FFF3CC;--primitive-yellow-50:#FFFAE8;
      --primitive-neutral-950:#0B1220;--primitive-neutral-800:#1E293B;--primitive-neutral-700:#475569;--primitive-neutral-400:#94A3B8;--primitive-neutral-200:#DCE3EA;--primitive-neutral-100:#F1F5F9;--primitive-neutral-50:#FDFBF4;--primitive-white:#FFFFFF;
      --primitive-red-600:#DC2626;--primitive-red-100:#FEE2E2;
      --color-bg:var(--primitive-neutral-50);--color-surface:var(--primitive-white);--color-surface-raised:var(--primitive-neutral-100);--color-surface-overlay:rgba(0,42,58,.04);
      --color-ink-strong:var(--primitive-neutral-950);--color-ink-base:var(--primitive-neutral-800);--color-ink-muted:var(--primitive-neutral-700);--color-ink-disabled:var(--primitive-neutral-400);--color-ink-inverse:var(--primitive-white);
      --color-brand-primary:var(--primitive-blue-900);--color-brand-secondary:var(--primitive-blue-800);--color-brand-action:var(--primitive-green-600);--color-brand-action-hover:var(--primitive-green-700);--color-brand-signal:var(--primitive-yellow-500);
      --color-border:var(--primitive-neutral-200);--color-border-strong:var(--primitive-neutral-400);--color-border-brand:var(--primitive-green-600);
      --color-focus:#86B7FE;--color-hover-overlay:rgba(0,42,58,.05);
      --color-success:var(--primitive-green-600);--color-success-bg:var(--primitive-green-50);--color-warning:var(--primitive-yellow-500);--color-warning-bg:var(--primitive-yellow-50);--color-error:var(--primitive-red-600);--color-error-bg:var(--primitive-red-100);
      --font-display:'Space Grotesk',system-ui,sans-serif;--font-body:'Inter',system-ui,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;
      --space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--space-7:40px;--space-8:48px;--space-9:64px;--space-10:80px;--space-11:96px;--space-12:128px;
      --radius-xs:4px;--radius-sm:8px;--radius-md:12px;--radius-lg:16px;--radius-xl:24px;--radius-full:9999px;
      --shadow-sm:0 1px 3px rgba(2,6,23,.06);--shadow-md:0 4px 12px rgba(2,6,23,.08);--shadow-lg:0 8px 22px rgba(2,6,23,.10);--shadow-xl:0 20px 44px rgba(2,6,23,.14);--shadow-focus:0 0 0 3px var(--color-focus);--shadow-brand:0 4px 16px rgba(0,157,100,.25);
      --dur-instant:60ms;--dur-fast:120ms;--dur-base:200ms;--dur-slow:320ms;--ease:cubic-bezier(.2,.8,.2,1);--ease-decel:cubic-bezier(.0,.0,.2,1);--ease-spring:cubic-bezier(.34,1.56,.64,1);
      --container-sm:640px;--container-md:800px;--container-lg:1120px;--container-xl:1280px;--nav-height:64px;
    }
    
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{font-family:var(--font-body);font-size:16px;line-height:1.625;color:var(--color-ink-strong);background:var(--color-bg);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;scroll-behavior:smooth;overflow-x:hidden}
    body{min-height:100dvh;display:flex;flex-direction:column;overflow-x:hidden}
    main{flex:1}
    h1,h2,h3,h4,h5{font-family:var(--font-display);font-weight:700;color:var(--color-ink-strong)}
    h1{font-size:52px;line-height:60px;letter-spacing:-.02em}
    h2{font-size:38px;line-height:48px;font-weight:600}
    h3{font-size:28px;line-height:36px;font-weight:600}
    h4{font-size:22px;line-height:30px;font-weight:600}
    h5{font-size:18px;line-height:26px;font-weight:600}
    p{max-width:70ch}p+p{margin-top:var(--space-4)}
    a{color:var(--color-brand-action);text-decoration:none;transition:color var(--dur-fast) var(--ease)}
    a:hover{color:var(--color-brand-action-hover)}
    a:focus-visible{outline:none;box-shadow:var(--shadow-focus);border-radius:var(--radius-xs)}
    img{max-width:100%;display:block}
    ul{list-style:none}
    code,pre{font-family:var(--font-mono)}
    .container{width:100%;max-width:var(--container-xl);margin:0 auto;padding:0 var(--space-4)}
    @media(min-width:640px){.container{padding:0 var(--space-6)}}
    @media(min-width:1024px){.container{padding:0 var(--space-8)}}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);font-family:var(--font-body);font-size:16px;font-weight:500;line-height:24px;border:none;cursor:pointer;text-decoration:none;transition:all var(--dur-fast) var(--ease);white-space:nowrap}
    .btn:active{transform:scale(.98)}
    .btn:focus-visible{box-shadow:var(--shadow-focus);outline:none}
    .btn:disabled{opacity:.4;pointer-events:none}
    .btn-lg{height:48px;padding:0 var(--space-5);border-radius:var(--radius-md);font-size:16px}
    .btn-md{height:40px;padding:0 var(--space-4);border-radius:var(--radius-md)}
    .btn-sm{height:32px;padding:0 var(--space-3);border-radius:var(--radius-md);font-size:14px;font-weight:500}
    .btn-primary{background:var(--color-brand-action);color:#fff;box-shadow:var(--shadow-brand)}
    .btn-primary:hover{background:var(--color-brand-action-hover);color:#fff;box-shadow:0 6px 20px rgba(0,157,100,.35)}
    .btn-secondary{background:var(--color-surface);color:var(--color-brand-primary);border:1.5px solid var(--color-border-strong);box-shadow:var(--shadow-sm)}
    .btn-secondary:hover{background:var(--color-hover-overlay);color:var(--color-brand-primary)}
    .btn-ghost{background:transparent;color:var(--color-brand-primary)}
    .btn-ghost:hover{background:var(--color-hover-overlay);color:var(--color-brand-primary)}
    .nav{position:sticky;top:0;z-index:200;height:var(--nav-height);display:flex;align-items:center;background:var(--color-surface);border-bottom:1px solid var(--color-border);box-shadow:var(--shadow-sm);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);background-color:rgba(255,255,255,.85)}
    .nav>.container{height:100%}
    .nav-inner{display:flex;align-items:center;justify-content:space-between;height:100%;gap:var(--space-6)}
    .nav-logo{display:flex;align-items:center;gap:var(--space-2);font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--color-brand-primary);text-decoration:none;flex-shrink:0}
    .nav-logo:hover{color:var(--color-brand-primary)}
    .nav-links{display:flex;align-items:center;gap:var(--space-1);flex:1;justify-content:center}
    .nav-link{font-family:var(--font-body);font-size:14px;font-weight:500;line-height:1;color:var(--color-ink-base);text-decoration:none;padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);transition:color var(--dur-fast) var(--ease),background var(--dur-fast) var(--ease)}
    .nav-link:hover{color:var(--color-brand-action);background:var(--color-success-bg)}
    .nav-link.active{color:var(--color-brand-action);background:var(--color-success-bg)}
    .nav-actions{display:flex;align-items:center;gap:var(--space-3);flex-shrink:0}
    .nav-signin{font-family:var(--font-body);font-size:14px;font-weight:500;color:var(--color-ink-base);text-decoration:none;padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);transition:color var(--dur-fast) var(--ease)}
    .nav-signin:hover{color:var(--color-brand-action)}
    .nav-hamburger{display:none;flex-direction:column;justify-content:center;gap:5px;width:40px;height:40px;background:none;border:none;cursor:pointer;padding:var(--space-2);border-radius:var(--radius-sm);transition:background var(--dur-fast) var(--ease);flex-shrink:0}
    .nav-hamburger:hover{background:var(--color-surface-raised)}
    .nav-hamburger:focus-visible{box-shadow:var(--shadow-focus);outline:none}
    .nav-hamburger span{display:block;width:20px;height:2px;background:var(--color-ink-base);border-radius:2px;transition:all var(--dur-base) var(--ease);transform-origin:center}
    .nav-hamburger[aria-expanded="true"] span:nth-child(1){transform:translateY(7px)rotate(45deg)}
    .nav-hamburger[aria-expanded="true"] span:nth-child(2){opacity:0;transform:scaleX(0)}
    .nav-hamburger[aria-expanded="true"] span:nth-child(3){transform:translateY(-7px)rotate(-45deg)}
    .nav-mobile{display:none;position:fixed;top:var(--nav-height);left:0;right:0;background:var(--color-surface);border-bottom:1px solid var(--color-border);box-shadow:var(--shadow-lg);z-index:190;padding:var(--space-4) var(--space-4) var(--space-5)}
    .nav-mobile.is-open{display:block}
    .nav-mobile-links{display:flex;flex-direction:column;gap:var(--space-1);margin-bottom:var(--space-5)}
    .nav-mobile-link{font-family:var(--font-body);font-size:16px;font-weight:500;color:var(--color-ink-base);text-decoration:none;padding:var(--space-3) var(--space-2);border-radius:var(--radius-sm);border-bottom:1px solid var(--color-border)}
    .nav-mobile-link:last-child{border-bottom:none}
    .nav-mobile-link:hover{color:var(--color-brand-action)}
    .nav-mobile-actions{display:flex;flex-direction:column;gap:var(--space-3)}
    @media(max-width:768px){.nav-links{display:none}.nav-signin{display:none}.nav-cta{display:none}.nav-hamburger{display:flex}.nav-actions{gap:var(--space-2)}.site-nav .container{padding:0 var(--space-3)}}
    
    [data-theme="dark"] 
    [data-theme="dark"] 
    [data-theme="dark"] .nav{background-color:rgba(20,30,46,.85);border-color:#1E2D44;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
    [data-theme="dark"] .nav-logo{color:#FDFBF4}
    [data-theme="dark"] .nav-logo:hover{color:#009D64}
    [data-theme="dark"] .nav-link{color:#FDFBF4}
    [data-theme="dark"] .nav-link:hover{color:#009D64;background:rgba(0,157,100,.10)}
    [data-theme="dark"] .nav-link.active{color:#009D64;background:rgba(0,157,100,.10)}
    [data-theme="dark"] .nav-signin{color:#FDFBF4}
    [data-theme="dark"] .nav-signin:hover{color:#009D64}
    [data-theme="dark"] .nav-mobile{background:#141E2E;border-color:#1E2D44}
    [data-theme="dark"] .nav-mobile-link{color:#CBD5E1;border-color:#1E2D44}
    [data-theme="dark"] .nav-mobile-link:hover{color:#009D64}
    .footer{background:#001A24;color:rgba(255,255,255,.75);padding:var(--space-10) 0 var(--space-6)}
    .footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:var(--space-8);padding-bottom:var(--space-8);border-bottom:1px solid rgba(255,255,255,.08)}
    .footer-brand-name{font-family:var(--font-display);font-size:18px;font-weight:700;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)}
    .footer-brand-desc{font-size:14px;line-height:22px;color:rgba(255,255,255,.5);max-width:32ch}
    .footer-col-heading{font-family:var(--font-body);font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:var(--space-4)}
    .footer-links{display:flex;flex-direction:column;gap:var(--space-2)}
    .footer-link{font-size:14px;line-height:22px;color:rgba(255,255,255,.65);text-decoration:none;transition:color var(--dur-fast) var(--ease);padding:var(--space-1) 0}
    .footer-link:hover{color:#fff}
    .footer-link:focus-visible{outline:none;box-shadow:var(--shadow-focus);border-radius:var(--radius-xs)}
    .footer-bottom{display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);padding-top:var(--space-5);flex-wrap:wrap}
    .footer-copy{font-size:13px;color:rgba(255,255,255,.35)}
    .footer-status{display:inline-flex;align-items:center;gap:var(--space-2);font-family:var(--font-mono);font-size:12px;font-weight:500;color:var(--primitive-green-500);text-decoration:none}
    .status-dot{width:7px;height:7px;background:var(--primitive-green-500);border-radius:50%;box-shadow:0 0 0 0 rgba(0,192,122,.4);animation:ping 2.5s ease-in-out infinite}
    @keyframes ping{0%{box-shadow:0 0 0 0 rgba(0,192,122,.5)}70%{box-shadow:0 0 0 6px rgba(0,192,122,0)}100%{box-shadow:0 0 0 0 rgba(0,192,122,0)}}
    @media(max-width:1023px){.footer-grid{grid-template-columns:1fr 1fr}.footer-brand-wrap{grid-column:1/-1}}
    @media(max-width:639px){.footer-grid{grid-template-columns:1fr 1fr;gap:var(--space-6)}.footer-brand-wrap{grid-column:1/-1}.footer-bottom{flex-direction:column;align-items:flex-start}}
    .shell{max-width:var(--container-xl);margin:0 auto;padding:var(--space-9) var(--space-4) var(--space-10)}
    @media(min-width:640px){.shell{padding:var(--space-10) var(--space-6) var(--space-11)}}
    @media(min-width:1024px){.shell{padding:var(--space-10) var(--space-8) var(--space-12)}}
    .panel{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);padding:var(--space-5)}
    @media(min-width:640px){.panel{padding:var(--space-6)}}
    .article-panel{position:relative;overflow:hidden}
    .article-panel::before{content:"";position:absolute;inset:0 0 auto 0;height:120px;background:linear-gradient(180deg,rgba(0,42,58,.06),rgba(0,42,58,0));pointer-events:none}
    .lede{font-size:1.02rem;color:var(--color-ink-muted);margin-top:var(--space-2);line-height:1.7;max-width:72ch}
    .grid{display:grid;gap:var(--space-4)}
    .cards{grid-template-columns:repeat(1,minmax(0,1fr));align-items:stretch}
    .card{background:#FFFFFF;border:1px solid var(--color-border);height:100%;border-radius:var(--radius-lg);padding:var(--space-4);box-shadow:var(--shadow-sm)}
    .card h3 a{color:var(--color-ink-strong);text-decoration:none}
    .card h3 a:hover{color:var(--color-brand-action)}
    .card-hero{margin:calc(var(--space-4)*-1) calc(var(--space-4)*-1) var(--space-3);aspect-ratio:16/9;max-height:220px;overflow:hidden;border-bottom:1px solid var(--color-border);border-radius:var(--radius-lg) var(--radius-lg) 0 0;background:#EDF3F6}
    .card-hero img{width:100%;height:100%;object-fit:cover;display:block}
    .meta{display:flex;gap:var(--space-2);flex-wrap:wrap;color:var(--color-ink-muted);font-size:.9rem;margin:var(--space-2) 0 var(--space-3)}
    .meta-item{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--color-border);border-radius:999px;background:#fff}
    .chip{display:inline-block;background:#FFFFFF;border:1px solid var(--color-border);border-radius:999px;padding:3px 9px;color:var(--color-brand-primary);font-size:.78rem;font-weight:500}
    .hero{margin:var(--space-5) 0 var(--space-6)}
    .hero-media{aspect-ratio:16/9;max-height:min(42vh,420px);overflow:hidden;border-radius:var(--radius-xl);border:1px solid var(--color-border);background:#EDF3F6}
    .hero img{width:100%;height:100%;object-fit:cover;display:block}
    .hero figcaption,.caption{font-size:.85rem;color:var(--color-ink-muted);margin-top:var(--space-2)}
    .post-eyebrow{display:inline-flex;align-items:center;gap:var(--space-2);padding:4px 10px;border-radius:999px;border:1px solid #CBE3D9;background:#F6FAF8;color:#0E6A4A;font-weight:600;font-size:.78rem;letter-spacing:.02em}
    .article-header{padding-bottom:var(--space-3);border-bottom:1px solid #E8EDF3}
    .post-meta-stack{display:grid;gap:var(--space-3);margin:var(--space-3) 0 var(--space-4)}
    .post-author{display:flex;gap:var(--space-3);align-items:flex-start;padding:var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-md);background:#fff}
    .post-author .author-avatar{width:52px;height:52px;padding:6px}
    .post-dates{display:flex;gap:var(--space-2);flex-wrap:wrap;color:var(--color-ink-muted);font-size:.9rem}
    article h1{font-size:2.3rem;line-height:1.12;margin:var(--space-2) 0 0;max-width:20ch}
    .article-layout{display:grid;gap:var(--space-5);align-items:start}
    .article-body{max-width:74ch;counter-reset:sec}
    .article-body h2{font-size:1.62rem;line-height:1.22;margin:2.1rem 0 .7rem;counter-increment:sec;counter-reset:subsec}
    .article-body h2::before{content:counter(sec) ". ";color:#567}
    .article-body h2.no-number{counter-increment:none}
    .article-body h2.no-number::before{content:none}
    .article-body h3{font-size:1.28rem;line-height:1.3;margin:1.45rem 0 .6rem;counter-increment:subsec}
    .article-body h3::before{content:counter(subsec, lower-alpha) ". ";color:#678}
    .article-body h3.no-number{counter-increment:none}
    .article-body h3.no-number::before{content:none}
    .article-body p{margin:.95rem 0;line-height:1.74;color:#122033}
    .article-body ul,.article-body ol{padding-left:1.3rem;line-height:1.7}
    .article-body li{margin:.35rem 0}
    .article-body blockquote{margin:1.2rem 0;padding:12px 14px;border-left:4px solid var(--color-brand-action);background:#F3F8F6;border-radius:10px}
    .article-body figure{margin:1.35rem auto;max-width:min(100%,780px)}
    .article-body figure img{display:block;width:100%;height:auto;max-height:320px;object-fit:cover;border-radius:var(--radius-lg);border:1px solid var(--color-border);background:#EDF3F6}
    .article-body table{width:100%;border-collapse:collapse;margin:1rem 0;background:#fff;border:1px solid var(--color-border);border-radius:var(--radius-md);overflow:hidden}
    .article-body th,.article-body td{border-bottom:1px solid var(--color-border);padding:10px 12px;text-align:left;vertical-align:top}
    .article-body th{background:#F7FAFC;font-weight:600}
    code{background:#EEF4F8;padding:2px 5px;border-radius:6px}
    pre{background:#0B1220;color:#E6EDF7;padding:12px;border-radius:var(--radius-md);overflow:auto}
    pre code{background:transparent;padding:0}
    .btn-row{display:flex;gap:var(--space-3);flex-wrap:wrap;margin-top:var(--space-3)}
    .cta{margin-top:var(--space-8);background:#F6FAF8;border:1px solid #CBE3D9;border-radius:var(--radius-lg);padding:var(--space-5)}
    .author-card{margin-top:var(--space-7);padding:var(--space-4);border:1px solid #DCE3EA;background:#fff;border-radius:var(--radius-lg)}
    .author-layout{display:flex;align-items:flex-start;gap:var(--space-4);flex-wrap:wrap}
    .author-avatar{width:60px;height:60px;border-radius:999px;border:1px solid var(--color-border);background:white;padding:8px}
    .author-name{font-weight:700;line-height:1.3}
    .toc{background:#F8FAFC;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-4);margin:var(--space-3) 0 var(--space-5)}
    .toc-title{display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:.9rem;color:#132640}
    .toc ul{margin:var(--space-2) 0 0;padding-left:0;list-style:none}
    .toc li{margin:var(--space-2) 0}
    .toc li a{display:block;padding:5px 8px;border-radius:var(--radius-sm);color:#173253}
    .toc li a:hover{background:#EDF3F8;text-decoration:none}
    .toc .toc-l3{margin-left:var(--space-3)}
    .search-box{display:flex;gap:var(--space-2);align-items:center;background:#fff;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4)}
    .search-box input{border:0;outline:none;flex:1;font:inherit;background:#FFFFFF;color:var(--color-ink-strong)}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(min-width:700px){.cards{grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch};article h1{font-size:2.7rem}.article-header{padding-bottom:var(--space-4)}.hero-media{max-height:min(56vh,520px)}.article-body figure img{max-height:460px}}
    @media(min-width:1024px){.cards{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}.article-layout{grid-template-columns:250px minmax(0,1fr);gap:var(--space-6)}.toc{position:sticky;top:20px}}
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
  const isBlog = routePath.startsWith('/blog/');
  const isDocs = routePath.startsWith('/docs/');
  const isOnBlog = isBlog && !routePath.endsWith('/') && !routePath.endsWith('/index.html');
  const isOnDocs = isDocs && !routePath.endsWith('/') && !routePath.endsWith('/index.html');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${renderMetaTags({ title: `${title} | Hookwing`, description, canonical, ogImage, type, jsonLd })}
  <title>${escapeHtml(title)} | Hookwing</title>
  <link rel="stylesheet" href="/styles/tokens.css?v=7" />
  <link rel="stylesheet" href="/styles/base.css?v=7" />
  <link rel="stylesheet" href="/styles/components.css?v=7" />
  <link rel="stylesheet" href="/styles/patterns.css?v=8" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" />
  <link rel="stylesheet" href="/styles/pages/blog.css?v=9" />
</head>
<body>
  <header>
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
            <li><a href="/use-cases/" class="nav-link">Use cases</a></li>
            <li><a href="/playground/" class="nav-link">Playground</a></li>
            <li><a href="/pricing/" class="nav-link">Pricing</a></li>
            <li><a href="/docs/" class="nav-link">Documentation</a></li>
            <li><a href="/blog/" class="nav-link${isBlog ? ' active" aria-current="page' : ''}">Blog</a></li>
            <li><a href="/signup/" class="nav-link">Start free</a></li>
          </ul>
          <div class="nav-actions">
            <a href="/signin/" class="nav-link">Sign in</a>
            <a href="/signup/" class="btn btn-primary btn-md nav-cta">Start free</a>
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
          <li><a href="/use-cases/" class="nav-mobile-link">Use cases</a></li>
          <li><a href="/playground/" class="nav-mobile-link">Playground</a></li>
          <li><a href="/pricing/" class="nav-mobile-link">Pricing</a></li>
          <li><a href="/docs/" class="nav-mobile-link">Documentation</a></li>
          <li><a href="/blog/" class="nav-mobile-link">Blog</a></li>
          <li><a href="/signup/" class="nav-mobile-link">Sign up</a></li>
          <li><a href="/signin/" class="nav-mobile-link">Sign in</a></li>
        </ul>
      </nav>
      <div class="nav-mobile-actions">
        <a href="/signup/" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;">Start free</a>
        <a href="/playground/">Try the playground</a>
      </div>
    </div>
  </header>
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
          <p class="footer-brand-desc">
            Webhook infrastructure, built for agents.
            Test free. Ship with confidence.
          </p>
          <a href="/status/" class="footer-status" style="margin-top:var(--space-4); display:inline-flex;" target="_blank" rel="noopener noreferrer" aria-label="System status: all systems operational">
            <span class="status-dot" aria-hidden="true"></span>
            All systems operational
          </a>
        </div>
        <div>
          <p class="footer-col-heading">Product</p>
          <ul class="footer-links" role="list" aria-label="Product navigation">
            <li><a href="/use-cases/" class="footer-link">Use cases</a></li>
            <li><a href="/playground/" class="footer-link">Playground</a></li>
            <li><a href="/pricing/" class="footer-link">Pricing</a></li>
            <li><a href="/docs/" class="footer-link">Docs</a></li>
            <li><a href="/agent-experience/" class="footer-link">Agent experience</a></li>
            <li><a href="/getting-started/" class="footer-link">Agent integrations</a></li>
          </ul>
        </div>
        <div>
          <p class="footer-col-heading">Developers</p>
          <ul class="footer-links" role="list">
            <li><a href="/docs/api/" class="footer-link">API reference</a></li>
            <li><a href="/getting-started/" class="footer-link">Getting started</a></li>
            <li><a href="/openapi.json" class="footer-link">OpenAPI spec</a></li>
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
        <p class="footer-copy">
          &copy; <span id="footer-year">${new Date().getFullYear()}</span> Hookwing Inc. All rights reserved.
        </p>
        <p class="footer-copy" style="color:rgba(255,255,255,.25);">
          Built for agents.
        </p>
      </div>
    </div>
  </footer>
  <script>
    (function(){
      const toggle=document.getElementById('nav-toggle'),mobileNav=document.getElementById('nav-mobile');
      if(toggle&&mobileNav){toggle.addEventListener('click',function(){const e=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!e));mobileNav.classList.toggle('is-open',!e);mobileNav.setAttribute('aria-hidden',String(e))});document.addEventListener('click',function(e){if(mobileNav.classList.contains('is-open')&&!mobileNav.contains(e.target)&&!toggle.contains(e.target)){toggle.setAttribute('aria-expanded','false');mobileNav.classList.remove('is-open');mobileNav.setAttribute('aria-hidden','true')}});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&mobileNav.classList.contains('is-open')){toggle.setAttribute('aria-expanded','false');mobileNav.classList.remove('is-open');mobileNav.setAttribute('aria-hidden','true');toggle.focus()}});mobileNav.querySelectorAll('a').forEach(function(link){link.addEventListener('click',function(){toggle.setAttribute('aria-expanded','false');mobileNav.classList.remove('is-open');mobileNav.setAttribute('aria-hidden','true')})})}
    })();
  </script>
<script src="/shared/feedback-widget.js" defer></script>
<script src="/shared/code-copy.js" defer></script>
</body>
</html>`;
}

function renderPostCard(post) {
  const tagChip = post.tags.slice(0, 3).map((tag) => `<a class="chip" href="/blog/tags/${escapeHtml(slugify(tag))}/">${escapeHtml(tagTitleCase(tag))}</a>`).join(" ");
  const authorName = post.author ? post.author.name : "";
  return `<article class="card" style="display:flex;flex-direction:column;">
    ${post.heroImage ? `<a class="card-hero" href="/blog/${escapeHtml(post.slug)}/"><img src="${escapeHtml(post.heroImage)}" alt="${escapeHtml(post.heroImageAlt || post.title)}" loading="lazy" decoding="async" /></a>` : ""}
    <h3 style="flex:0;margin-bottom:var(--space-2);"><a href="/blog/${escapeHtml(post.slug)}/" style="color:var(--color-text);">${escapeHtml(post.title)}</a></h3>
    <div class="meta" style="margin-bottom:var(--space-2);">
      <span>${escapeHtml(formatDate(post.publishDate))}</span>
      <span>•</span>
      <span>${escapeHtml(post.readingTime)}</span>
      <span>•</span>
      <a href="/blog/categories/${escapeHtml(slugify(post.category))}/">${escapeHtml(post.category)}</a>
    </div>
    ${authorName ? `<div style="font-size:.85rem;color:var(--color-ink-muted);margin-bottom:var(--space-3);">By ${escapeHtml(authorName)}</div>` : ""}
    <p style="flex:1;margin-bottom:var(--space-3);">${escapeHtml(post.description)}</p>
    <div style="margin-top:auto;">${tagChip}</div>
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
      <h1 style="margin-bottom:var(--space-4);">Hookwing Blog</h1>
      <p class="lede" style="margin-bottom:var(--space-4);">Clear operating guides for delivery reliability, incident response, and production-ready webhook systems.</p>
      <div class="search-box" role="search" style="margin-bottom:var(--space-4);">
        <label class="sr-only" for="blog-search">Search blog</label>
        <input id="blog-search" type="search" placeholder="Search title, summary, body, tags" autocomplete="off" />
      </div>
      <div class="btn-row" style="margin-bottom:var(--space-4);">
        <a class="chip" href="/blog/tags/">All tags</a>
        <a class="chip" href="/blog/categories/">All categories</a>
      </div>
    </section>
    <section class="grid cards" style="margin-top:var(--space-4);">${cards}</section>
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
  const tags = post.tags.map((tag) => `<a class="chip" href="/blog/tags/${escapeHtml(slugify(tag))}/">${escapeHtml(tagTitleCase(tag))}</a>`).join(" ");
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

  const content = `<nav class="breadcrumb" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="/blog/">Blog</a></li>
      ${post.category ? `<li><a href="/blog/categories/${escapeHtml(slugify(post.category))}/">${escapeHtml(post.category)}</a></li>` : ""}
      <li aria-current="page">${escapeHtml(post.title)}</li>
    </ol>
  </nav>
  <article class="panel article-panel">
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
        <a class="btn btn-primary btn-md" href="/">Start free</a>
        <a class="btn btn-secondary btn-md" href="/docs/getting-started/">Read docs</a>
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
      <h1 style="margin-bottom:var(--space-4);">${escapeHtml(title)}</h1>
      <p class="lede" style="margin-bottom:var(--space-4);">${escapeHtml(subtitle)}</p>
    </section>
    <section class="grid cards" style="margin-top:var(--space-4);">${cards}</section>`,
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
          <p class="lede" style="margin:var(--space-2) 0">${escapeHtml(author.role)}</p>
          <p style="margin:0">${escapeHtml(author.bio || "")}</p>
        </div>
      </div>
    </section>
    <section class="grid cards" style="margin-top:var(--space-4);">${cards}</section>`,
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

const docsNavLinkStyle = 'display:block;padding:4px 0;font-size:.875rem;color:var(--color-ink-muted);text-decoration:none;';
const docsNavSectionStyle = 'display:block;padding:6px 0 2px;font-size:.75rem;font-weight:600;color:var(--color-ink-subtle);text-transform:uppercase;letter-spacing:.04em;margin-top:10px;';
const docsNavHtml = `
<aside class="docs-sidebar" style="position:sticky;top:24px;align-self:start;">
  <nav style="border-right:1px solid var(--color-border);padding-right:16px;">
    <div style="position:relative;margin-bottom:12px;">
      <label class="sr-only" for="docs-search">Search docs</label>
      <input id="docs-search" type="search" placeholder="Search docs…" autocomplete="off"
        style="width:100%;box-sizing:border-box;padding:6px 10px 6px 28px;font-size:.8125rem;border:1px solid var(--color-border);border-radius:6px;background:var(--color-surface, #F9FAFB);color:var(--color-ink-strong);outline:none;line-height:1.4;" />
      <svg aria-hidden="true" focusable="false" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--color-ink-muted);pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <div id="docs-search-results" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:-16px;z-index:200;background:var(--color-bg, #fff);border:1px solid var(--color-border);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.1);max-height:320px;overflow-y:auto;"></div>
    </div>
    <a href="/docs/" style="display:block;padding:4px 0;font-size:.875rem;font-weight:600;color:var(--color-ink-strong);text-decoration:none;margin-bottom:8px;">← All Docs</a>
    <span style="${docsNavSectionStyle}">Getting Started</span>
    <a href="/docs/getting-started/" style="${docsNavLinkStyle}">Quickstart</a>
    <a href="/docs/concepts/" style="${docsNavLinkStyle}">Core Concepts</a>
    <a href="/docs/playground/" style="${docsNavLinkStyle}">Playground</a>
    <span style="${docsNavSectionStyle}">Core Features</span>
    <a href="/docs/endpoints/" style="${docsNavLinkStyle}">Endpoints</a>
    <a href="/docs/events/" style="${docsNavLinkStyle}">Events</a>
    <a href="/docs/deliveries/" style="${docsNavLinkStyle}">Deliveries</a>
    <a href="/docs/batch-ingest/" style="${docsNavLinkStyle}">Batch Ingest</a>
    <a href="/docs/event-routing/" style="${docsNavLinkStyle}">Event Routing</a>
    <a href="/docs/dead-letter-queue/" style="${docsNavLinkStyle}">Dead Letter Queue</a>
    <span style="${docsNavSectionStyle}">Security</span>
    <a href="/docs/authentication/" style="${docsNavLinkStyle}">Authentication</a>
    <a href="/docs/webhooks/" style="${docsNavLinkStyle}">Webhook Signatures</a>
    <a href="/docs/security/" style="${docsNavLinkStyle}">Security &amp; 2FA</a>
    <span style="${docsNavSectionStyle}">Integrations</span>
    <a href="/docs/sdk-quickstart/" style="${docsNavLinkStyle}">SDK Quickstart</a>
    <a href="/docs/cli-reference/" style="${docsNavLinkStyle}">CLI Reference</a>
    <a href="/docs/agent-integrations/" style="${docsNavLinkStyle}">Agent Integrations</a>
    <span style="${docsNavSectionStyle}">Platform</span>
    <a href="/docs/dashboard/" style="${docsNavLinkStyle}">Dashboard</a>
    <a href="/docs/analytics/" style="${docsNavLinkStyle}">Analytics API</a>
    <a href="/docs/custom-domains/" style="${docsNavLinkStyle}">Custom Domains</a>
    <a href="/docs/billing/" style="${docsNavLinkStyle}">Billing &amp; Tiers</a>
    <span style="${docsNavSectionStyle}">Reference</span>
    <a href="/docs/webhook-sources/" style="${docsNavLinkStyle}">Webhook Sources</a>
    <a href="/docs/error-codes/" style="${docsNavLinkStyle}">Error Codes</a>
    <a href="/docs/api/" style="display:block;padding:4px 0;font-size:.875rem;color:var(--color-brand-action);text-decoration:none;">API Explorer ↗</a>
  </nav>
</aside>`;

function renderDocsArticle(doc) {
  return renderLayout({
    title: doc.title,
    description: doc.summary,
    routePath: `/docs/${doc.slug}/`,
    nav: `<a href="/docs/">Docs home</a>`,
    content: `<div style="display:grid;grid-template-columns:220px 1fr;gap:32px;max-width:1100px;margin:0 auto;padding:24px 20px;">
      ${docsNavHtml}
      <article style="min-width:0;">
        <h1>${escapeHtml(doc.title)}</h1>
        <div class="meta"><span>Updated ${escapeHtml(formatDate(doc.updatedAt))}</span></div>
        <p class="lede">${escapeHtml(doc.summary)}</p>
        ${doc.bodyHtml}
      </article>
    </div>
    ${renderDocsSearchScript()}`,
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
    description: raw.description || raw.excerpt || raw.summary || "",
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
        title: `Tag: ${tagTitleCase(group.label)}`,
        subtitle: `Posts tagged with ${tagTitleCase(group.label)}.`,
        posts: group.posts,
        routePath: `/blog/tags/${slug}/`,
      }),
    );
    routes.push(`/blog/tags/${slug}/`);
    tagList.push({ slug, label: tagTitleCase(group.label), count: group.posts.length });
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
  // Skip overwriting docs/index.html if no docs content exists
  // (hand-crafted API docs page takes priority)
  // Never overwrite docs/index.html — it's hand-crafted (1175 lines, SDK tabs, etc.)
  // The build only generates individual doc sub-pages.
  const routes = ["/docs/"];

  for (const doc of docs) {
    await writePage(path.join(docsRoot, doc.slug, "index.html"), renderDocsArticle(doc));
    routes.push(`/docs/${doc.slug}/`);
  }

  const searchIndex = docs.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    search: `${doc.title} ${doc.summary} ${doc.bodyText || ""}`.toLowerCase(),
  }));
  await fs.writeFile(path.join(docsRoot, "search-index.json"), JSON.stringify(searchIndex, null, 2), "utf8");

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
      bodyText: body.replace(/[#>*`\-\[\]\(\)!]/g, " "),
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
