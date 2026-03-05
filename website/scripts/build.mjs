#!/usr/bin/env node
/**
 * Hookwing Website Build Script
 * Assembles HTML pages from partials + page-specific content.
 *
 * Page source files live in: src/pages/
 * Partials live in:          src/partials/
 * Output goes to:            website root (and subdirs)
 *
 * Partial markers in source files:
 *   <!-- partial:head -->
 *   <!-- partial:nav -->
 *   <!-- partial:footer -->
 *   <!-- partial:scripts -->
 *
 * Page metadata (first HTML comment block after <head>):
 *   <!-- page-meta
 *     title: Hookwing - The webhook platform
 *     description: Test free. Ship with confidence.
 *     canonical: https://hookwing.com/
 *     og_image: https://hookwing.com/assets/og/default.png
 *     page_css: /styles/pages/home.css
 *     active_nav: home
 *   -->
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(__dirname, '..');
const srcDir      = path.join(websiteRoot, 'src');
const partialsDir = path.join(srcDir, 'partials');
const pagesDir    = path.join(srcDir, 'pages');

// ── Load partials ──────────────────────────────────────────────
async function loadPartials() {
  const [head, nav, footer, scripts] = await Promise.all([
    fs.readFile(path.join(partialsDir, 'head.html'), 'utf8'),
    fs.readFile(path.join(partialsDir, 'nav.html'), 'utf8'),
    fs.readFile(path.join(partialsDir, 'footer.html'), 'utf8'),
    fs.readFile(path.join(partialsDir, 'scripts.html'), 'utf8'),
  ]);
  return { head, nav, footer, scripts };
}

// ── Parse page-meta comment ────────────────────────────────────
function parseMeta(source) {
  const meta = {
    title: 'Hookwing',
    description: '',
    canonical: 'https://hookwing.com/',
    og_image: 'https://hookwing.com/assets/og/default.png',
    page_css: '',
    active_nav: '',
    extra_head: '',
  };

  const m = source.match(/<!--\s*page-meta\s*([\s\S]*?)-->/);
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^\s*([\w_]+)\s*:\s*(.+?)\s*$/);
      if (kv) meta[kv[1]] = kv[2];
    }
  }

  // Extra head content (JSON-LD, etc.) between <!-- extra-head --> and <!-- /extra-head -->
  const eh = source.match(/<!--\s*extra-head\s*-->([\s\S]*?)<!--\s*\/extra-head\s*-->/);
  if (eh) meta.extra_head = eh[1].trim();

  return meta;
}

// ── NAV active class helper ────────────────────────────────────
const NAV_KEYS = {
  home:             'NAV_ACTIVE_HOME',
  why:              'NAV_ACTIVE_WHY',
  playground:       'NAV_ACTIVE_PLAYGROUND',
  pricing:          'NAV_ACTIVE_PRICING',
  docs:             'NAV_ACTIVE_DOCS',
  blog:             'NAV_ACTIVE_BLOG',
  getting_started:  'NAV_ACTIVE_GETTING_STARTED',
  signin:           'NAV_ACTIVE_SIGNIN',
};

function applyNavActive(navHtml, activeKey) {
  let result = navHtml;
  for (const [key, placeholder] of Object.entries(NAV_KEYS)) {
    const replacement = (key === activeKey) ? 'active" aria-current="page' : '';
    // Replace {{NAV_ACTIVE_XXX}} — the value gets interpolated into class="nav-link {{...}}"
    result = result.replaceAll(`{{${placeholder}}}`, replacement);
  }
  return result;
}

// ── Assemble a single page ─────────────────────────────────────
function assemblePage(source, partials, meta) {
  // Build head content
  const pageCssLink = meta.page_css
    ? `<link rel="stylesheet" href="${meta.page_css}" />`
    : '';

  let headContent = partials.head
    .replace('{{TITLE}}',       escHtml(meta.title))
    .replace('{{TITLE}}',       escHtml(meta.title))   // title appears twice
    .replace('{{DESCRIPTION}}', escHtml(meta.description))
    .replace('{{DESCRIPTION}}', escHtml(meta.description))
    .replace('{{CANONICAL}}',   escHtml(meta.canonical))
    .replace('{{OG_IMAGE}}',    escHtml(meta.og_image))
    .replace('{{OG_IMAGE}}',    escHtml(meta.og_image))
    .replace('{{PAGE_CSS_LINK}}', pageCssLink);

  if (meta.extra_head) {
    headContent += '\n' + meta.extra_head;
  }

  const navContent = applyNavActive(partials.nav, meta.active_nav);

  // Strip the page-meta comment + extra-head blocks from body
  let body = source
    .replace(/<!--\s*page-meta[\s\S]*?-->/g, '')
    .replace(/<!--\s*extra-head\s*-->[\s\S]*?<!--\s*\/extra-head\s*-->/g, '');

  // Inject partials
  body = body
    .replace('<!-- partial:head -->',    headContent)
    .replace('<!-- partial:nav -->',     navContent)
    .replace('<!-- partial:footer -->',  partials.footer)
    .replace('<!-- partial:scripts -->', partials.scripts);

  return body;
}

function escHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ── Page → output path mapping ─────────────────────────────────
function outputPath(pageFile) {
  const name = path.basename(pageFile, '.html');
  if (name === 'index') {
    return path.join(websiteRoot, 'index.html');
  }
  return path.join(websiteRoot, name, 'index.html');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  const partials = await loadPartials();

  let entries;
  try {
    entries = await fs.readdir(pagesDir);
  } catch {
    process.stderr.write(`src/pages/ directory not found — no pages to build.\n`);
    process.exit(0);
  }

  const htmlFiles = entries.filter(f => f.endsWith('.html'));
  let built = 0;

  for (const file of htmlFiles) {
    const srcPath = path.join(pagesDir, file);
    const source  = await fs.readFile(srcPath, 'utf8');
    const meta    = parseMeta(source);
    const html    = assemblePage(source, partials, meta);
    const outPath = outputPath(file);

    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, html, 'utf8');
    process.stdout.write(`Built: ${path.relative(websiteRoot, outPath)}\n`);
    built++;
  }

  process.stdout.write(`\nDone. Built ${built} page${built !== 1 ? 's' : ''}.\n`);
}

main().catch(err => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
