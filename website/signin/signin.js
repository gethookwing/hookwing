/**
 * Sign in form handling — with inline validation + focus management
 */

const API_BASE = (window.location.hostname === 'hookwing.com' ? 'https://api.hookwing.com' : 'https://dev.api.hookwing.com') + '/v1';

(function () {
  'use strict';

  const form = document.getElementById('signin-form');
  const errorMessage = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  if (!form) return;

  const fields = {
    email: document.getElementById('email'),
    password: document.getElementById('password'),
  };

  // Add inline error elements after each field
  for (const [key, input] of Object.entries(fields)) {
    if (!input) continue;
    const err = document.createElement('div');
    err.className = 'field-error';
    err.id = `${key}-error`;
    err.setAttribute('role', 'alert');
    err.hidden = true;
    input.parentNode.appendChild(err);
    input.addEventListener('input', () => clearFieldError(input, err));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email = fields.email.value.trim();
    const password = fields.password.value;

    let firstInvalid = null;

    if (!email) {
      setFieldError(fields.email, 'email', 'Email is required.');
      firstInvalid = firstInvalid || fields.email;
    }

    if (!password) {
      setFieldError(fields.password, 'password', 'Password is required.');
      firstInvalid = firstInvalid || fields.password;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('btn-loading');
    submitBtn.textContent = 'Signing in...';

    try {
      const res = await fetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Sign in failed. Please try again.');
        resetButton();
        return;
      }

      localStorage.setItem('hk_api_key', data.apiKey);
      window.location.href = '/app/';
    } catch (err) {
      showError('Network error. Please try again.');
      resetButton();
    }
  });

  function setFieldError(input, key, message) {
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');
    const errEl = document.getElementById(`${key}-error`);
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }

  function clearFieldError(input, errEl) {
    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');
    if (errEl) {
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }

  function clearAllErrors() {
    errorMessage.hidden = true;
    errorMessage.textContent = '';
    for (const [key, input] of Object.entries(fields)) {
      if (!input) continue;
      const errEl = document.getElementById(`${key}-error`);
      clearFieldError(input, errEl);
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    errorMessage.focus();
  }

  function resetButton() {
    submitBtn.disabled = false;
    submitBtn.classList.remove('btn-loading');
    submitBtn.textContent = 'Sign in';
  }
})();
