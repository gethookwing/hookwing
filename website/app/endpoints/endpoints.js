/**
 * Endpoints page - CRUD for webhook endpoints
 */

(function () {
  'use strict';

  const endpointsList = document.getElementById('endpoints-list');
  const loadingState = document.getElementById('loading-state');
  const dashboardContent = document.getElementById('dashboard-content');
  const workspaceNameEl = document.getElementById('workspace-name');
  const tierBadgeEl = document.getElementById('tier-badge');
  const signoutBtn = document.getElementById('signout-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  // Modal elements
  const createEndpointBtn = document.getElementById('create-endpoint-btn');
  const createEndpointModal = document.getElementById('create-endpoint-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelCreateBtn = document.getElementById('cancel-create-btn');
  const createEndpointForm = document.getElementById('create-endpoint-form');

  function setActiveNav() {
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href')?.includes('/app/endpoints')) {
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

      loadingState.hidden = true;
      dashboardContent.hidden = false;

      await loadEndpoints();

    } catch (err) {
      console.error('Failed to initialize:', err);
      signOut();
    }
  }

  async function loadEndpoints() {
    try {
      const res = await apiCall('/endpoints');
      if (!res.ok) {
        const data = await res.json();
        endpointsList.innerHTML = `<div class="events-empty"><p>${data.error || 'Failed to load endpoints'}</p></div>`;
        return;
      }

      const data = await res.json();
      const endpoints = data.endpoints || [];

      renderEndpoints(endpoints);

    } catch (err) {
      console.error('Failed to load endpoints:', err);
      endpointsList.innerHTML = `<div class="events-empty"><p>Failed to load endpoints. Please try again.</p></div>`;
    }
  }

  function renderEndpoints(endpoints) {
    if (endpoints.length === 0) {
      endpointsList.innerHTML = '<div class="events-empty"><p>No endpoints yet. Create your first destination to start receiving webhooks.</p></div>';
      return;
    }

    endpointsList.innerHTML = endpoints.map(endpoint => `
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
        <button class="resource-delete" onclick="handleDeleteEndpoint('${endpoint.id}')" aria-label="Delete endpoint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `).join('');
  }

  window.handleDeleteEndpoint = async function(id) {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this endpoint?')) {
      return;
    }

    try {
      const res = await apiCall(`/endpoints/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to delete endpoint');
        return;
      }

      await loadEndpoints();

    } catch (err) {
      console.error('Failed to delete endpoint:', err);
      alert('Failed to delete endpoint. Please try again.');
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

  // Modal handlers
  createEndpointBtn?.addEventListener('click', () => openModal(createEndpointModal));
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
      await loadEndpoints();

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