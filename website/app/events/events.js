/**
 * Events page - list webhook events with expandable payload
 */

(function () {
  'use strict';

  const eventsList = document.getElementById('events-list');
  const loadingState = document.getElementById('loading-state');
  const dashboardContent = document.getElementById('dashboard-content');
  const workspaceNameEl = document.getElementById('workspace-name');
  const tierBadgeEl = document.getElementById('tier-badge');
  const signoutBtn = document.getElementById('signout-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const paginationInfo = document.getElementById('pagination-info');

  let currentPage = 1;
  const limit = 50;
  let hasMore = false;

  function setActiveNav() {
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href')?.includes('/app/events')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  async function init() {
    setActiveNav();

    if (!isAuthenticated()) {
      window.location.href = '/signin/';
      return;
    }

    try {
      const meRes = await apiCall('/auth/me');
      if (!meRes.ok) {
        signOut();
        return;
      }

      const meData = await meRes.json();
      const workspace = meData.workspace;

      workspaceNameEl.textContent = workspace.name;
      tierBadgeEl.textContent = workspace.tier?.name || 'Free';

      loadingState.hidden = true;
      dashboardContent.hidden = false;

      await loadEvents();

    } catch (err) {
      console.error('Failed to initialize:', err);
      signOut();
    }
  }

  async function loadEvents(page = 1) {
    try {
      const offset = (page - 1) * limit;
      const res = await apiCall(`/events?limit=${limit}&offset=${offset}`);

      if (!res.ok) {
        const data = await res.json();
        eventsList.innerHTML = `<div class="events-empty"><p>${data.error || 'Failed to load events'}</p></div>`;
        return;
      }

      const data = await res.json();
      const events = data.events || [];

      hasMore = events.length === limit;
      currentPage = page;

      renderEvents(events);
      updatePagination();

    } catch (err) {
      console.error('Failed to load events:', err);
      eventsList.innerHTML = `<div class="events-empty"><p>Failed to load events. Please try again.</p></div>`;
    }
  }

  function renderEvents(events) {
    if (events.length === 0) {
      eventsList.innerHTML = '<div class="events-empty"><p>No events yet. Create an endpoint to start receiving webhooks.</p></div>';
      return;
    }

    eventsList.innerHTML = events.map(event => {
      const payloadJson = JSON.stringify(event.payload || {}, null, 2);
      const eventType = getDisplayEventType(event);
      const timeAgo = formatTimeAgo(new Date(event.receivedAt));

      return `
        <div class="resource-item event-expandable" onclick="toggleEventPayload(this)">
          <div class="resource-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="resource-content">
            <span class="resource-title">${escapeHtml(eventType)}</span>
            <span class="resource-meta">${escapeHtml(event.id || 'event')} · ${timeAgo}</span>
            <div class="event-payload">
              <pre>${escapeHtml(payloadJson)}</pre>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getDisplayEventType(event) {
    const nestedEventType = event?.payload?.event_type;

    if (event?.eventType && event.eventType !== 'unknown') {
      return event.eventType;
    }

    if (typeof nestedEventType === 'string' && nestedEventType.trim().length > 0) {
      return nestedEventType;
    }

    return event?.eventType || 'unknown';
  }

  function toggleEventPayload(element) {
    const payload = element.querySelector('.event-payload');
    if (payload) {
      payload.classList.toggle('open');
    }
  }

  window.toggleEventPayload = toggleEventPayload;

  function updatePagination() {
    paginationInfo.textContent = `Page ${currentPage}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = !hasMore;
  }

  function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString();
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Sign out handler
  signoutBtn?.addEventListener('click', () => {
    signOut();
  });

  // Sidebar toggle
  sidebarToggle?.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('is-open');
    sidebarToggle.setAttribute('aria-expanded', isOpen);
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('is-open') &&
        !sidebar.contains(e.target) &&
        !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('is-open');
      sidebarToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Pagination
  prevBtn?.addEventListener('click', async () => {
    if (currentPage > 1) {
      await loadEvents(currentPage - 1);
    }
  });

  nextBtn?.addEventListener('click', async () => {
    if (hasMore) {
      await loadEvents(currentPage + 1);
    }
  });

  init();
})();