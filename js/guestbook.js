(() => {
  const section = document.querySelector('.prefooter-guestbook');
  const toggle = document.querySelector('#guestbook-toggle');
  const panel = document.querySelector('#guestbook-panel');
  const closeButton = document.querySelector('[data-guestbook-close]');
  const toggleLabel = document.querySelector('[data-guestbook-toggle-label]');

  const form = document.querySelector('#guestbook-form');
  const nameInput = document.querySelector('#guestbook-name');
  const messageInput = document.querySelector('#guestbook-message');
  const charCount = document.querySelector('#guestbook-char-count');
  const notesContainer = document.querySelector('#guestbook-notes');
  const noteCount = document.querySelector('#guestbook-note-count');
  const status = document.querySelector('#guestbook-status');

  if (!section || !toggle || !panel) return;

  const STORAGE_KEY = 'limun-guestbook-ui-preview';
  const MAX_LOCAL_NOTES = 6;
  const noteClasses = [
    'guestbook-note-aqua',
    'guestbook-note-lavender',
    'guestbook-note-pink',
    'guestbook-note-yellow',
    'guestbook-note-blue'
  ];

  const setOpen = open => {
    section.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;

    if (toggleLabel) {
      toggleLabel.textContent = open ? 'Hide the guestbook' : 'Open the guestbook';
    }
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  closeButton?.addEventListener('click', () => {
    setOpen(false);
    toggle.focus();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && section.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });

  if (!form || !messageInput || !notesContainer) {
    setOpen(false);
    return;
  }

  const getStoredNotes = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const saveStoredNotes = notes => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(notes.slice(0, MAX_LOCAL_NOTES))
      );
    } catch {
      // Local storage is optional.
    }
  };

  const formatDate = timestamp => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const createNote = (note, index = 0) => {
    const article = document.createElement('article');
    article.className = `guestbook-note ${noteClasses[index % noteClasses.length]}`;

    const mark = document.createElement('span');
    mark.className = 'guestbook-note-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '“';

    const message = document.createElement('p');
    message.textContent = note.message;

    const meta = document.createElement('div');
    meta.className = 'guestbook-note-meta';

    const author = document.createElement('strong');
    author.textContent = note.name || 'Anonymous';

    const time = document.createElement('span');
    time.textContent = `${formatDate(note.createdAt)} · local preview`;

    meta.append(author, time);
    article.append(mark, message, meta);
    return article;
  };

  const refreshCount = () => {
    const count = notesContainer.querySelectorAll('.guestbook-note').length;
    if (noteCount) noteCount.textContent = String(count).padStart(2, '0');
  };

  const renderStoredNotes = () => {
    getStoredNotes().forEach((note, index) => {
      notesContainer.prepend(createNote(note, index));
    });
    refreshCount();
  };

  const updateCounter = () => {
    if (charCount) charCount.textContent = String(messageInput.value.length);
  };

  messageInput.addEventListener('input', updateCounter);

  form.addEventListener('submit', event => {
    event.preventDefault();

    const message = messageInput.value.trim();
    const name = nameInput?.value.trim() || '';

    if (!message) {
      status.textContent = 'Write a note first ✦';
      status.className = 'guestbook-status';
      messageInput.focus();
      return;
    }

    const note = {
      name,
      message,
      createdAt: Date.now()
    };

    const storedNotes = [note, ...getStoredNotes()].slice(0, MAX_LOCAL_NOTES);
    saveStoredNotes(storedNotes);

    notesContainer.prepend(createNote(note, 0));
    refreshCount();

    form.reset();
    updateCounter();

    status.textContent = 'Added to your local guestbook preview ✦';
    status.className = 'guestbook-status is-success';

    window.setTimeout(() => {
      if (status.textContent.includes('local guestbook preview')) {
        status.textContent = '';
        status.className = 'guestbook-status';
      }
    }, 3200);
  });

  setOpen(false);
  renderStoredNotes();
  updateCounter();
})();
