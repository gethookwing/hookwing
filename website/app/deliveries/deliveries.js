/**
 * Deliveries page - list webhook delivery attempts with retry functionality
 */

(function () {
  'use strict';

  const deliveriesList = document.getElementById('deliveries-list');
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

  // Set active nav link
  function setActiveNav() {
    const path = window.location.pathname;
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      link.classList.remove('active');
      if (path.includes('/app/deliveries')) {
        link.dataset.nav = 'deliveries';
      }
      if (link.getAttribute('href')?.includes('/deliveries') || (path.includes('/app/deliveries') && link.getAttribute('href')?.includes('deliveries'))) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  async function init() {
    setActiveNav();

    // Check authentication
    if (!isAuthenticated()) {
      window.location.href = '/signin/';
      return;
    }

    // Load workspace info
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

      // Show dashboard
      loadingState.hidden = true;
      dashboardContent.hidden = false;

      // Load deliveries
      await loadDeliveries();

    } catch (err) {
      console.error('Failed to initialize:', err);
      signOut();
    }
  }

  async function loadDeliveries(page = 1) {
    try {
      const offset = (page - 1) * limit;
      const res = await apiCall(`/deliveries?limit=${limit}&offset=${offset}`);

      if (!res.ok) {
        const data = await res.json();
        deliveriesList.innerHTML = `<div class="events-empty"><p>${data.error || 'Failed to load deliveries'}</p></div>`;
        return;
      }

      const data = await res.json();
      const deliveries = data.deliveries || [];

      hasMore = deliveries.length === limit;
      currentPage = page;

      renderDeliveries(deliveries);
      updatePagination();

    } catch (err) {
      console.error('Failed to load deliveries:', err);
      deliveriesList.innerHTML = `<div class="events-empty"><p>Failed to load deliveries. Please try again.</p></div>`;
    }
  }

  function renderDeliveries(deliveries) {
    if (deliveries.length === 0) {
      deliveriesList.innerHTML = '<div class="events-empty"><p>No deliveries yet. Create an endpoint to start receiving webhooks.</p></div>';
      return;
    }

    deliveriesList.innerHTML = deliveries.map(delivery => {
      const status = delivery.status || 'pending';
      const statusCode = delivery.responseStatusCode;
      const statusClass = getStatusClass(statusCode);
      const timeAgo = formatTimeAgo(new Date(delivery.createdAt));

      return `
        <div class="resource-item">
          <div class="resource-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div class="resource-content">
            <span class="resource-title">${escapeHtml(delivery.endpointUrl || delivery.endpointId || 'Unknown endpoint')}</span>
            <span class="resource-meta">${escapeHtml(delivery.eventId || delivery.id || 'delivery')} · ${timeAgo}</span>
            <div class="resource-badges">
              <span class="resource-badge status-badge ${statusClass}">${status}</span>
              <span class="resource-badge">${delivery.attempts || 1} attempt${delivery.attempts > 1 ? 's' : ''}</span>
            </div>
          </div>
          ${delivery.responseStatusCode >= 400 || delivery.responseStatusCode === null ? `
            <button class="btn btn-sm btn-secondary retry-btn" onclick="handleRetry('${delivery.eventId || delivery.id}')" aria-label="Retry delivery">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Retry
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function getStatusClass(statusCode) {
    if (statusCode === 'delivered' || statusCode === 'success') return 'status-success';
    if (statusCode === 'failed' || statusCode === 'client_error') return 'status-client-error';
    if (statusCode === 'server_error') return 'status-server-error';
    if (statusCode === 'pending' || statusCode === 'retrying') return 'status-pending';
    if (statusCode === 'delivered') return 'status-success';
    if (typeof statusCode === 'number') {
      if (statusCode >= 200 && statusCode < 300) return 'status-success';
      if (statusCode >= 400 && statusCode < 500) return 'status-client-error';
      if (statusCode >= 500) return 'status-server-error';
    }
    return 'status-other';
  }

  function updatePagination() {
    paginationInfo.textContent = `Page ${currentPage}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = !hasMore;
  }

  window.handleRetry = async function(eventId) {
    if (!eventId) return;

    if (!confirm('Retry this delivery?')) {
      return;
    }

    try {
      const res = await apiCall(`/events/${eventId}/replay`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to retry delivery');
        return;
      }

      alert('Delivery queued for retry');
      await loadDeliveries(currentPage);

    } catch (err) {
      console.error('Failed to retry:', err);
      alert('Failed to retry delivery. Please try again.');
    }
  };

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

  // Event listeners
  signoutBtn?.addEventListener('click', () => {
    signOut();
  });

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

  prevBtn?.addEventListener('click', async () => {
    if (currentPage > 1) {
      await loadDeliveries(currentPage - 1);
    }
  });

  nextBtn?.addEventListener('click', async () => {
    if (hasMore) {
      await loadDeliveries(currentPage + 1);
    }
  });

  // Initialize
  init();
})();