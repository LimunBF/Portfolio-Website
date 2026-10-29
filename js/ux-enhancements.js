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

  const setMenuState = open => {
    if (!toggle || !nav) return;

    nav.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };

  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!toggle || !nav) return;
    setMenuState(false);
    if (restoreFocus) toggle.focus();
  };

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
      setMenuState(willOpen);
    });

    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => closeMenu());
    });

    document.addEventListener('pointerdown', event => {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) closeMenu();
    }, { passive: true });
  }

  // Active nav with IntersectionObserver instead of per-scroll layout work.
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const navSectionIds = new Set(
    navLinks
      .map(link => link.getAttribute('href'))
      .filter(href => href?.startsWith('#'))
      .map(href => href.slice(1))
  );
  const sections = [...document.querySelectorAll('main section[id]')]
    .filter(section => navSectionIds.has(section.id));

  const setActive = id => navLinks.forEach(link => {
    const active = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });

  if ('IntersectionObserver' in window && sections.length) {
    const visible = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target.id, entry.intersectionRatio));
      const current = [...visible.entries()].sort((a, b) => b[1] - a[1])[0];
      if (current && current[1] > 0) setActive(current[0]);
    }, { rootMargin: '-18% 0px -62% 0px', threshold: [0, .15, .35, .6] });

    sections.forEach(section => observer.observe(section));
  }

  const headerHeight = () => document.querySelector('.site-header')?.getBoundingClientRect().height || 76;

  const ensurePreviewVisible = preview => {
    const rect = preview.getBoundingClientRect();
    const safeTop = headerHeight() + 14;
    const safeBottom = window.innerHeight - 24;

    if (rect.top >= safeTop && rect.bottom <= safeBottom) return;

    // A tall gallery cannot fit in one viewport, so align its top edge instead of
    // trying to centre it, otherwise the first screenshot lands off-screen.
    const target = window.scrollY + rect.top - safeTop;
    window.scrollTo({
      top: Math.max(target, 0),
      behavior: reduceMotion.matches ? 'auto' : 'smooth'
    });
  };

  // Project screenshot accordion/pinning.
  const projectCards = [...document.querySelectorAll('.project-card')];

  const updatePreviewButton = card => {
    const button = card.querySelector('[data-preview-toggle]');
    const preview = card.querySelector('.project-preview');
    if (!button || !preview) return;

    const open = card.classList.contains('is-preview-open');
    const label = button.querySelector('span:last-child');
    const single = preview.dataset.count === '1';

    button.setAttribute('aria-expanded', String(open));

    if (label) {
      label.textContent = open
        ? (single ? 'Hide screenshot' : 'Hide screenshots')
        : (single ? 'View screenshot' : 'View screenshots');
    }
  };

  const setProjectPreview = (card, open) => {
    if (!card) return;
    card.classList.toggle('is-preview-open', open);
    updatePreviewButton(card);
    if (open) card.dataset.scrollPreview = 'true';
    else delete card.dataset.scrollPreview;
  };

  const closeProjectPreviews = () => {
    projectCards.forEach(card => setProjectPreview(card, false));
  };

  projectCards.forEach(card => {
    const button = card.querySelector('[data-preview-toggle]');
    const preview = card.querySelector('.project-preview');
    if (!button || !preview) return;

    updatePreviewButton(card);

    button.addEventListener('click', () => {
      const open = !card.classList.contains('is-preview-open');

      projectCards.forEach(other => {
        if (other !== card && other.classList.contains('is-preview-open')) {
          setProjectPreview(other, false);
        }
      });

      setProjectPreview(card, open);
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

      card.addEventListener('pointerleave', () => {
        followedThisHover = false;
      });
    }
  });

  // More projects disclosure + category filter (filter applies to the collapsed list only).
  const moreToggle = document.querySelector('.more-projects-toggle');
  const morePanel = document.getElementById('more-projects-panel');
  const moreGrid = document.getElementById('more-projects-grid');
  const filterStatus = document.getElementById('project-filter-status');
  const filterChips = [...document.querySelectorAll('#more-projects-panel .filter-chip')];
  const emptyState = document.querySelector('.project-empty');

  // Centre the final card of each grid when the visible count is odd, so the last
  // row is not left-aligned with an empty slot beside it. Must be recomputed after
  // filtering and after the more-projects panel opens or closes.
  const markLastVisibleCard = grid => {
    if (!grid) return;

    const cards = [...grid.querySelectorAll('.project-card')];
    cards.forEach(card => card.classList.remove('is-last-visible'));

    const visible = cards.filter(card => !card.hidden);
    if (visible.length % 2 === 1) visible[visible.length - 1].classList.add('is-last-visible');
  };

  const refreshGridAlignment = () => {
    markLastVisibleCard(document.getElementById('featured-projects-grid'));
    markLastVisibleCard(moreGrid);
  };

  const applyFilter = filter => {
    if (!moreGrid) return;

    let shown = 0;
    [...moreGrid.querySelectorAll('.project-card')].forEach(card => {
      const match = filter === 'all' || card.dataset.projectCategory === filter;
      card.hidden = !match;
      if (match) shown += 1;
    });

    if (emptyState) emptyState.hidden = shown !== 0;

    filterChips.forEach(chip => {
      const active = chip.dataset.filter === filter;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    if (filterStatus) {
      filterStatus.textContent = filter === 'all'
        ? `${shown} more projects`
        : `${shown} of 5 more projects`;
    }

    refreshGridAlignment();
  };

  const setMoreProjectsOpen = open => {
    if (!moreToggle || !morePanel) return;

    moreToggle.setAttribute('aria-expanded', String(open));
    moreToggle.textContent = open ? 'Hide extra projects' : 'Show more projects';
    morePanel.hidden = !open;
    if (!open) closeProjectPreviews();

    refreshGridAlignment();
  };

  moreToggle?.addEventListener('click', () => {
    setMoreProjectsOpen(moreToggle.getAttribute('aria-expanded') !== 'true');
  });

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => applyFilter(chip.dataset.filter || 'all'));
  });

  if (moreToggle && morePanel) setMoreProjectsOpen(false);

  // Lightbox
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImage = lightbox?.querySelector('.lightbox-image');
  const caption = lightbox?.querySelector('.lightbox-caption');
  const closeButton = lightbox?.querySelector('.lightbox-close');
  const prevButton = lightbox?.querySelector('.lightbox-prev');
  const nextButton = lightbox?.querySelector('.lightbox-next');
  const backgroundRegions = [
    document.querySelector('.site-header'),
    document.querySelector('main'),
    document.querySelector('.site-footer')
  ].filter(Boolean);

  let items = [];
  let currentIndex = 0;
  let returnFocus = null;

  const setBackgroundInert = inert => {
    backgroundRegions.forEach(region => {
      region.inert = inert;
    });
  };

  const getLightboxFocusable = () => {
    if (!lightbox) return [];

    return [...lightbox.querySelectorAll('button:not([hidden]):not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.offsetParent !== null);
  };

  const renderLightbox = () => {
    const item = items[currentIndex];
    if (!item || !lightboxImage) return;

    const img = item.querySelector('img');
    if (!img) return;

    const source = img.currentSrc || img.getAttribute('src') || img.src;
    const alt = img.alt || 'Preview image';
    const multiple = items.length > 1;

    lightboxImage.src = source;
    lightboxImage.alt = alt;

    if (caption) {
      caption.textContent = multiple
        ? `${alt} · ${currentIndex + 1} of ${items.length}`
        : alt;
    }

    if (prevButton) prevButton.hidden = !multiple;
    if (nextButton) nextButton.hidden = !multiple;

    lightbox?.setAttribute(
      'aria-label',
      multiple
        ? `Image preview ${currentIndex + 1} of ${items.length}: ${alt}`
        : `Image preview: ${alt}`
    );
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
    closeMenu();
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    setBackgroundInert(true);

    window.requestAnimationFrame(() => {
      closeButton?.focus();
    });
  };

  const closeLightbox = () => {
    if (!lightbox || lightbox.getAttribute('aria-hidden') !== 'false') return;

    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    setBackgroundInert(false);
    lightboxImage?.removeAttribute('src');

    const focusTarget = returnFocus;
    returnFocus = null;
    focusTarget?.focus();
  };

  const moveLightbox = step => {
    if (!items.length) return;
    currentIndex = (currentIndex + step + items.length) % items.length;
    renderLightbox();
  };

  document.querySelectorAll('.image-preview-button, [data-lightbox-open]').forEach(btn => {
    btn.addEventListener('click', () => openLightbox(btn));
  });

  closeButton?.addEventListener('click', closeLightbox);
  prevButton?.addEventListener('click', () => moveLightbox(-1));
  nextButton?.addEventListener('click', () => moveLightbox(1));

  lightbox?.addEventListener('click', event => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', event => {
    const lightboxOpen = lightbox?.getAttribute('aria-hidden') === 'false';

    if (lightboxOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveLightbox(-1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveLightbox(1);
        return;
      }

      if (event.key === 'Tab') {
        const focusable = getLightboxFocusable();
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      return;
    }

    if (event.key === 'Escape') {
      const menuOpen = toggle?.getAttribute('aria-expanded') === 'true';
      if (menuOpen) closeMenu({ restoreFocus: true });
      closeProjectPreviews();
    }
  });

  // Missing-image fallback: swap a broken <img> for a clean placeholder panel so the
  // page never shows a broken-image icon before the real screenshot is added.
  document.querySelectorAll('.preview-frame img, .certificate-slot img').forEach(img => {
    const frame = img.closest('.preview-frame, .certificate-slot');
    if (!frame) return;

    const markMissing = () => {
      frame.classList.add('is-missing');
      if (!frame.dataset.placeholder) {
        frame.dataset.placeholder = img.alt || 'Screenshot coming soon';
      }
      img.remove();
    };

    img.addEventListener('error', markMissing, { once: true });

    // Catch images that already failed before this script ran.
    if (img.complete && img.naturalWidth === 0) markMissing();
  });
})();
