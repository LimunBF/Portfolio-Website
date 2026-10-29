import * as pdfjsLib from '../assets/vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../assets/vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const viewer = document.getElementById('pdf-viewer');
const title = document.getElementById('pdf-viewer-title');
const pages = viewer?.querySelector('[data-pdf-pages]');
const status = viewer?.querySelector('[data-pdf-status]');
const closeButton = viewer?.querySelector('.pdf-viewer-close');
const tabLink = viewer?.querySelector('[data-pdf-tab]');
const downloadLink = viewer?.querySelector('[data-pdf-download]');
const backgroundRegions = [
  document.querySelector('.site-header'),
  document.querySelector('main'),
  document.querySelector('.site-footer'),
  document.getElementById('image-lightbox')
].filter(Boolean);

let returnFocus = null;
let loadingTask = null;
let documentUrl = null;
let renderRun = 0;

const setBackgroundInert = inert => {
  backgroundRegions.forEach(region => {
    region.inert = inert;
  });
};

const setStatus = (message, isError = false) => {
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-error', isError);
};

/*
  Source documents live as base64 text modules under assets/viewer/*.mjs.
  Some hosts and client-side scanners answer binary document requests with an
  empty 204, which leaves PDF.js nothing to parse, so the bytes travel as text
  and are decoded here. ponytail: base64 adds ~33% size; switch back to plain
  .pdf URLs once every target host serves them reliably.
*/
const loadDocumentBytes = async source => {
  const { default: encoded } = await import(/* @vite-ignore */ new URL(source, document.baseURI).href);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const releaseDocumentUrl = () => {
  if (!documentUrl) return;
  URL.revokeObjectURL(documentUrl);
  documentUrl = null;
};

const closeViewer = () => {
  if (!viewer || viewer.getAttribute('aria-hidden') !== 'false') return;

  renderRun += 1;
  loadingTask?.destroy();
  loadingTask = null;
  pages?.replaceChildren();
  releaseDocumentUrl();
  setStatus('');
  viewer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('pdf-viewer-open');
  setBackgroundInert(false);

  const focusTarget = returnFocus;
  returnFocus = null;
  focusTarget?.focus();
};

const renderDocument = async source => {
  if (!pages) return;

  const run = ++renderRun;
  pages.replaceChildren();
  releaseDocumentUrl();
  setStatus('Loading document...');

  try {
    const data = await loadDocumentBytes(source);
    if (run !== renderRun) return;

    documentUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    if (tabLink) tabLink.href = documentUrl;
    if (downloadLink) downloadLink.href = documentUrl;

    setStatus('Rendering document...');
    loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    if (run !== renderRun) return;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      if (run !== renderRun) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.min(pages.clientWidth || 980, 980);
      const cssScale = Math.min(availableWidth / baseViewport.width, 1.6);
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: cssScale * outputScale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });

      canvas.className = 'pdf-viewer-page';
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.ceil(viewport.width / outputScale)}px`;
      canvas.style.height = `${Math.ceil(viewport.height / outputScale)}px`;
      canvas.setAttribute('aria-label', `Page ${pageNumber} of ${pdf.numPages}`);
      pages.append(canvas);

      await page.render({ canvasContext: context, viewport }).promise;
    }

    if (run === renderRun) setStatus(`${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}`);
  } catch (error) {
    if (run !== renderRun) return;
    console.error('PDF viewer failed:', error);
    setStatus('Document could not be rendered. Use Open in new tab or Download.', true);
  }
};

const openViewer = trigger => {
  if (!viewer) return;

  const source = trigger.dataset.pdfSrc;
  if (!source) return;

  returnFocus = trigger;
  if (title) title.textContent = trigger.dataset.pdfTitle || 'Document viewer';
  if (tabLink) tabLink.href = trigger.dataset.pdfDownloadSrc || source;
  if (downloadLink) downloadLink.href = trigger.dataset.pdfDownloadSrc || source;

  viewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('pdf-viewer-open');
  setBackgroundInert(true);
  closeButton?.focus();
  renderDocument(source);
};

document.querySelectorAll('[data-pdf-open]').forEach(button => {
  button.addEventListener('click', () => openViewer(button));
});

closeButton?.addEventListener('click', closeViewer);

document.addEventListener('keydown', event => {
  if (viewer?.getAttribute('aria-hidden') !== 'false') return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeViewer();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusable = [...viewer.querySelectorAll('button:not(:disabled), a[href]')]
    .filter(element => element.offsetParent !== null);
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
});
