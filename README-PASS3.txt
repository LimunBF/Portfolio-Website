LIMUN PORTFOLIO — UI/UX PASS 3
SEO + SOCIAL PREVIEW + PERFORMANCE PRE-FLIGHT

CHANGED
- index.html
  - SEO title/description/author/robots
  - canonical production URL
  - Open Graph metadata
  - Twitter/X large-card metadata
  - Person JSON-LD structured data
  - social preview image reference
  - preconnect hints for icon/CDN origins
  - preload for the visible header logo
  - lazy/async loading for skill icons
  - tabindex target for Skip to content
  - rel=me on personal GitHub/LinkedIn profile links
  - no-JS fallback for AOS content

- css/style.css
  - optional reduced-data treatment for decorative effects

- css/contact.css
  - stronger keyboard focus outline for fields

- css/guestbook.css
  - stronger keyboard focus outline for fields

- js/main.js
  - aria-current uses "location" for same-page section navigation

- js/guestbook.js
  - aria-busy during note loading
  - small loading-error copy cleanup

NEW
- assets/img/og-cover.png (1200x630)
- 404.html (custom branded Vercel 404 page)
- robots.txt
- sitemap.xml

IMPORTANT
1. Keep your existing js/contact.js. It is intentionally NOT included because its working backend/contact logic was not part of this UI/SEO pass.
2. Keep the existing images/ and assets/ project screenshots already in your repository. This package only adds assets/img/og-cover.png.
3. The canonical/OG/sitemap URLs currently use:
   https://limun-portfolio-website.vercel.app/
   If you later use a custom domain, replace that URL in index.html, sitemap.xml, and robots.txt.
4. Social sites cache previews. After deployment, an old preview may remain cached for a while even though the new metadata is live.
5. No API, Firebase, admin auth, Vercel Functions, Firestore, or Turnstile secret logic was changed.

STATIC CHECKS COMPLETED
- main.js syntax: OK
- guestbook.js syntax: OK
- duplicate HTML IDs: none found
- img elements missing alt: none found
- JSON-LD parses correctly
- OG cover size: 1200x630
- old ux-enhancements.js reference: removed
- hardcoded sample guestbook notes: none

NOT A REAL LIGHTHOUSE SCORE
This pass performs code-level Lighthouse/performance preparation. A meaningful Lighthouse score should be run against the fully deployed site because this bundle intentionally does not duplicate your existing screenshots, icons, contact.js, API endpoints, or production network behavior.

NEXT / LAST SECURITY STEP
After this is deployed and checked visually, the remaining planned hardening is ADMIN_UIDS for the admin dashboard.
