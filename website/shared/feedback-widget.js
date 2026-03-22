/**
 * Hookwing Feedback Widget
 * Persistent bubble → slide-out panel
 * Submits to POST /v1/feedback
 */
(function () {
  'use strict';

  const API_BASE = window.HOOKWING_API_BASE || 'https://dev.api.hookwing.com';
  const DISMISS_KEY = 'hw-feedback-dismissed';
  const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24h

  // Check if dismissed recently
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION) return;

  // State
  let isOpen = false;
  let rating = 0;
  let submitting = false;

  // Create widget HTML
  const widget = document.createElement('div');
  widget.id = 'hw-feedback';
  widget.innerHTML = `
    <button class="hw-fb-bubble" aria-label="Send feedback" title="Send feedback">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
    <div class="hw-fb-panel" aria-hidden="true">
      <div class="hw-fb-header">
        <span class="hw-fb-title">Send feedback</span>
        <button class="hw-fb-close" aria-label="Close feedback">&times;</button>
      </div>
      <div class="hw-fb-body">
        <div class="hw-fb-rating">
          <span class="hw-fb-label">How's your experience?</span>
          <div class="hw-fb-stars">
            ${[1,2,3,4,5].map(n => `<button class="hw-fb-star" data-rating="${n}" aria-label="${n} star${n>1?'s':''}">${n <= 3 ? ['😞','😐','🙂'][n-1] : n === 4 ? '😊' : '🤩'}</button>`).join('')}
          </div>
        </div>
        <div class="hw-fb-group">
          <label class="hw-fb-label" for="hw-fb-category">Category</label>
          <select id="hw-fb-category" class="hw-fb-select">
            <option value="general">General</option>
            <option value="bug">Bug report</option>
            <option value="feature">Feature request</option>
            <option value="ux">UX / Design</option>
            <option value="docs">Documentation</option>
          </select>
        </div>
        <div class="hw-fb-group">
          <label class="hw-fb-label" for="hw-fb-message">Message (optional)</label>
          <textarea id="hw-fb-message" class="hw-fb-textarea" placeholder="What's on your mind?" rows="3" maxlength="5000"></textarea>
        </div>
        <button class="hw-fb-submit" id="hw-fb-submit">Send feedback</button>
        <div class="hw-fb-status" id="hw-fb-status"></div>
      </div>
    </div>
  `;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #hw-feedback { position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .hw-fb-bubble { width: 48px; height: 48px; border-radius: 50%; background: #002A3A; border: none; color: #fff; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; transition: transform 150ms, box-shadow 150ms; }
    .hw-fb-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
    .hw-fb-bubble.is-open { display: none; }
    .hw-fb-panel { position: absolute; bottom: 60px; right: 0; width: 320px; background: #fff; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05); overflow: hidden; transform: translateY(10px) scale(0.96); opacity: 0; pointer-events: none; transition: transform 200ms cubic-bezier(.2,.8,.2,1), opacity 200ms; }
    .hw-fb-panel.is-open { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
    .hw-fb-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #E5E7EB; }
    .hw-fb-title { font-size: 14px; font-weight: 600; color: #111827; }
    .hw-fb-close { background: none; border: none; font-size: 20px; color: #9CA3AF; cursor: pointer; padding: 0; line-height: 1; }
    .hw-fb-close:hover { color: #374151; }
    .hw-fb-body { padding: 16px; }
    .hw-fb-label { display: block; font-size: 12px; font-weight: 500; color: #6B7280; margin-bottom: 6px; }
    .hw-fb-rating { margin-bottom: 14px; }
    .hw-fb-stars { display: flex; gap: 6px; }
    .hw-fb-star { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid #E5E7EB; background: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color 120ms, background 120ms, transform 120ms; }
    .hw-fb-star:hover { border-color: #009D64; background: #F0FDF4; transform: scale(1.1); }
    .hw-fb-star.is-selected { border-color: #009D64; background: #DCFCE7; transform: scale(1.1); }
    .hw-fb-group { margin-bottom: 12px; }
    .hw-fb-select { width: 100%; height: 36px; padding: 0 10px; border: 1.5px solid #E5E7EB; border-radius: 8px; font-size: 13px; color: #374151; background: #fff; outline: none; }
    .hw-fb-select:focus { border-color: #009D64; box-shadow: 0 0 0 3px rgba(0,157,100,0.12); }
    .hw-fb-textarea { width: 100%; padding: 10px; border: 1.5px solid #E5E7EB; border-radius: 8px; font-size: 13px; color: #374151; resize: vertical; outline: none; font-family: inherit; box-sizing: border-box; }
    .hw-fb-textarea:focus { border-color: #009D64; box-shadow: 0 0 0 3px rgba(0,157,100,0.12); }
    .hw-fb-submit { width: 100%; height: 38px; background: #009D64; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 120ms; }
    .hw-fb-submit:hover { background: #008A57; }
    .hw-fb-submit:disabled { opacity: 0.5; cursor: default; }
    .hw-fb-status { text-align: center; font-size: 12px; margin-top: 8px; min-height: 16px; }
    .hw-fb-status.success { color: #009D64; }
    .hw-fb-status.error { color: #DC2626; }
    @media (max-width: 400px) { .hw-fb-panel { width: calc(100vw - 40px); right: -10px; } }
  `;

  document.head.appendChild(style);
  document.body.appendChild(widget);

  // Elements
  const bubble = widget.querySelector('.hw-fb-bubble');
  const panel = widget.querySelector('.hw-fb-panel');
  const closeBtn = widget.querySelector('.hw-fb-close');
  const stars = widget.querySelectorAll('.hw-fb-star');
  const submitBtn = widget.querySelector('#hw-fb-submit');
  const statusEl = widget.querySelector('#hw-fb-status');

  function toggle(open) {
    isOpen = open !== undefined ? open : !isOpen;
    bubble.classList.toggle('is-open', isOpen);
    panel.classList.toggle('is-open', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
  }

  bubble.addEventListener('click', () => toggle(true));
  closeBtn.addEventListener('click', () => toggle(false));

  // Dismiss on outside click
  document.addEventListener('click', (e) => {
    if (isOpen && !widget.contains(e.target)) toggle(false);
  });

  // Star rating
  stars.forEach(star => {
    star.addEventListener('click', () => {
      rating = Number(star.dataset.rating);
      stars.forEach(s => s.classList.toggle('is-selected', Number(s.dataset.rating) <= rating));
    });
  });

  // Submit
  submitBtn.addEventListener('click', async () => {
    if (submitting) return;
    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    statusEl.textContent = '';
    statusEl.className = 'hw-fb-status';

    const category = document.getElementById('hw-fb-category').value;
    const message = document.getElementById('hw-fb-message').value.trim();

    if (!rating && !message) {
      statusEl.textContent = 'Please add a rating or message';
      statusEl.className = 'hw-fb-status error';
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send feedback';
      return;
    }

    try {
      const body = {
        source: 'ui',
        category,
        ...(rating && { rating }),
        ...(message && { message }),
        pageUrl: window.location.href,
        context: {
          referrer: document.referrer || null,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        },
      };

      // Include API key if available
      const headers = { 'Content-Type': 'application/json' };
      const apiKey = localStorage.getItem('hookwing_api_key');
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(`${API_BASE}/v1/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to send');

      statusEl.textContent = 'Thanks for your feedback!';
      statusEl.className = 'hw-fb-status success';

      // Reset after 2s
      setTimeout(() => {
        toggle(false);
        rating = 0;
        stars.forEach(s => s.classList.remove('is-selected'));
        document.getElementById('hw-fb-message').value = '';
        document.getElementById('hw-fb-category').value = 'general';
        statusEl.textContent = '';
      }, 2000);
    } catch (err) {
      statusEl.textContent = 'Something went wrong. Try again.';
      statusEl.className = 'hw-fb-status error';
    } finally {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send feedback';
    }
  });

  // Dismiss button (long press on bubble)
  let pressTimer;
  bubble.addEventListener('mousedown', () => {
    pressTimer = setTimeout(() => {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      widget.remove();
    }, 2000);
  });
  bubble.addEventListener('mouseup', () => clearTimeout(pressTimer));
  bubble.addEventListener('mouseleave', () => clearTimeout(pressTimer));
})();
