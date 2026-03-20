/**
 * Playground - Interactive Webhook Testing
 * Vanilla JS, no dependencies
 */

(function () {
  'use strict';

  // API base URL
  const API_BASE = 'https://dev.api.hookwing.com';

  // State
  let state = {
    sessionId: null,
    endpointId: null,
    endpointUrl: null,
    secret: null,
    expiresAt: null,
    events: [],
    selectedEventId: null,
    pollInterval: null,
  };

  // DOM Elements
  const elements = {};

  // Sample payloads for dropdown
  const samplePayloads = {
    'payment_intent.succeeded': {
      id: 'pi_3O1234567890abcdef',
      object: 'payment_intent',
      amount: 2000,
      currency: 'usd',
      status: 'succeeded',
      customer: 'cus_abcdef123456',
      created: 1699876543,
    },
    'order.created': {
      id: 'or_abcdef123456',
      object: 'order',
      amount: 5999,
      currency: 'usd',
      status: 'created',
      customer: 'cus_abcdef123456',
      items: [
        { name: 'Webhook T-Shirt', quantity: 1, price: 2999 },
        { name: 'Sticker Pack', quantity: 1, price: 499 },
      ],
    },
    'user.signup': {
      id: 'usr_abcdef123456',
      email: 'newuser@example.com',
      name: 'John Doe',
      created_at: '2024-01-15T10:30:00Z',
      source: 'organic',
    },
    custom: {
      message: 'Hello from Hookwing Playground!',
      timestamp: '{{timestamp}}',
      data: {
        foo: 'bar',
        nested: { value: 42 },
      },
    },
  };

  // Initialize
  function init() {
    cacheElements();
    bindEvents();

    // Try to restore existing session first
    if (restoreSession()) {
      return; // Session restored, already active
    }

    // No existing session - auto-generate on page load
    autoGenerate();
  }

  // Auto-generate session on page load
  async function autoGenerate() {
    showLoadingState();

    try {
      const response = await fetch(`${API_BASE}/v1/playground/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create session');
      }

      const data = await response.json();
      state = {
        ...state,
        sessionId: data.sessionId,
        endpointId: data.endpointId,
        endpointUrl: data.endpointUrl,
        secret: data.secret,
        expiresAt: data.expiresAt,
        events: [],
        selectedEventId: null,
      };

      // Save to localStorage
      localStorage.setItem('playground_session', JSON.stringify(state));

      showActiveState();
      startPolling();
    } catch (err) {
      showErrorState(err.message);
    }
  }

  // Show loading state while generating
  function showLoadingState() {
    elements.initialSection.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Generating your endpoint...</p>
      </div>
    `;
    elements.initialSection.style.display = 'flex';
    elements.activeSection.classList.remove('is-visible');
  }

  // Show error state
  function showErrorState(message) {
    elements.initialSection.innerHTML = `
      <div class="error-state">
        <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4m0 4h.01"/>
        </svg>
        <p>Unable to generate endpoint</p>
        <p class="error-message">${escapeHtml(message)}</p>
        <button id="retry-btn" class="btn btn-primary btn-md">
          Try again
        </button>
      </div>
    `;
    elements.initialSection.style.display = 'flex';
    elements.activeSection.classList.remove('is-visible');

    // Bind retry button
    const retryBtn = document.getElementById('retry-btn');
    retryBtn?.addEventListener('click', autoGenerate);
  }

  // Cache DOM elements
  function cacheElements() {
    elements.initialSection = document.getElementById('playground-initial');
    elements.activeSection = document.getElementById('playground-active');
    elements.generateBtn = document.getElementById('generate-btn');
    elements.endpointUrl = document.getElementById('endpoint-url');
    elements.sessionTimer = document.getElementById('session-timer');
    elements.sendForm = document.getElementById('send-form');
    elements.eventTypeSelect = document.getElementById('event-type');
    elements.payloadTextarea = document.getElementById('payload');
    elements.sendBtn = document.getElementById('send-btn');
    elements.curlCommand = document.getElementById('curl-command');
    elements.curlCopyBtn = document.getElementById('curl-copy-btn');
    elements.eventFeed = document.getElementById('event-feed');
    elements.inspectorTabs = document.querySelectorAll('.inspector-tab');
    elements.inspectorPanels = document.querySelectorAll('.inspector-panel');
    elements.inspectorContent = document.getElementById('inspector-content');
    elements.noInspector = document.getElementById('no-inspector');
  }

  // Bind events
  function bindEvents() {
    elements.sendForm?.addEventListener('submit', handleSend);
    elements.eventTypeSelect?.addEventListener('change', handleEventTypeChange);
    elements.curlCopyBtn?.addEventListener('click', handleCopyCurl);

    elements.inspectorTabs.forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (state.pollInterval) {
        clearInterval(state.pollInterval);
      }
    });
  }

  // Restore session from localStorage
  function restoreSession() {
    const saved = localStorage.getItem('playground_session');
    if (saved) {
      try {
        const session = JSON.parse(saved);
        if (session.expiresAt > Date.now()) {
          state = { ...state, ...session };
          showActiveState();
          startPolling();
          return true;
        } else {
          localStorage.removeItem('playground_session');
        }
      } catch {
        localStorage.removeItem('playground_session');
      }
    }
    return false;
  }

  // Handle generate button click
  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(elements.generateBtn, true);

    try {
      const response = await fetch(`${API_BASE}/v1/playground/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create session');
      }

      const data = await response.json();
      state = {
        ...state,
        sessionId: data.sessionId,
        endpointId: data.endpointId,
        endpointUrl: data.endpointUrl,
        secret: data.secret,
        expiresAt: data.expiresAt,
        events: [],
        selectedEventId: null,
      };

      // Save to localStorage
      localStorage.setItem('playground_session', JSON.stringify(state));

      showActiveState();
      startPolling();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(elements.generateBtn, false);
    }
  }

  // Show active state
  function showActiveState() {
    elements.initialSection.style.display = 'none';
    elements.activeSection.classList.add('is-visible');

    // Update endpoint URL display
    const fullUrl = `${window.location.origin}${state.endpointUrl}`;
    elements.endpointUrl.textContent = fullUrl;

    // Generate curl command
    updateCurlCommand();

    // Start session timer
    updateSessionTimer();
  }

  // Update curl command
  function updateCurlCommand() {
    const fullUrl = `${window.location.origin}${state.endpointUrl}`;
    const samplePayload = samplePayloads[elements.eventTypeSelect?.value || 'custom'];
    const payloadStr = JSON.stringify(samplePayload, null, 2).replace(/\n/g, ' \\\n  ');

    const curl = `curl -X POST ${fullUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Event-Type: ${elements.eventTypeSelect?.value || 'custom'}" \\
  -d '${JSON.stringify(samplePayload).replace(/'/g, "\\'")}'`;

    elements.curlCommand.textContent = curl;
  }

  // Handle event type change
  function handleEventTypeChange() {
    const eventType = elements.eventTypeSelect.value;
    const payload = samplePayloads[eventType];
    if (payload) {
      // Replace timestamp placeholder
      const payloadCopy = JSON.parse(JSON.stringify(payload));
      if (payloadCopy.timestamp === '{{timestamp}}') {
        payloadCopy.timestamp = Date.now();
      }
      elements.payloadTextarea.value = JSON.stringify(payloadCopy, null, 2);
    }
    updateCurlCommand();
  }

  // Handle send form submit
  async function handleSend(e) {
    e.preventDefault();
    if (!state.sessionId) return;

    setLoading(elements.sendBtn, true);

    try {
      let payload;
      try {
        payload = JSON.parse(elements.payloadTextarea.value);
      } catch {
        payload = { message: elements.payloadTextarea.value };
      }

      const response = await fetch(`${API_BASE}/v1/playground/sessions/${state.sessionId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Playground-Secret': state.secret,
        },
        body: JSON.stringify({
          eventType: elements.eventTypeSelect.value,
          payload: payload,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send test event');
      }

      // Immediate refresh after send
      await pollEvents();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(elements.sendBtn, false);
    }
  }

  // Handle copy curl
  async function handleCopyCurl() {
    const text = elements.curlCommand.textContent;
    try {
      await navigator.clipboard.writeText(text);
      elements.curlCopyBtn.textContent = 'Copied!';
      elements.curlCopyBtn.classList.add('copied');
      setTimeout(() => {
        elements.curlCopyBtn.innerHTML = 'Copy';
        elements.curlCopyBtn.classList.remove('copied');
      }, 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      elements.curlCopyBtn.textContent = 'Copied!';
      setTimeout(() => {
        elements.curlCopyBtn.innerHTML = 'Copy';
      }, 2000);
    }
  }

  // Start polling
  function startPolling() {
    if (state.pollInterval) {
      clearInterval(state.pollInterval);
    }
    state.pollInterval = setInterval(pollEvents, 2000);
    pollEvents(); // Immediate first poll
  }

  // Poll for events
  async function pollEvents() {
    if (!state.sessionId) return;

    try {
      const url = new URL(
        `${API_BASE}/v1/playground/sessions/${state.sessionId}/events`,
        window.location.origin,
      );
      if (state.events.length > 0) {
        url.searchParams.set('since', String(state.events[0].receivedAt));
      }

      const response = await fetch(url.toString(), {
        headers: { 'X-Playground-Secret': state.secret },
      });
      if (response.status === 410) {
        // Session expired
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        console.error('Poll error:', error);
        return;
      }

      const data = await response.json();

      // Prepend new events (deduplicate by ID)
      if (data.events && data.events.length > 0) {
        const existingIds = new Set(state.events.map((e) => e.id));
        const newEvents = data.events.filter((e) => !existingIds.has(e.id));
        if (newEvents.length > 0) {
          state.events = [...newEvents, ...state.events];
        } else {
          // Update existing events with fresh data (status changes)
          for (const freshEvent of data.events) {
            const idx = state.events.findIndex((e) => e.id === freshEvent.id);
            if (idx !== -1) {
              state.events[idx] = freshEvent;
            }
          }
        }

        // Update inspector if we have a selected event
        if (state.selectedEventId) {
          const updatedEvent = state.events.find((e) => e.id === state.selectedEventId);
          if (updatedEvent) {
            updateInspector(updatedEvent);
          }
        }
      }

      renderEventFeed();
    } catch (err) {
      console.error('Poll failed:', err);
    }
  }

  // Handle session expired
  function handleSessionExpired() {
    alert('Your session has expired. Please generate a new endpoint.');
    resetSession();
  }

  // Reset session
  function resetSession() {
    state = {
      sessionId: null,
      endpointId: null,
      endpointUrl: null,
      secret: null,
      expiresAt: null,
      events: [],
      selectedEventId: null,
      pollInterval: null,
    };
    localStorage.removeItem('playground_session');
    elements.initialSection.style.display = 'flex';
    elements.activeSection.classList.remove('is-visible');
  }

  // Update session timer
  function updateSessionTimer() {
    const remaining = state.expiresAt - Date.now();
    if (remaining <= 0) {
      handleSessionExpired();
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    elements.sessionTimer.textContent = `Session expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Render event feed
  function renderEventFeed() {
    if (state.events.length === 0) {
      elements.eventFeed.innerHTML = `
        <div class="empty-feed">
          <svg class="empty-feed-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24"/>
          </svg>
          <p>No events yet</p>
          <p style="font-size: 12px;">Send a test event or use curl</p>
        </div>
      `;
      return;
    }

    elements.eventFeed.innerHTML = state.events
      .map((event) => {
        const status = getEventStatus(event);
        const timeAgo = formatRelativeTime(event.receivedAt);
        const isSelected = event.id === state.selectedEventId;

        return `
          <div class="event-card ${isSelected ? 'selected' : ''}" data-event-id="${event.id}">
            <div class="event-card-header">
              <span class="event-type-badge">${escapeHtml(event.eventType)}</span>
              <span class="event-timestamp">${timeAgo}</span>
            </div>
            <div class="event-status ${status.class}">
              ${status.icon} ${status.text}
            </div>
          </div>
        `;
      })
      .join('');

    // Bind click events
    elements.eventFeed.querySelectorAll('.event-card').forEach((card) => {
      card.addEventListener('click', () => {
        const eventId = card.dataset.eventId;
        selectEvent(eventId);
      });
    });
  }

  // Get event status
  function getEventStatus(event) {
    const delivery = event.deliveries?.[0];
    if (!delivery) {
      return { icon: '⏳', text: 'pending', class: 'pending' };
    }

    switch (delivery.status) {
      case 'success':
        return { icon: '✓', text: 'delivered', class: 'success' };
      case 'failed':
        return { icon: '✗', text: 'failed', class: 'failed' };
      default:
        return { icon: '⏳', text: delivery.status, class: 'pending' };
    }
  }

  // Select event
  function selectEvent(eventId) {
    state.selectedEventId = eventId;
    const event = state.events.find((e) => e.id === eventId);

    if (event) {
      updateInspector(event);
    }

    // Update selected state in feed
    elements.eventFeed.querySelectorAll('.event-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.eventId === eventId);
    });
  }

  // Update inspector
  function updateInspector(event) {
    elements.noInspector.style.display = 'none';
    elements.inspectorContent.style.display = 'block';

    // Headers panel
    const headersPanel = document.getElementById('inspector-headers');
    if (event.headers) {
      headersPanel.innerHTML = `
        <div class="headers-list">
          ${Object.entries(event.headers)
            .map(
              ([key, value]) => `
              <div class="header-item">
                <span class="header-key">${escapeHtml(key)}</span>
                <span class="header-value">${escapeHtml(String(value))}</span>
              </div>
            `,
            )
            .join('')}
        </div>
      `;
    } else {
      headersPanel.innerHTML = '<p style="color: var(--color-ink-muted);">No headers</p>';
    }

    // Body panel
    const bodyPanel = document.getElementById('inspector-body');
    bodyPanel.innerHTML = `<pre class="inspector-pre">${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>`;

    // Delivery panel
    const deliveryPanel = document.getElementById('inspector-delivery');
    const delivery = event.deliveries?.[0];
    if (delivery) {
      deliveryPanel.innerHTML = `
        <div class="delivery-info">
          <div class="delivery-stat">
            <span class="delivery-stat-label">Status</span>
            <span class="delivery-stat-value">${escapeHtml(delivery.status)}</span>
          </div>
          <div class="delivery-stat">
            <span class="delivery-stat-label">Attempt</span>
            <span class="delivery-stat-value">${delivery.attemptNumber}</span>
          </div>
          <div class="delivery-stat">
            <span class="delivery-stat-label">Response Code</span>
            <span class="delivery-stat-value">${delivery.responseStatusCode || '—'}</span>
          </div>
          <div class="delivery-stat">
            <span class="delivery-stat-label">Duration</span>
            <span class="delivery-stat-value">${delivery.durationMs ? `${delivery.durationMs}ms` : '—'}</span>
          </div>
        </div>
      `;
    } else {
      deliveryPanel.innerHTML =
        '<p style="color: var(--color-ink-muted);">No delivery attempts</p>';
    }
  }

  // Switch tab
  function switchTab(tabName) {
    elements.inspectorTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    elements.inspectorPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `inspector-${tabName}`);
    });
  }

  // Utility: Set loading state
  function setLoading(button, loading) {
    if (loading) {
      button.classList.add('btn-loading');
      button.disabled = true;
    } else {
      button.classList.remove('btn-loading');
      button.disabled = false;
    }
  }

  // Utility: Format relative time
  function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }

  // Utility: Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Update timer every second when active
  setInterval(() => {
    if (state.expiresAt) {
      updateSessionTimer();
    }
  }, 1000);
})();
