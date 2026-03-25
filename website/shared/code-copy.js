/**
 * Code Copy Button — adds copy-to-clipboard to all code blocks site-wide.
 * Handles both .code-block (marketing pages) and standalone <pre> (docs).
 */
(function () {
  'use strict';

  const COPIED_MS = 1800;

  const copyIcon =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  const checkIcon =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  function addCopyButton(block) {
    // Skip if already has a copy button
    if (block.querySelector('.code-copy-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = copyIcon;

    btn.addEventListener('click', function () {
      // Get the code text
      const pre = block.querySelector('pre') || block;
      const code = pre.querySelector('code') || pre;
      const text = code.textContent || '';

      navigator.clipboard.writeText(text.trim()).then(function () {
        btn.innerHTML = checkIcon;
        btn.classList.add('copied');
        setTimeout(function () {
          btn.innerHTML = copyIcon;
          btn.classList.remove('copied');
        }, COPIED_MS);
      });
    });

    // Position the button
    const header = block.querySelector('.code-block-header');
    if (header) {
      header.style.position = 'relative';
      header.appendChild(btn);
    } else {
      block.style.position = 'relative';
      block.appendChild(btn);
    }
  }

  // Add to .code-block elements (marketing pages)
  document.querySelectorAll('.code-block').forEach(addCopyButton);

  // Add to standalone <pre> elements (docs pages)
  document.querySelectorAll('pre').forEach(function (pre) {
    // Skip if inside a .code-block (already handled)
    if (pre.closest('.code-block')) return;
    // Skip very short blocks (inline code)
    if ((pre.textContent || '').length < 20) return;
    addCopyButton(pre);
  });

  // Also handle .code-tabs panels
  document.querySelectorAll('.tab-panel pre').forEach(function (pre) {
    if (!pre.querySelector('.code-copy-btn')) {
      addCopyButton(pre);
    }
  });
})();
