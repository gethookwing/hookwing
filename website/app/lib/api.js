/**
 * Dashboard API utilities
 */

const API_BASE = 'https://dev.api.hookwing.com/v1';

const STORAGE_KEY = 'hk_api_key';

/**
 * Get API key from localStorage
 */
function getApiKey() {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Set API key in localStorage
 */
function setApiKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

/**
 * Clear API key from localStorage
 */
function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Make an authenticated API call
 * @param {string} path - API endpoint path (e.g., '/auth/me')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function apiCall(path, options = {}) {
  const key = getApiKey();

  if (!key) {
    // Redirect to signin if no key
    window.location.href = '/signin/';
    return Promise.reject(new Error('No API key'));
  }

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Clear invalid key and redirect
    clearApiKey();
    window.location.href = '/signin/';
    return res;
  }

  return res;
}

/**
 * Sign out - clears API key and redirects to signin
 */
function signOut() {
  clearApiKey();
  window.location.href = '/signin/';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!getApiKey();
}

// Expose as globals for classic script loading
window.API_BASE = API_BASE;
window.getApiKey = getApiKey;
window.setApiKey = setApiKey;
window.clearApiKey = clearApiKey;
window.apiCall = apiCall;
window.signOut = signOut;
window.isAuthenticated = isAuthenticated;
