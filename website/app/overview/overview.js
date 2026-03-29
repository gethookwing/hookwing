/**
 * Overview page - dashboard with stats, recent events, quick actions
 */

(function () {
  'use strict';

  const loadingState = document.getElementById('loading-state');
  const dashboardContent = document.getElementById('dashboard-content');
  const workspaceNameEl = document.getElementById('workspace-name');
  const tierBadgeEl = document.getElementById('tier-badge');
  const welcomeMessage = document.getElementById('welcome-message');
  const signoutBtn = document.getElementById('signout-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  // Stats elements
  const statEndpoints = document.getElementById('stat-endpoints');
  const statEventsToday = document.getElementById('stat-events-today');
  const statDeliveriesToday = document.getElementById('stat-deliveries-today');
  const eventsList = document.getElementById('events-list');

  // Modal elements
  const createEndpointBtn = document.getElementById('create-endpoint-btn');
  const createEndpointModal = document.getElementById('create-endpoint-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelCreateBtn = document.getElementById('cancel-create-btn');
  const createEndpointForm = document.getElementById('create-endpoint-form');

  function setActiveNav() {
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href')?.includes('/app') && (link.getAttribute('href')?.endsWith('/') || link.getAttribute('href')?.endsWith('/app') || link.getAttribute('href')?.endsWith('/app/'))) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function openModal(modal) {
    if (modal) modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
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

      // Set personalized welcome message
      if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome back, ${workspace.name}! Here's what's happening with your webhooks.`;
      }

      loadingState.hidden = true;
      dashboardContent.hidden = false;

      // Load dashboard data
      await Promise.allSettled([
        loadStats(),
        loadRecentEvents(),
      ]);

    } catch (err) {
      console.error('Failed to initialize:', err);
      signOut();
    }
  }

  async function loadStats() {
    try {
      // Load endpoints count
      const endpointsRes = await apiCall('/endpoints');
      if (endpointsRes.ok) {
        const endpointsData = await endpointsRes.json();
        statEndpoints.textContent = endpointsData.endpoints?.length || 0;
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

      // Load today's deliveries
      const deliveriesRes = await apiCall(`/deliveries?since=${since}&limit=100`);
      if (deliveriesRes.ok) {
        const deliveriesData = await deliveriesRes.json();
        statDeliveriesToday.textContent = deliveriesData.deliveries?.length || 0;
      }

    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  async function loadRecentEvents() {
    try {
      const res = await apiCall('/events?limit=10');

      if (!res.ok) {
        eventsList.innerHTML = '<div class="events-empty"><p>Failed to load events</p></div>';
        return;
      }

      const data = await res.json();
      const events = data.events || [];

      renderEvents(events);

    } catch (err) {
      console.error('Failed to load events:', err);
      eventsList.innerHTML = '<div class="events-empty"><p>Failed to load events. Please try again.</p></div>';
    }
  }

  function renderEvents(events) {
    if (events.length === 0) {
      eventsList.innerHTML = '<div class="events-empty"><p>No events yet. Create an endpoint to start receiving webhooks.</p></div>';
      return;
    }

    eventsList.innerHTML = events.slice(0, 10).map(event => {
      const date = new Date(event.receivedAt);
      const timeAgo = formatTimeAgo(date);
      const eventType = getDisplayEventType(event);

      return `
        <div class="resource-item">
          <div class="resource-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="resource-content">
            <span class="resource-title">${escapeHtml(eventType)}</span>
            <span class="resource-meta">${timeAgo}</span>
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

  // Modal handlers
  // Note: Create endpoint button is in the stats section, not the page yet
  // We'll add support for creating from this page if needed
  closeModalBtn?.addEventListener('click', () => closeModal(createEndpointModal));
  cancelCreateBtn?.addEventListener('click', () => closeModal(createEndpointModal));

  createEndpointModal?.addEventListener('click', (e) => {
    if (e.target === createEndpointModal) {
      closeModal(createEndpointModal);
    }
  });

  // Create endpoint form
  createEndpointForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const urlInput = document.getElementById('endpoint-url');
    const descInput = document.getElementById('endpoint-description');

    const url = urlInput?.value?.trim();
    const description = descInput?.value?.trim();

    if (!url) {
      urlInput?.focus();
      return;
    }

    const submitBtn = createEndpointForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
    }

    try {
      const res = await apiCall('/endpoints', {
        method: 'POST',
        body: JSON.stringify({ url, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to create endpoint');
        return;
      }

      closeModal(createEndpointModal);
      createEndpointForm.reset();
      await loadStats();

    } catch (err) {
      console.error('Failed to create endpoint:', err);
      alert('Failed to create endpoint. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create endpoint';
      }
    }
  });

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

  init();
})();