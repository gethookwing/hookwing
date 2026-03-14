/**
 * Sign up form handling
 */

const API_BASE = 'https://dev.api.hookwing.com/v1';

(function () {
  'use strict';

  const form = document.getElementById('signup-form');
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
    submitBtn.textContent = 'Creating account...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const workspaceName = document.getElementById('workspace-name').value.trim();

    // Client-side validation
    if (!email || !password || !confirmPassword) {
      showError('Please fill in all required fields.');
      resetButton();
      return;
    }

    if (password.length < 8) {
      showError('Password must be at least 8 characters.');
      resetButton();
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      resetButton();
      return;
    }

    try {
      const res = await fetch(API_BASE + '/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          workspaceName: workspaceName || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Sign up failed. Please try again.');
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
    submitBtn.textContent = 'Create account';
  }
})();
