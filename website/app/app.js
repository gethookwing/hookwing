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
  const pageTitleEl = document.querySelector('.page-title');
  const pageSubtitleEl = document.querySelector('.page-subtitle');
  const navLinks = Array.from(document.querySelectorAll('.sidebar-nav-link'));
  const overviewHeader = document.getElementById('overview-header');
  const overviewStats = document.getElementById('overview-stats');
  const overviewActions = document.getElementById('overview-actions');
  const overviewRecentEvents = document.getElementById('overview-recent-events');
  const routeViews = {
    endpoints: document.getElementById('endpoints-view'),
    events: document.getElementById('events-view'),
    keys: document.getElementById('keys-view'),
    settings: document.getElementById('settings-view'),
  };

  const routeMeta = {
    overview: {
      title: 'Overview',
      subtitle: "Welcome back! Here's what's happening with your webhooks.",
    },
    endpoints: {
      title: 'Endpoints',
      subtitle: 'Manage the destinations receiving your webhook traffic.',
    },
    events: {
      title: 'Events',
      subtitle: 'Inspect recent webhook events and delivery activity.',
    },
    keys: {
      title: 'API Keys',
      subtitle: 'Review active API keys used to automate your workspace.',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Workspace identity and current plan details.',
    },
  };

  // Stats elements
  const statEndpoints = document.getElementById('stat-endpoints');
  const statEventsToday = document.getElementById('stat-events-today');
  const statApiKeys = document.getElementById('stat-api-keys');
  const eventsList = document.getElementById('events-list');
  const endpointsList = document.getElementById('endpoints-list');
  const allEventsList = document.getElementById('all-events-list');
  const keysList = document.getElementById('keys-list');
  const settingsWorkspaceName = document.getElementById('settings-workspace-name');
  const settingsWorkspaceEmail = document.getElementById('settings-workspace-email');
  const settingsWorkspaceTier = document.getElementById('settings-workspace-tier');
  const settingsWorkspaceSlug = document.getElementById('settings-workspace-slug');

  function getCurrentSection() {
    const path = window.location.pathname.replace(/\/+$/, '');

    if (path.endsWith('/app') || path === '/app') {
      return 'overview';
    }

    if (path.includes('/app/endpoints')) {
      return 'endpoints';
    }

    if (path.includes('/app/events')) {
      return 'events';
    }

    if (path.includes('/app/keys')) {
      return 'keys';
    }

    if (path.includes('/app/settings')) {
      return 'settings';
    }

    return 'overview';
  }

  function applyRouteMeta() {
    const section = getCurrentSection();
    const meta = routeMeta[section] || routeMeta.overview;

    if (pageTitleEl) {
      pageTitleEl.textContent = meta.title;
    }

    if (pageSubtitleEl) {
      pageSubtitleEl.textContent = meta.subtitle;
    }

    navLinks.forEach((link) => {
      const isActive = link.dataset.nav === section;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function applyRouteView() {
    const section = getCurrentSection();
    const showOverview = section === 'overview';

    [overviewHeader, overviewStats, overviewActions, overviewRecentEvents].forEach((element) => {
      if (element) {
        element.hidden = !showOverview;
      }
    });

    Object.entries(routeViews).forEach(([view, element]) => {
      if (element) {
        element.hidden = view !== section;
      }
    });
  }

  /**
   * Initialize the dashboard
   */
  async function init() {
    applyRouteMeta();
    applyRouteView();

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

      populateSettings(workspace);

      // Show dashboard
      loadingState.hidden = true;
      dashboardContent.hidden = false;

      // Load non-critical dashboard data after the shell is visible.
      Promise.allSettled([
        loadStats(),
        loadRecentEvents(),
        loadEndpointsView(),
        loadEventsView(),
        loadKeysView(),
      ]);

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

  async function loadEndpointsView() {
    if (!endpointsList) {
      return;
    }

    try {
      const res = await apiCall('/endpoints');
      if (!res.ok) {
        return;
      }

      const data = await res.json();
      const endpoints = data.endpoints || [];

      if (endpoints.length === 0) {
        endpointsList.innerHTML = '<div class="events-empty"><p>No endpoints yet. Create your first destination from the overview page.</p></div>';
        return;
      }

      endpointsList.innerHTML = endpoints.map((endpoint) => `
        <div class="resource-item">
          <div class="resource-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <div class="resource-content">
            <span class="resource-title">${escapeHtml(endpoint.url)}</span>
            <span class="resource-meta">${escapeHtml(endpoint.description || 'No description')} · ${endpoint.isActive ? 'Active' : 'Paused'}</span>
            <div class="resource-badges">
              <span class="resource-badge">${endpoint.fanoutEnabled ? 'Fan-out on' : 'Fan-out off'}</span>
              <span class="resource-badge">Created ${formatTimeAgo(new Date(endpoint.createdAt))}</span>
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load endpoints view:', err);
    }
  }

  async function loadEventsView() {
    if (!allEventsList) {
      return;
    }

    try {
      const res = await apiCall('/events?limit=25');
      if (!res.ok) {
        return;
      }

      const data = await res.json();
      const events = data.events || [];

      if (events.length === 0) {
        allEventsList.innerHTML = '<div class="events-empty"><p>No events captured yet.</p></div>';
        return;
      }

      allEventsList.innerHTML = events.map((event) => `
        <div class="resource-item">
          <div class="resource-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="resource-content">
            <span class="resource-title">${escapeHtml(event.eventType || 'unknown')}</span>
            <span class="resource-meta">${escapeHtml(event.id || 'event')} · ${formatTimeAgo(new Date(event.receivedAt))}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load events view:', err);
    }
  }

  async function loadKeysView() {
    if (!keysList) {
      return;
    }

    try {
      const res = await apiCall('/auth/keys');
      if (!res.ok) {
        return;
      }

      const data = await res.json();
      const keys = data.keys || [];

      if (keys.length === 0) {
        keysList.innerHTML = '<div class="events-empty"><p>No API keys found.</p></div>';
        return;
      }

      keysList.innerHTML = keys.map((key) => `
        <div class="resource-item">
          <div class="resource-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
          </div>
          <div class="resource-content">
            <span class="resource-title">${escapeHtml(key.name || 'Unnamed key')}</span>
            <span class="resource-meta">${escapeHtml(key.prefix || '')} · ${key.isActive ? 'Active' : 'Revoked'}</span>
            <div class="resource-badges">
              <span class="resource-badge">Created ${formatTimeAgo(new Date(key.createdAt))}</span>
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load keys view:', err);
    }
  }

  function populateSettings(workspace) {
    if (settingsWorkspaceName) {
      settingsWorkspaceName.textContent = workspace.name || '—';
    }
    if (settingsWorkspaceEmail) {
      settingsWorkspaceEmail.textContent = workspace.email || '—';
    }
    if (settingsWorkspaceTier) {
      settingsWorkspaceTier.textContent = workspace.tier?.name || '—';
    }
    if (settingsWorkspaceSlug) {
      settingsWorkspaceSlug.textContent = workspace.slug || '—';
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
