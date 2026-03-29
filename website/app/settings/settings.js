/**
 * Settings page - workspace info, API keys CRUD, billing links
 */

(function () {
  'use strict';

  const loadingState = document.getElementById('loading-state');
  const dashboardContent = document.getElementById('dashboard-content');
  const workspaceNameEl = document.getElementById('workspace-name');
  const tierBadgeEl = document.getElementById('tier-badge');
  const signoutBtn = document.getElementById('signout-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  // Settings elements
  const settingsWorkspaceName = document.getElementById('settings-workspace-name');
  const settingsWorkspaceEmail = document.getElementById('settings-workspace-email');
  const settingsWorkspaceTier = document.getElementById('settings-workspace-tier');
  const settingsWorkspaceSlug = document.getElementById('settings-workspace-slug');
  const settingsPlanName = document.getElementById('settings-plan-name');
  const settingsPlanStatus = document.getElementById('settings-plan-status');
  const keysList = document.getElementById('keys-list');

  // Modal elements
  const createKeyBtn = document.getElementById('create-key-btn');
  const createKeyModal = document.getElementById('create-key-modal');
  const closeKeyModalBtn = document.getElementById('close-key-modal-btn');
  const cancelCreateKeyBtn = document.getElementById('cancel-create-key-btn');
  const createKeyForm = document.getElementById('create-key-form');
  const manageBillingBtn = document.getElementById('manage-billing-btn');

  function setActiveNav() {
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href')?.includes('/app/settings')) {
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

      populateSettings(workspace);

      loadingState.hidden = true;
      dashboardContent.hidden = false;

      // Load API keys after basic info is shown
      await loadKeys();

    } catch (err) {
      console.error('Failed to initialize:', err);
      signOut();
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
    if (settingsPlanName) {
      settingsPlanName.textContent = workspace.tier?.name || 'Free';
    }
    if (settingsPlanStatus) {
      settingsPlanStatus.textContent = workspace.tier?.isActive !== false ? 'Active' : 'Inactive';
    }
  }

  async function loadKeys() {
    try {
      const res = await apiCall('/auth/keys');
      if (!res.ok) {
        keysList.innerHTML = '<div class="events-empty"><p>Failed to load API keys</p></div>';
        return;
      }

      const data = await res.json();
      const keys = data.keys || [];

      renderKeys(keys);

    } catch (err) {
      console.error('Failed to load keys:', err);
      keysList.innerHTML = '<div class="events-empty"><p>Failed to load API keys. Please try again.</p></div>';
    }
  }

  function renderKeys(keys) {
    if (keys.length === 0) {
      keysList.innerHTML = '<div class="events-empty"><p>No API keys yet. Create one to get started.</p></div>';
      return;
    }

    keysList.innerHTML = keys.map(key => `
      <div class="resource-item">
        <div class="resource-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
        </div>
        <div class="resource-content">
          <span class="resource-title">${escapeHtml(key.name || 'Unnamed key')}</span>
          <span class="resource-meta">${escapeHtml(key.prefix || '')}xxx · ${key.isActive ? 'Active' : 'Revoked'}</span>
          <div class="resource-badges">
            <span class="resource-badge">Created ${formatTimeAgo(new Date(key.createdAt))}</span>
          </div>
        </div>
        ${key.isActive ? `
          <button class="resource-delete" onclick="handleRevokeKey('${key.id}')" aria-label="Revoke key">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle x="3" y="11" r="1"></circle>
              <circle x="7" y="11" r="1"></circle>
              <circle x="11" y="11" r="1"></circle>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
          </button>
        ` : ''}
      </div>
    `).join('');
  }

  // Create key modal
  createKeyBtn?.addEventListener('click', () => openModal(createKeyModal));
  closeKeyModalBtn?.addEventListener('click', () => closeModal(createKeyModal));
  cancelCreateKeyBtn?.addEventListener('click', () => closeModal(createKeyModal));

  createKeyModal?.addEventListener('click', (e) => {
    if (e.target === createKeyModal) {
      closeModal(createKeyModal);
    }
  });

  // Create key form
  createKeyForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('key-name');
    const name = nameInput?.value?.trim();

    if (!name) {
      nameInput?.focus();
      return;
    }

    const submitBtn = createKeyForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
    }

    try {
      const res = await apiCall('/auth/keys', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to create API key');
        return;
      }

      // Show the full key once
      if (data.key) {
        alert(`API key created!\n\nYour API key: ${data.key}\n\nSave this now — you won't see it again.`);
      }

      closeModal(createKeyModal);
      createKeyForm.reset();
      await loadKeys();

    } catch (err) {
      console.error('Failed to create key:', err);
      alert('Failed to create API key. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create key';
      }
    }
  });

  // Manage billing button
  manageBillingBtn?.addEventListener('click', async () => {
    try {
      const res = await apiCall('/billing/portal', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to open billing portal');
        return;
      }

      // Redirect to Stripe billing portal
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Failed to open billing:', err);
    }
  });

  // Global handlers
  window.handleRevokeKey = async function(id) {
    if (!id) return;
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await apiCall(`/auth/keys/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to revoke API key');
        return;
      }

      await loadKeys();

    } catch (err) {
      console.error('Failed to revoke key:', err);
      alert('Failed to revoke API key. Please try again.');
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