const SCRIPT_NAME = 'LaCentraleEnhancer';
const LISTING_PATH = '/listing';
const PAGINATION_SELECTOR = '[aria-label="Pagination"][data-page-zone="pagination"]';
const RESULT_LIST_SELECTOR = '.resultList.resultList__withAd';
const LISTING_LINK_SELECTOR = 'a[href*="/auto-occasion-annonce-"]';
const CLONE_ATTRIBUTE = 'data-lacentrale-enhancer-pagination-clone';
const PREVIEW_BUTTON_ATTRIBUTE = 'data-lacentrale-enhancer-preview-button';
const CONTAINER_ID = 'lacentrale-enhancer-sticky-pagination';
const OVERLAY_ID = 'lacentrale-enhancer-preview-overlay';

let initialized = false;
let refreshScheduled = false;
let activePreviewToken = 0;
let pageScrollLockState = null;
const listingDetailsCache = new Map();

function log(message, ...details) {
  console.info(`[${SCRIPT_NAME}] ${message}`, ...details);
}

function onDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
    return;
  }

  callback();
}

function isListingPage() {
  return window.location.hostname === 'www.lacentrale.fr' && window.location.pathname === LISTING_PATH;
}

function findResultList() {
  return document.querySelector(RESULT_LIST_SELECTOR);
}

function getStickyTopOffset() {
  const viewportWidth = document.documentElement.clientWidth;

  return Array.from(document.body.children).reduce((offset, element) => {
    if (element.id === CONTAINER_ID) return offset;

    const styles = window.getComputedStyle(element);
    if (!['fixed', 'sticky'].includes(styles.position)) return offset;

    const rect = element.getBoundingClientRect();
    const isVisibleTopBar = rect.top <= 1 && rect.bottom > 0 && rect.width >= viewportWidth * 0.5;
    return isVisibleTopBar ? Math.max(offset, rect.bottom) : offset;
  }, 0);
}

function ensureStickyContainer(resultList) {
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) {
    if (existing.parentElement !== resultList) resultList.prepend(existing);
    return existing;
  }

  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.style.position = 'sticky';
  container.style.zIndex = '10';
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.padding = '8px 12px';
  container.style.background = 'rgba(255, 255, 255, 0.96)';
  container.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.12)';
  container.style.backdropFilter = 'blur(6px)';

  container.addEventListener('click', handleCloneClick);
  resultList.prepend(container);
  return container;
}

function handleCloneClick(event) {
  const link = event.target.closest?.('a[href]');
  if (!link || !event.currentTarget.contains(link)) return;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  window.location.assign(link.href);
}

function findSourcePagination() {
  return Array.from(document.querySelectorAll(PAGINATION_SELECTOR))
    .find((pagination) => !pagination.hasAttribute(CLONE_ATTRIBUTE));
}

function getAbsoluteUrl(href) {
  try {
    return new URL(href, window.location.origin).href;
  } catch {
    return null;
  }
}

function getListingUrl(link) {
  const url = getAbsoluteUrl(link.getAttribute('href'));
  if (!url) return null;

  const parsed = new URL(url);
  if (parsed.hostname !== window.location.hostname) return null;
  if (!parsed.pathname.includes('/auto-occasion-annonce-')) return null;
  return parsed.href;
}

function findListingCard(link) {
  const semanticCard = link.closest('article, li');
  if (semanticCard && !semanticCard.matches(RESULT_LIST_SELECTOR)) return semanticCard;

  let card = link;
  for (let depth = 0; depth < 5 && card.parentElement; depth += 1) {
    card = card.parentElement;
    if (card.matches(RESULT_LIST_SELECTOR)) break;
  }

  return card.matches(RESULT_LIST_SELECTOR) ? link.parentElement : card;
}

function findFavoriteButton(card) {
  return card.querySelector([
    'button[data-testid="favorite"]',
    '[data-testid="favorite"] button',
    'button[class*="Favorite" i]',
    'button[aria-label*="favori" i]',
    'button[aria-label*="favorite" i]',
  ].join(','));
}

function isFavoriteActive(button) {
  if (!button) return false;
  return button.getAttribute('data-active') === 'true'
    || button.getAttribute('aria-pressed') === 'true'
    || button.className?.toString().toLowerCase().includes('active');
}

function lockPageScroll() {
  if (pageScrollLockState) return;

  const scrollY = window.scrollY;
  pageScrollLockState = {
    scrollY,
    bodyOverflow: document.body.style.overflow,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyWidth: document.body.style.width,
    documentOverflow: document.documentElement.style.overflow,
  };

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
}

function unlockPageScroll() {
  if (!pageScrollLockState) return;

  const { scrollY, bodyOverflow, bodyPosition, bodyTop, bodyWidth, documentOverflow } = pageScrollLockState;
  pageScrollLockState = null;

  document.documentElement.style.overflow = documentOverflow;
  document.body.style.overflow = bodyOverflow;
  document.body.style.position = bodyPosition;
  document.body.style.top = bodyTop;
  document.body.style.width = bodyWidth;
  window.scrollTo(0, scrollY);
}

function createPreviewButton(card, url) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Aperçu';
  button.setAttribute(PREVIEW_BUTTON_ATTRIBUTE, 'true');
  button.style.position = 'absolute';
  button.style.top = '10px';
  button.style.right = '10px';
  button.style.zIndex = '20';
  button.style.padding = '7px 12px';
  button.style.border = '1px solid #1f2937';
  button.style.borderRadius = '999px';
  button.style.background = 'rgba(255, 255, 255, 0.94)';
  button.style.color = '#111827';
  button.style.font = '600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  button.style.cursor = 'pointer';
  button.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.18)';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPreview(card, url);
  });
  return button;
}

function decorateListingCards() {
  if (!isListingPage()) return;

  const seenCards = new Set();
  Array.from(document.querySelectorAll(LISTING_LINK_SELECTOR)).forEach((link) => {
    if (link.closest(`#${OVERLAY_ID}`)) return;

    const url = getListingUrl(link);
    if (!url) return;

    const card = findListingCard(link);
    if (!card || seenCards.has(card) || card.querySelector(`[${PREVIEW_BUTTON_ATTRIBUTE}]`)) return;

    seenCards.add(card);
    if (window.getComputedStyle(card).position === 'static') {
      card.style.position = 'relative';
    }
    card.appendChild(createPreviewButton(card, url));
  });
}

function getFirstText(element, selectors) {
  for (const selector of selectors) {
    const match = element.querySelector(selector);
    const text = match?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

function compactText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function getImageUrl(image) {
  const source = image.currentSrc || image.src || image.getAttribute('data-src') || image.getAttribute('data-lazy-src');
  if (source) return getAbsoluteUrl(source);

  const srcset = image.getAttribute('srcset') || image.getAttribute('data-srcset');
  if (!srcset) return null;

  const firstCandidate = srcset.split(',')[0]?.trim()?.split(/\s+/)[0];
  return firstCandidate ? getAbsoluteUrl(firstCandidate) : null;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getImageIdentity(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^(?:\/classifieds)?\//, '').replace(/^(?:\d+x\d+|[^/]+)\//, '');
  } catch {
    return url;
  }
}

function uniqueImages(urls) {
  const seen = new Set();
  return urls.filter((url) => {
    if (!url || url.startsWith('data:')) return false;
    const identity = getImageIdentity(url);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function extractImages(root) {
  return uniqueImages(Array.from(root.querySelectorAll('img')).map(getImageUrl));
}

function extractCardSummary(card, url) {
  const title = getFirstText(card, ['h1', 'h2', 'h3', '[class*="title" i]', '[aria-label]']) || 'Annonce LaCentrale';
  const text = compactText(card.textContent || '');
  const price = text.match(/\d[\d\s]*(?:€|EUR)/i)?.[0]?.trim() || '';
  const details = unique(text.split(/(?=\d[\d\s]*(?:km|KM|ch|CV|€|EUR)|Essence|Diesel|Hybride|Electrique|Électrique|Automatique|Manuelle)/)
    .map(compactText)
    .filter((part) => part && part.length <= 80))
    .slice(0, 8);

  return {
    url,
    title: compactText(title),
    price,
    details,
    images: extractImages(card),
    favoriteButton: findFavoriteButton(card),
  };
}

function extractJsonLdDetails(documentNode) {
  const details = { description: '', images: [], specs: [] };

  Array.from(documentNode.querySelectorAll('script[type="application/ld+json"]')).some((script) => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      const entries = Array.isArray(data) ? data : [data];
      const vehicle = entries.find((entry) => entry && typeof entry === 'object' && (entry.description || entry.image));
      if (!vehicle) return false;

      details.description = compactText(String(vehicle.description || ''));
      details.images = unique((Array.isArray(vehicle.image) ? vehicle.image : [vehicle.image]).map((image) => getAbsoluteUrl(String(image || ''))));
      details.specs = [
        ['Année', vehicle.dateVehicleFirstRegistered],
        ['Kilométrage', formatWithUnit(vehicle.mileageFromOdometer?.value, vehicle.mileageFromOdometer?.unitText)],
        ['Motorisation', vehicle.fuelType],
        ['Boîte', vehicle.vehicleTransmission],
        ['Localisation', vehicle.offers?.seller?.address?.postalCode],
      ];
      return Boolean(details.description || details.images.length);
    } catch {
      return false;
    }
  });

  return details;
}

function extractAssignedJson(documentNode, variableName) {
  const pattern = new RegExp(`(?:var|window\\.)\\s*${variableName}\\s*=\\s*({[\\s\\S]*?})(?:;|$)`);

  for (const script of Array.from(documentNode.querySelectorAll('script'))) {
    const match = script.textContent?.match(pattern);
    if (!match) continue;

    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  return null;
}

function formatPrice(value) {
  if (!Number.isFinite(Number(value))) return value || '';
  return `${Number(value).toLocaleString('fr-FR')} €`;
}

function formatMileage(value) {
  if (!Number.isFinite(Number(value))) return value || '';
  return `${Number(value).toLocaleString('fr-FR')} km`;
}

function formatWithUnit(value, unit) {
  if (!value) return '';
  if (!Number.isFinite(Number(value))) return `${value}${unit ? ` ${unit}` : ''}`;
  return `${Number(value).toLocaleString('fr-FR')}${unit ? ` ${unit}` : ''}`;
}

function formatGearbox(value) {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'MECANIQUE') return 'Manuelle';
  if (normalized === 'AUTOMATIQUE') return 'Automatique';
  return value || '';
}

function formatLocation(value, zipCode) {
  return [value, zipCode].filter(Boolean).join(' · ');
}

function extractLaCentraleData(documentNode) {
  const gallery = extractAssignedJson(documentNode, 'CLASSIFIED_GALLERY');
  const mainInfos = extractAssignedJson(documentNode, 'CLASSIFIED_MAIN_INFOS');
  const summary = extractAssignedJson(documentNode, 'SummaryInformationData');
  const seller = extractAssignedJson(documentNode, 'SellerInformationData');
  const data = gallery?.data || mainInfos?.data || {};
  const classified = data.classified || summary?.classified?.classified || {};
  const vehicle = data.vehicle || {};
  const combinedVehicle = summary?.classified?.vehicle?.combined || {};
  const version = combinedVehicle.version || {};
  const specs = combinedVehicle.specs || {};
  const pictures = gallery?.data?.images?.v1?.pictures || [];
  const images = uniqueImages(pictures.map((picture) => getAbsoluteUrl(picture.src1_5x || picture.srcMobile2x)));
  const titleParts = unique([
    classified.title,
    version.label,
  ].map(compactText));

  return {
    title: titleParts.join(' ') || version.detailedModel || '',
    price: formatPrice(classified.price || summary?.classified?.classified?.price),
    description: classified.description?.content || '',
    images,
    specs: [
      ['Année', classified.year || summary?.classified?.classified?.year],
      ['Kilométrage', formatMileage(classified.mileage || summary?.classified?.classified?.mileage)],
      ['Motorisation', version.motorization || specs.energy || vehicle.commercialModel],
      ['Boîte', formatGearbox(specs.gearbox)],
      ['Localisation', formatLocation(classified.visitPlace || seller?.classified?.classified?.visitPlace, seller?.classified?.classified?.zipCode || summary?.classified?.classified?.zipCode)],
    ],
  };
}

function extractDetailsFromDocument(documentNode) {
  const lacentraleDetails = extractLaCentraleData(documentNode);
  const jsonLdDetails = extractJsonLdDetails(documentNode);
  const description = lacentraleDetails.description || jsonLdDetails.description || getFirstText(documentNode, [
    '[data-testid*="description" i]',
    '[class*="description" i]',
    'section[aria-label*="description" i]',
  ]);

  const metaImage = documentNode.querySelector('meta[property="og:image"]')?.content;
  const fallbackImages = [
    ...jsonLdDetails.images,
    getAbsoluteUrl(metaImage || ''),
  ];
  const images = uniqueImages(lacentraleDetails.images.length
    ? lacentraleDetails.images
    : [...fallbackImages, ...extractImages(documentNode)]).slice(0, 24);

  return {
    title: lacentraleDetails.title,
    price: lacentraleDetails.price,
    description: compactText(description || ''),
    images,
    specs: uniqueSpecs([...lacentraleDetails.specs, ...jsonLdDetails.specs]),
  };
}

function uniqueSpecs(specs) {
  const seen = new Set();
  return specs
    .map(([label, value]) => [label, compactText(String(value || ''))])
    .filter(([label, value]) => {
      if (!value || seen.has(label)) return false;
      seen.add(label);
      return true;
    });
}

async function loadListingDetails(url) {
  if (listingDetailsCache.has(url)) return listingDetailsCache.get(url);

  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  const details = extractDetailsFromDocument(documentNode);
  listingDetailsCache.set(url, details);
  return details;
}

function ensurePreviewOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    lockPageScroll();
    return existing;
  }

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.tabIndex = -1;
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '2147483646';
  overlay.style.overflow = 'auto';
  overlay.style.background = 'rgba(17, 24, 39, 0.64)';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closePreview();
  });

  document.body.appendChild(overlay);
  lockPageScroll();
  return overlay;
}

function renderPreviewContent(summary, details = {}, state = 'loading') {
  const overlay = ensurePreviewOverlay();
  const images = unique([...(details.images || []), ...summary.images]);
  const title = details.title || summary.title;
  const price = details.price || summary.price;
  const description = details.description || '';
  const specs = details.specs?.length ? details.specs : summary.details.map((detail) => detail.split(':')).filter((parts) => parts.length === 2);
  const statusMessage = state === 'loading'
    ? 'Chargement de la description…'
    : 'Description non disponible pour cette annonce.';

  overlay.innerHTML = `
    <div style="box-sizing:border-box;min-height:100%;padding:28px 18px;">
      <section role="dialog" aria-modal="true" aria-label="Aperçu annonce" style="box-sizing:border-box;max-width:1180px;max-height:calc(100vh - 56px);margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.28);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;display:flex;flex-direction:column;">
        <header style="position:sticky;top:0;z-index:1;display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #e5e7eb;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);">
          <div>
            <h2 style="margin:0 0 6px;font-size:22px;line-height:1.25;">${escapeHtml(title)}</h2>
            ${price ? `<strong style="font-size:20px;">${escapeHtml(price)}</strong>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex:0 0 auto;">
            ${renderFavoriteButton(summary.favoriteButton)}
            <button type="button" data-preview-close style="border:1px solid #d1d5db;border-radius:999px;background:#fff;padding:9px 14px;cursor:pointer;font-weight:700;">Fermer</button>
          </div>
        </header>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;padding:22px;overflow:hidden;min-height:0;">
          <div style="overflow:auto;min-height:0;">
            ${renderImageGallery(images)}
          </div>
          <div style="overflow:auto;min-height:0;padding-right:4px;">
            ${renderSpecs(specs)}
            <h3 style="margin:22px 0 10px;font-size:17px;">Description</h3>
            <p style="white-space:pre-wrap;margin:0;color:#374151;line-height:1.55;">${escapeHtml(description || statusMessage)}</p>
            <a href="${escapeAttribute(summary.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:20px;color:#0f766e;font-weight:700;">Ouvrir l’annonce complète</a>
          </div>
        </div>
      </section>
    </div>
  `;

  overlay.querySelector('[data-preview-close]')?.addEventListener('click', closePreview);
  setupPreviewFavorite(overlay, summary.favoriteButton);
  setupPreviewCarousel(overlay);
  setupPreviewFocusTrap(overlay);
  overlay.focus({ preventScroll: true });
}

function setupPreviewFocusTrap(overlay) {
  if (overlay.dataset.focusTrapReady === 'true') return;
  overlay.dataset.focusTrapReady = 'true';

  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusableElements.length) {
      event.preventDefault();
      overlay.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  });
}

function renderFavoriteButton(sourceButton) {
  if (!sourceButton) return '';

  const active = isFavoriteActive(sourceButton);
  return `
    <button type="button" data-preview-favorite style="border:1px solid ${active ? '#ff004f' : '#d1d5db'};border-radius:999px;background:${active ? '#fff0f5' : '#fff'};color:#111827;padding:9px 14px;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
      <span aria-hidden="true" style="color:#ff004f;font-size:16px;line-height:1;">${active ? '♥' : '♡'}</span>
      <span>Favori</span>
    </button>
  `;
}

function setupPreviewFavorite(overlay, sourceButton) {
  const favoriteButton = overlay.querySelector('[data-preview-favorite]');
  if (!favoriteButton || !sourceButton) return;

  favoriteButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    sourceButton.click();

    window.setTimeout(() => {
      const active = isFavoriteActive(sourceButton);
      favoriteButton.style.borderColor = active ? '#ff004f' : '#d1d5db';
      favoriteButton.style.background = active ? '#fff0f5' : '#fff';
      const icon = favoriteButton.querySelector('span[aria-hidden="true"]');
      if (icon) icon.textContent = active ? '♥' : '♡';
    }, 100);
  });
}

function renderImageGallery(images) {
  if (!images.length) return '<div style="display:grid;place-items:center;min-height:260px;border:1px dashed #d1d5db;border-radius:14px;color:#6b7280;">Aucune photo récupérée</div>';

  const [mainImage, ...otherImages] = images;
  return `
    <div data-preview-carousel style="position:relative;">
      <img data-preview-main-image src="${escapeAttribute(mainImage)}" alt="Photo principale" style="display:block;width:100%;max-height:520px;object-fit:contain;background:#f3f4f6;border-radius:14px;">
      ${images.length > 1 ? `
        <button type="button" data-preview-carousel-previous aria-label="Photo précédente" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:38px;height:38px;border:0;border-radius:999px;background:rgba(17,24,39,.78);color:#fff;cursor:pointer;font-size:24px;line-height:1;">‹</button>
        <button type="button" data-preview-carousel-next aria-label="Photo suivante" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:38px;height:38px;border:0;border-radius:999px;background:rgba(17,24,39,.78);color:#fff;cursor:pointer;font-size:24px;line-height:1;">›</button>
        <div data-preview-carousel-count style="position:absolute;right:12px;bottom:12px;border-radius:999px;background:rgba(17,24,39,.78);color:#fff;padding:5px 9px;font-size:12px;font-weight:700;">1 / ${images.length}</div>
      ` : ''}
      <div data-preview-carousel-images hidden>${images.map((image) => `<span data-src="${escapeAttribute(image)}"></span>`).join('')}</div>
    </div>
    ${otherImages.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin-top:10px;">${images.map((image, index) => `<button type="button" data-preview-thumbnail="${index}" style="padding:0;border:${index === 0 ? '2px solid #0f766e' : '1px solid #e5e7eb'};border-radius:8px;background:#fff;cursor:pointer;overflow:hidden;"><img src="${escapeAttribute(image)}" alt="Photo annonce ${index + 1}" style="display:block;width:100%;height:74px;object-fit:cover;background:#f3f4f6;"></button>`).join('')}</div>` : ''}
  `;
}

function setupPreviewCarousel(overlay) {
  const carousel = overlay.querySelector('[data-preview-carousel]');
  if (!carousel) return;

  const images = Array.from(carousel.querySelectorAll('[data-preview-carousel-images] [data-src]'))
    .map((element) => element.getAttribute('data-src'));
  if (images.length <= 1) return;

  const mainImage = carousel.querySelector('[data-preview-main-image]');
  const counter = carousel.querySelector('[data-preview-carousel-count]');
  const thumbnails = Array.from(overlay.querySelectorAll('[data-preview-thumbnail]'));
  let currentIndex = 0;

  const showImage = (nextIndex) => {
    currentIndex = (nextIndex + images.length) % images.length;
    mainImage.src = images[currentIndex];
    if (counter) counter.textContent = `${currentIndex + 1} / ${images.length}`;
    thumbnails.forEach((thumbnail, index) => {
      thumbnail.style.border = index === currentIndex ? '2px solid #0f766e' : '1px solid #e5e7eb';
    });
  };

  carousel.querySelector('[data-preview-carousel-previous]')?.addEventListener('click', () => showImage(currentIndex - 1));
  carousel.querySelector('[data-preview-carousel-next]')?.addEventListener('click', () => showImage(currentIndex + 1));
  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener('click', () => showImage(Number(thumbnail.getAttribute('data-preview-thumbnail'))));
  });
}

function renderDetails(details) {
  if (!details.length) return '';

  return `<div style="display:flex;flex-wrap:wrap;gap:8px;">${details.map((detail) => `<span style="border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px;background:#f9fafb;font-size:13px;">${escapeHtml(detail)}</span>`).join('')}</div>`;
}

function renderSpecs(specs) {
  if (!specs.length) return '';

  return `
    <dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin:0;">
      ${specs.map(([label, value]) => `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#f9fafb;">
          <dt style="margin:0 0 3px;color:#6b7280;font-size:12px;">${escapeHtml(label)}</dt>
          <dd style="margin:0;font-weight:700;color:#111827;">${escapeHtml(value)}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

async function openPreview(card, url) {
  const token = activePreviewToken + 1;
  activePreviewToken = token;

  const summary = extractCardSummary(card, url);
  renderPreviewContent(summary, {}, 'loading');

  try {
    const details = await loadListingDetails(url);
    if (activePreviewToken !== token) return;
    renderPreviewContent(summary, details, 'loaded');
  } catch (error) {
    log('preview details unavailable', { url, error });
    if (activePreviewToken !== token) return;
    renderPreviewContent(summary, {}, 'error');
  }
}

function closePreview() {
  activePreviewToken += 1;
  document.getElementById(OVERLAY_ID)?.remove();
  unlockPageScroll();
}

function handlePreviewKeyboard(event) {
  if (event.key === 'Escape') closePreview();
}

function clonePagination(source) {
  const clone = source.cloneNode(true);
  clone.setAttribute(CLONE_ATTRIBUTE, 'true');
  clone.style.margin = '0';
  clone.style.maxWidth = '100%';
  clone.style.pointerEvents = 'auto';
  return clone;
}

function refreshStickyPagination() {
  if (!isListingPage()) return;

  const source = findSourcePagination();
  if (!source) return;

  const resultList = findResultList();
  if (!resultList) return;

  const container = ensureStickyContainer(resultList);
  container.style.top = `${getStickyTopOffset()}px`;
  container.replaceChildren(clonePagination(source));
}

function scheduleRefresh() {
  if (refreshScheduled) return;
  refreshScheduled = true;

  window.setTimeout(() => {
    refreshScheduled = false;
    refreshStickyPagination();
    decorateListingCards();
  }, 100);
}

function observePaginationChanges() {
  const observer = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => mutation.target.closest?.(`#${CONTAINER_ID}`))) return;
    scheduleRefresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
  if (initialized) return;
  initialized = true;

  log('initialized', { version: __VERSION__ });

  if (!isListingPage()) return;

  refreshStickyPagination();
  decorateListingCards();
  observePaginationChanges();
  document.addEventListener('keydown', handlePreviewKeyboard);
}

onDomReady(init);
