(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const nameInput = document.querySelector('#contact-name');
  const emailInput = document.querySelector('#contact-email');
  const messageInput = document.querySelector('#contact-message');
  const honeypot = document.querySelector('#contact-website');
  const startedAtInput = document.querySelector('#contact-started-at');
  const charCount = document.querySelector('#contact-char-count');
  const status = document.querySelector('#contact-status');
  const submitButton = document.querySelector('#contact-submit');
  const submitText = submitButton?.querySelector('.contact-submit-text');
  const turnstileContainer = document.querySelector('#contact-turnstile');
  const turnstileHint = document.querySelector('#contact-turnstile-hint');
  const sitekey = document.querySelector('meta[name="turnstile-sitekey"]')?.content?.trim();

  let widgetId = null;
  let turnstileToken = '';
  let renderAttempts = 0;

  const setStartedAt = () => {
    if (startedAtInput) startedAtInput.value = String(Date.now());
  };

  const updateCounter = () => {
    if (charCount && messageInput) {
      charCount.textContent = String(messageInput.value.length);
    }
  };

  const setStatus = (message = '', type = '') => {
    if (!status) return;
    status.textContent = message;
    status.className = `contact-pro-status${type ? ` is-${type}` : ''}`;
  };

  const setLoading = loading => {
    if (!submitButton) return;
    submitButton.disabled = loading;
    submitButton.classList.toggle('is-loading', loading);
    if (submitText) submitText.textContent = loading ? 'Sending...' : 'Send message';
  };

  const resetTurnstile = () => {
    turnstileToken = '';
    if (widgetId !== null && window.turnstile?.reset) {
      window.turnstile.reset(widgetId);
    }
  };

  const markValidity = input => {
    if (!input) return true;
    const valid = input.checkValidity();
    input.setAttribute('aria-invalid', String(!valid));
    return valid;
  };

  const renderTurnstile = () => {
    if (!turnstileContainer) return;

    if (!sitekey || sitekey === 'REPLACE_WITH_TURNSTILE_SITE_KEY') {
      turnstileHint.textContent =
        'Add your Cloudflare Turnstile sitekey in the <meta name="turnstile-sitekey"> tag.';
      turnstileHint.classList.add('is-error');
      return;
    }

    if (!window.turnstile?.render) {
      renderAttempts += 1;
      if (renderAttempts < 80) {
        window.setTimeout(renderTurnstile, 125);
      } else {
        turnstileHint.textContent = 'Security verification could not load. Please refresh the page.';
        turnstileHint.classList.add('is-error');
      }
      return;
    }

    if (widgetId !== null) return;

    widgetId = window.turnstile.render('#contact-turnstile', {
      sitekey,
      theme: 'light',
      size: 'flexible',
      appearance: 'interaction-only',
      action: 'contact',
      callback(token) {
        turnstileToken = token;
        turnstileHint.textContent = 'Security verification ready.';
        turnstileHint.classList.remove('is-error');
      },
      'expired-callback'() {
        turnstileToken = '';
        turnstileHint.textContent = 'Security verification expired. Please try again.';
        turnstileHint.classList.add('is-error');
      },
      'error-callback'() {
        turnstileToken = '';
        turnstileHint.textContent = 'Security verification failed to load. Please retry.';
        turnstileHint.classList.add('is-error');
      },
      'timeout-callback'() {
        turnstileToken = '';
        turnstileHint.textContent = 'Security verification timed out. Please retry.';
        turnstileHint.classList.add('is-error');
      }
    });
  };

  [nameInput, emailInput, messageInput].forEach(input => {
    input?.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      if (input === messageInput) updateCounter();
    });
    input?.addEventListener('blur', () => markValidity(input));
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus();

    const fieldsValid = [nameInput, emailInput, messageInput]
      .map(markValidity)
      .every(Boolean);

    if (!fieldsValid) {
      setStatus('Please check the highlighted fields.', 'error');
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    if (!turnstileToken && widgetId !== null && window.turnstile?.getResponse) {
      turnstileToken = window.turnstile.getResponse(widgetId) || '';
    }

    if (!turnstileToken) {
      setStatus('Please complete the security verification first.', 'error');
      turnstileHint?.classList.add('is-error');
      turnstileContainer?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const requestId = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const payload = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      message: messageInput.value.trim(),
      website: honeypot?.value || '',
      startedAt: Number(startedAtInput?.value || Date.now()),
      turnstileToken,
      requestId
    };

    setLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Could not send your message.');
      }

      form.reset();
      updateCounter();
      setStartedAt();
      resetTurnstile();

      setStatus(
        `Message sent${payload.name ? `, ${payload.name}` : ''}. Thanks for reaching out ✦`,
        'success'
      );
    } catch (error) {
      resetTurnstile();
      setStatus(
        error?.message || 'Something went wrong. Please try again or email me directly.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  });

  setStartedAt();
  updateCounter();
  renderTurnstile();
})();
