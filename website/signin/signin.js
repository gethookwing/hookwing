/**
 * Sign in form handling
 */

const API_BASE = 'https://dev.api.hookwing.com/v1';

(function () {
  'use strict';

  const form = document.getElementById('signin-form');
  const errorMessage = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    errorMessage.hidden = true;
    errorMessage.textContent = '';

    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Client-side validation
    if (!email || !password) {
      showError('Please enter both email and password.');
      resetButton();
      return;
    }

    try {
      const res = await fetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Sign in failed. Please try again.');
        resetButton();
        return;
      }

      // Store API key in localStorage
      localStorage.setItem('hk_api_key', data.apiKey);

      // Redirect to dashboard
      window.location.href = '/app/';
    } catch (err) {
      showError('Network error. Please try again.');
      resetButton();
    }
  });

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  function resetButton() {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
  }
})();
