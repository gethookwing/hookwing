/**
 * Dashboard app initialization and data loading
 */

(function () {
  'use strict';

  // DOM elements
  const loadingState = document.getElementById('loading-state');
  const dashboardContent = document.getElementById('dashboard-content');
  const workspaceNameEl = document.getElementById('workspace-name');
  const tierBadgeEl = document.getElementById('tier-badge');
  const signoutBtn = document.getElementById('signout-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  // Stats elements
  const statEndpoints = document.getElementById('stat-endpoints');
  const statEventsToday = document.getElementById('stat-events-today');
  const statApiKeys = document.getElementById('stat-api-keys');
  const eventsList = document.getElementById('events-list');

  /**
   * Initialize the dashboard
   */
  async function init() {
    // Check authentication
    if (!isAuthenticated()) {
      window.location.href = '/signin/';
      return;
    }

    // Verify session with /v1/auth/me
    try {
      const meRes = await apiCall('/auth/me');

      if (!meRes.ok) {
        signOut();
        return;
      }

      const meData = await meRes.json();
      const workspace = meData.workspace;

      // Set workspace info in topbar
      workspaceNameEl.textContent = workspace.name;
      tierBadgeEl.textContent = workspace.tier.name || 'Free';

      // Load dashboard data
      await Promise.all([
        loadStats(),
        loadRecentEvents(),
      ]);

      // Show dashboard
      loadingState.hidden = true;
      dashboardContent.hidden = false;

    } catch (err) {
      console.error('Failed to initialize dashboard:', err);
      signOut();
    }
  }

  /**
   * Load stats from API
   */
  async function loadStats() {
    try {
      // Load endpoints count
      const endpointsRes = await apiCall('/endpoints');
      if (endpointsRes.ok) {
        const endpointsData = await endpointsRes.json();
        statEndpoints.textContent = endpointsData.endpoints?.length || 0;
      }

      // Load API keys count
      const keysRes = await apiCall('/auth/keys');
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        statApiKeys.textContent = keysData.keys?.filter(k => k.isActive).length || 0;
      }

      // Load today's events
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const since = today.getTime();

      const eventsRes = await apiCall(`/events?since=${since}&limit=100`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        statEventsToday.textContent = eventsData.events?.length || 0;
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  /**
   * Load recent events
   */
  async function loadRecentEvents() {
    try {
      const res = await apiCall('/events?limit=10');

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      const events = data.events || [];

      if (events.length === 0) {
        eventsList.innerHTML = `
          <div class="events-empty">
            <p>No events yet. Create an endpoint to start receiving webhooks.</p>
          </div>
        `;
        return;
      }

      eventsList.innerHTML = events.slice(0, 10).map(event => {
        const date = new Date(event.receivedAt);
        const timeAgo = formatTimeAgo(date);

        return `
          <div class="event-item">
            <div class="event-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div class="event-content">
              <span class="event-type">${escapeHtml(event.eventType)}</span>
              <span class="event-meta">${timeAgo}</span>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Failed to load events:', err);
    }
  }

  /**
   * Format time ago string
   */
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

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Handle sign out
   */
  signoutBtn.addEventListener('click', () => {
    signOut();
  });

  /**
   * Handle sidebar toggle on mobile
   */
  sidebarToggle?.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('is-open');
    sidebarToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('is-open') &&
        !sidebar.contains(e.target) &&
        !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('is-open');
      sidebarToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Initialize on load
  init();
})();
