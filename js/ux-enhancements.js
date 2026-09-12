(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  // AOS
  if (window.AOS) {
    AOS.init({
      once: true,
      offset: 60,
      duration: reduceMotion.matches ? 0 : 560,
      easing: 'ease-out-cubic',
      disable: reduceMotion.matches
    });
  }

  // Mobile navigation
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const closeMenu = () => {
    if (!toggle || !nav) return;
    nav.classList.remove('is-open');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(willOpen));
      nav.classList.toggle('is-open', willOpen);
      toggle.classList.toggle('is-open', willOpen);
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => { if (window.innerWidth > 980) closeMenu(); }, { passive: true });
  }

  // Active nav with IntersectionObserver instead of per-scroll layout work.
  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const setActive = id => navLinks.forEach(link => {
    const active = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  if ('IntersectionObserver' in window && sections.length) {
    const visible = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target.id, entry.intersectionRatio));
      const current = [...visible.entries()].sort((a,b) => b[1] - a[1])[0];
      if (current && current[1] > 0) setActive(current[0]);
    }, { rootMargin: '-18% 0px -62% 0px', threshold: [0, .15, .35, .6] });
    sections.forEach(section => observer.observe(section));
  }

  const headerHeight = () => document.querySelector('.site-header')?.getBoundingClientRect().height || 76;
  const ensurePreviewVisible = preview => {
    const rect = preview.getBoundingClientRect();
    const safeTop = headerHeight() + 14;
    const safeBottom = window.innerHeight - 24;
    if (rect.top < safeTop || rect.bottom > safeBottom) {
      preview.scrollIntoView({
        behavior: reduceMotion.matches ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  };

  // Project screenshot accordion/pinning.
  const projectCards = [...document.querySelectorAll('.project-card')];
  projectCards.forEach(card => {
    const button = card.querySelector('[data-preview-toggle]');
    const preview = card.querySelector('.project-preview');
    if (!button || !preview) return;

    const setOpen = open => {
      card.classList.toggle('is-preview-open', open);
      button.setAttribute('aria-expanded', String(open));
      const label = button.querySelector('span:last-child');
      if (label) {
        const single = preview.dataset.count === '1';
        label.textContent = open
          ? (single ? 'Hide screenshot' : 'Hide screenshots')
          : (single ? 'View screenshot' : 'View screenshots');
      }
      if (open) card.dataset.scrollPreview = 'true';
    };

    button.addEventListener('click', () => {
      const open = !card.classList.contains('is-preview-open');
      projectCards.forEach(other => {
        if (other !== card && other.classList.contains('is-preview-open')) {
          other.classList.remove('is-preview-open');
          const otherButton = other.querySelector('[data-preview-toggle]');
          const otherPreview = other.querySelector('.project-preview');
          if (otherButton) {
            otherButton.setAttribute('aria-expanded', 'false');
            const label = otherButton.querySelector('span:last-child');
            if (label) label.textContent = otherPreview?.dataset.count === '1' ? 'View screenshot' : 'View screenshots';
          }
        }
      });
      setOpen(open);
    });

    // Event-driven scrolling: no timers. Once the open transition ends, reveal the whole box if needed.
    preview.addEventListener('transitionend', event => {
      if (event.propertyName !== 'max-height') return;
      if (card.dataset.scrollPreview === 'true' && card.classList.contains('is-preview-open')) {
        delete card.dataset.scrollPreview;
        ensurePreviewVisible(preview);
      }
    });

    // On desktop hover, only follow after the user actually moves into the gallery.
    if (canHover.matches) {
      let followedThisHover = false;
      preview.addEventListener('pointerenter', () => {
        if (!followedThisHover) {
          followedThisHover = true;
          ensurePreviewVisible(preview);
        }
      });
      card.addEventListener('pointerleave', () => { followedThisHover = false; });
    }
  });

  // Certificate uses the shared lightbox directly; no hover/accordion state.

  // Lightbox
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImage = lightbox?.querySelector('.lightbox-image');
  const caption = lightbox?.querySelector('.lightbox-caption');
  const closeButton = lightbox?.querySelector('.lightbox-close');
  const prevButton = lightbox?.querySelector('.lightbox-prev');
  const nextButton = lightbox?.querySelector('.lightbox-next');
  let items = [];
  let currentIndex = 0;
  let returnFocus = null;

  const renderLightbox = () => {
    const item = items[currentIndex];
    if (!item || !lightboxImage) return;

    const img = item.querySelector('img');
    if (!img) return;

    const source = img.currentSrc || img.getAttribute('src') || img.src;
    lightboxImage.src = source;
    lightboxImage.alt = img.alt || 'Preview image';

    if (caption) caption.textContent = img.alt || '';

    const multiple = items.length > 1;
    if (prevButton) prevButton.hidden = !multiple;
    if (nextButton) nextButton.hidden = !multiple;
  };

  const openLightbox = trigger => {
    if (!lightbox) return;

    const group = trigger.dataset.lightboxGroup;
    if (!group) return;

    items = [...document.querySelectorAll(
      `.image-preview-button[data-lightbox-group="${CSS.escape(group)}"]`
    )];

    if (!items.length) return;

    const triggerIndex = items.indexOf(trigger);
    currentIndex = triggerIndex >= 0 ? triggerIndex : 0;
    returnFocus = trigger;

    renderLightbox();
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    closeButton?.focus();
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxImage?.removeAttribute('src');
    returnFocus?.focus();
  };

  const moveLightbox = step => {
    if (!items.length) return;
    currentIndex = (currentIndex + step + items.length) % items.length;
    renderLightbox();
  };

  document.querySelectorAll('.image-preview-button, [data-lightbox-open]').forEach(btn => btn.addEventListener('click', () => openLightbox(btn)));
  closeButton?.addEventListener('click', closeLightbox);
  prevButton?.addEventListener('click', () => moveLightbox(-1));
  nextButton?.addEventListener('click', () => moveLightbox(1));
  lightbox?.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (lightbox?.getAttribute('aria-hidden') === 'false') closeLightbox();
      else {
        closeMenu();
        projectCards.forEach(card => card.classList.remove('is-preview-open'));
        projectCards.forEach(card => card.querySelector('[data-preview-toggle]')?.setAttribute('aria-expanded', 'false'));
      }
    }
    if (lightbox?.getAttribute('aria-hidden') === 'false') {
      if (event.key === 'ArrowLeft') moveLightbox(-1);
      if (event.key === 'ArrowRight') moveLightbox(1);
    }
  });
})();
