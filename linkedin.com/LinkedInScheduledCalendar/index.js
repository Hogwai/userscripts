const SCRIPT_NAME = 'LinkedInScheduledCalendar';
const INTEROP_OUTLET_SELECTOR = '#interop-outlet';

let calendarButton = null;
let calendarView = null;

function getModalRoot() {
  const outlet = document.querySelector(INTEROP_OUTLET_SELECTOR);
  return outlet ? outlet.shadowRoot : null;
}

function log(...args) {
  console.info(`[${SCRIPT_NAME}]`, ...args);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function buildMonthMap() {
  // Detect locale from LinkedIn's <html lang="..."> attribute
  const locale = (document.documentElement.lang || navigator.language || 'en')
    .replace(/[-_].*$/, '');

  const map = new Map();

  // Build month names dynamically via Intl — works for ANY language LinkedIn uses
  try {
    for (const fmtType of ['short', 'long']) {
      const fmt = new Intl.DateTimeFormat(locale, { month: fmtType });
      for (let m = 0; m < 12; m++) {
        // Normalize: NFD decomposes accents (é→e+´), then strip non-alpha, lowercase
        const name = fmt.format(new Date(2024, m, 15))
          .normalize('NFD')
          .replace(/[^a-zA-Z]/g, '')
          .toLowerCase();
        if (name && !map.has(name)) {
          map.set(name, m);
        }
      }
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] Intl failed for locale "${locale}":`, e);
  }

  // Emergency fallback (English) if Intl returned nothing
  if (map.size === 0) {
    [
      ['jan', 0], ['january', 0], ['feb', 1], ['february', 1],
      ['mar', 2], ['march', 2], ['apr', 3], ['april', 3],
      ['may', 4], ['jun', 5], ['june', 5],
      ['jul', 6], ['july', 6], ['aug', 7], ['august', 7],
      ['sep', 8], ['september', 8], ['oct', 9], ['october', 9],
      ['nov', 10], ['november', 10], ['dec', 11], ['december', 11],
    ].forEach(([k, v]) => map.set(k, v));
  }

  return map;
}

let _cachedMonthMap = null;

function parseDateFromLabel(label) {
  if (!_cachedMonthMap) _cachedMonthMap = buildMonthMap();
  const monthMap = _cachedMonthMap;

  // Build alternation from map keys, longest first
  const monthKeys = [...monthMap.keys()].sort((a, b) => b.length - a.length);
  const monthPattern = monthKeys.join('|');

  // Locate the month name in the label (needed for both patterns)
  const monthRe = new RegExp(`(${monthPattern})`, 'i');
  const monthMatch = label.match(monthRe);
  if (!monthMatch) return null;

  const matchedMonth = monthMatch[1].toLowerCase().replace(/[^a-z]/g, '');
  const monthIndex = monthMap.get(matchedMonth);
  if (monthIndex === undefined) return null;

  // Pattern 1: day-month-year
  // "19 Jun 2026 at 18:15", "19 juin 2026 à 18:15", "19 de junio de 2026 a las 18:15", "19. Juni 2026 um 18:15"
  const re1 = new RegExp(
    `(\\d{1,2})\\.?\\s*(?:de\\s+)?(?:${monthPattern})\\S*\\s*(?:de\\s+)?(\\d{4})?\\s*.*?(\\d{1,2}):(\\d{2})`,
    'i'
  );
  let match = label.match(re1);
  if (match) {
    const day = parseInt(match[1], 10);
    const year = match[2] ? parseInt(match[2], 10) : new Date().getFullYear();
    const hour = parseInt(match[3], 10);
    const minute = parseInt(match[4], 10);
    if (isValidDate(day, monthIndex, year, hour, minute)) {
      return { year, month: monthIndex, day, hour, minute, date: new Date(year, monthIndex, day, hour, minute) };
    }
  }

  // Pattern 2: month-day-year (US style)
  // "Jun 19, 2026 at 6:15 PM"
  const re2 = new RegExp(
    `(?:${monthPattern})\\S*\\s+(\\d{1,2}),?\\s*(?:\\S+\\s+)?(\\d{4})?\\s*.*?(\\d{1,2}):(\\d{2})(?:\\s*(AM|PM))?`,
    'i'
  );
  match = label.match(re2);
  if (match) {
    const day = parseInt(match[1], 10);
    const year = match[2] ? parseInt(match[2], 10) : new Date().getFullYear();
    let hour = parseInt(match[3], 10);
    const minute = parseInt(match[4], 10);
    const ampm = match[5] ? match[5].toUpperCase() : null;
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    if (isValidDate(day, monthIndex, year, hour, minute)) {
      return { year, month: monthIndex, day, hour, minute, date: new Date(year, monthIndex, day, hour, minute) };
    }
  }

  return null;
}

function isValidDate(day, month, year, hour, minute) {
  return (
    Number.isInteger(day) && day >= 1 && day <= 31 &&
    Number.isInteger(month) && month >= 0 && month <= 11 &&
    Number.isInteger(year) && year >= 2020 && year <= 2100 &&
    Number.isInteger(hour) && hour >= 0 && hour <= 23 &&
    Number.isInteger(minute) && minute >= 0 && minute <= 59
  );
}

function getCalendarHeader(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `
    <div style="padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <button type="button" data-calendar-prev title="Previous month" style="background:none;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:18px;font-weight:700;line-height:1;color:#374151;">◀</button>
        <h3 style="margin:0;font-size:18px;font-weight:600;color:#111827;">${months[month]} ${year}</h3>
        <button type="button" data-calendar-next title="Next month" style="background:none;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:18px;font-weight:700;line-height:1;color:#374151;">▶</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">
        ${days.map((d) => `<div style="font-size:12px;font-weight:600;color:#6b7280;padding:4px 0;">${d}</div>`).join('')}
        ${Array.from({ length: offset }, () => '<div></div>').join('')}
        ${Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const key = `${year}-${month}-${dayNum}`;
          const hasPost = scheduledPostsByDate.has(key);
          const posts = hasPost ? scheduledPostsByDate.get(key) : [];
          const isToday = dayNum === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
          return `
            <div data-calendar-day="${key}" style="position:relative;min-height:60px;padding:4px;border-radius:8px;background:${hasPost ? '#f0fdf4' : isToday ? '#f0f7ff' : '#fff'};border:1px solid ${hasPost ? '#86efac' : isToday ? '#93c5fd' : '#f3f4f6'};cursor:${hasPost ? 'pointer' : 'default'};transition:box-shadow 0.15s;">
              <div style="font-size:13px;font-weight:${isToday ? '700' : '500'};color:${hasPost ? '#166534' : isToday ? '#1e40af' : '#374151'};margin-bottom:2px;">${dayNum}</div>
              ${hasPost ? `<div style="font-size:10px;color:#166534;line-height:1.3;">${posts.length} post${posts.length > 1 ? 's' : ''}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  return html;
}

function getCalendarDetailView(posts) {
  if (!posts || posts.length === 0) {
    return `
      <div style="padding:16px;">
        <button type="button" data-calendar-back-to-grid style="background:none;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:12px;color:#374151;">◀ Back to calendar</button>
        <div style="padding:20px;text-align:center;color:#6b7280;">No scheduled posts on this day.</div>
      </div>`;
  }

  return `
    <div style="padding:16px;">
      <button type="button" data-calendar-back-to-grid style="background:none;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:12px;color:#374151;">◀ Back to calendar</button>
      <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">Scheduled posts — ${posts[0].labelDate}</h3>
      <div style="overflow-y:auto;">
      ${posts.map((post) => `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:8px;background:#fff;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${post.labelTime}</div>
          <div style="font-size:14px;color:#111827;line-height:1.4;word-break:break-word;">${escapeHtml(post.text || '(no text)')}</div>
        </div>
      `).join('')}
      </div>
    </div>
  `;
}

let scheduledPostsByDate = new Map();
let rawPosts = [];
let currentDate = new Date();
let originalScaffold = null;

function toggleCalendarView() {
  const root = getModalRoot();
  if (!root) return;

  // If calendar is already showing, close it back to list
  if (calendarView && calendarView.parentElement) {
    restoreListView();
    return;
  }

  // Show calendar from current posts list
  const listContainer = root.querySelector('.share-post-list-view__container--dropdown-menu');
  if (!listContainer) return;

  doShowCalendar(root, listContainer);
}

function doShowCalendar(root, listContainer) {
  originalScaffold = listContainer.querySelector('.scaffold-finite-scroll');
  if (!originalScaffold) {
    log('scaffold-finite-scroll not found inside list container');
    return;
  }

  parseScheduledPosts();

  calendarView = document.createElement('div');
  calendarView.style.borderTop = '1px solid #e5e7eb';
  calendarView.style.background = '#fff';
  calendarView.style.color = '#111827';
  calendarView.style.maxHeight = '60vh';
  calendarView.style.minHeight = '400px';
  calendarView.style.overflow = 'auto';
  calendarView.style.boxSizing = 'border-box';

  renderCalendarGrid();

  originalScaffold.replaceWith(calendarView);
  if (calendarButton) calendarButton.innerHTML = '📋';
  log('calendar view inserted');
}

function renderCalendarGrid() {
  if (!calendarView) return;
  calendarView.innerHTML = getCalendarHeader(currentDate);
  calendarView.scrollTop = 0;
  calendarView.querySelector('[data-calendar-prev]')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendarGrid();
  });
  calendarView.querySelector('[data-calendar-next]')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendarGrid();
  });
  calendarView.querySelectorAll('[data-calendar-day]').forEach((dayEl) => {
    dayEl.addEventListener('click', () => {
      const key = dayEl.getAttribute('data-calendar-day');
      const posts = scheduledPostsByDate.get(key) || [];
      renderCalendarDetail(posts);
    });
  });
}

function renderCalendarDetail(posts) {
  if (!calendarView) return;
  calendarView.innerHTML = getCalendarDetailView(posts);
  calendarView.scrollTop = 0;
  calendarView.querySelector('[data-calendar-back-to-grid]')?.addEventListener('click', renderCalendarGrid);
}

function parseScheduledPosts() {
  const root = getModalRoot();
  if (!root) return;
  scheduledPostsByDate = new Map();
  rawPosts = [];

  const items = root.querySelectorAll('.share-post-list-view__item');
  items.forEach((item) => {
    const button = item.querySelector('.share-post-action-bar__container button[aria-label]');
    if (!button) return;

    const label = button.getAttribute('aria-label');
    const parsed = parseDateFromLabel(label);
    if (!parsed) return;

    const textEl = item.querySelector('.m0.break-words.t-14.t-black span');
    const text = textEl ? textEl.textContent.trim() : '';

    const timeStr = `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dateStr = `${monthsEn[parsed.month]} ${parsed.day}, ${parsed.year}`;

    const key = `${parsed.year}-${parsed.month}-${parsed.day}`;
    const postData = { date: parsed.date, labelDate: dateStr, labelTime: timeStr, text };
    rawPosts.push(postData);

    if (!scheduledPostsByDate.has(key)) {
      scheduledPostsByDate.set(key, []);
    }
    scheduledPostsByDate.get(key).push(postData);
  });
}

function injectCalendarButton() {
  const root = getModalRoot();
  if (!root) return;

  if (calendarButton && calendarButton.parentElement) return;

  const headerInner = root.querySelector('.artdeco-modal__header .display-flex');
  if (!headerInner) return;

  if (headerInner.querySelector('.lc-calendar-btn')) return;

  calendarButton = document.createElement('button');
  calendarButton.type = 'button';
  calendarButton.className = 'lc-calendar-btn';
  calendarButton.title = 'Calendar view of scheduled posts';
  calendarButton.innerHTML = '📅';
  calendarButton.style.cssText = `
    background: none;
    border: 1px solid rgba(0,0,0,0.15);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    transition: background 0.15s;
    flex-shrink: 0;
    line-height: 1;
  `;
  calendarButton.addEventListener('mouseenter', () => {
    calendarButton.style.background = 'rgba(0,0,0,0.06)';
  });
  calendarButton.addEventListener('mouseleave', () => {
    calendarButton.style.background = 'none';
  });
  calendarButton.addEventListener('click', toggleCalendarView);

  headerInner.appendChild(calendarButton);
}

function injectManagementLink() {
  const root = getModalRoot();
  if (!root) return;

  if (root.querySelector('.lc-mgmt-link')) return;

  const footer = root.querySelector('.share-creation-state__schedule-and-post-container');
  if (!footer) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lc-mgmt-link';
  btn.title = 'Open scheduled posts management page';
  btn.innerHTML = '📋 Manage';
  btn.style.cssText = `
    background: none;
    border: 1px solid rgba(0,0,0,0.15);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #0a66c2;
    transition: background 0.15s;
    white-space: nowrap;
  `;
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(10,102,194,0.06)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
  btn.addEventListener('click', () => {
    window.location.href = 'https://www.linkedin.com/feed/?shareActive=true&view=management';
  });

  // Insert at the start of the footer (before the clock button)
  footer.insertBefore(btn, footer.firstChild);
}

function restoreListView() {
  if (!calendarView || !calendarView.parentElement || !originalScaffold) return;

  calendarView.replaceWith(originalScaffold);
  calendarView = null;
  originalScaffold = null;
  if (calendarButton) calendarButton.innerHTML = '📅';
}

function cleanup() {
  if (calendarButton && calendarButton.parentElement) {
    calendarButton.remove();
    calendarButton = null;
  }
  const mgmtEl = getModalRoot()?.querySelector('.lc-mgmt-link');
  if (mgmtEl) mgmtEl.remove();
  restoreListView();
}

function setupModalObserver() {
  let shadowObserver = null;

  function checkModal() {
    const root = getModalRoot();
    if (!root) return;
    // Only full cleanup when the entire modal disappears
    if (!root.querySelector('.artdeco-modal')) {
      cleanup();
      return;
    }
    // Modal still open
    const hasPostsList = root.querySelector('.share-post-list-view__container--dropdown-menu');
    const hasBaseFooter = root.querySelector('.share-creation-state__schedule-and-post-container');

    if (hasPostsList) {
      // Posts list view — show 📅 calendar button
      injectCalendarButton();
      // Remove management link if it was in the base footer
      const mgmtEl = root.querySelector('.lc-mgmt-link');
      if (mgmtEl) mgmtEl.remove();
    } else if (hasBaseFooter) {
      // Base creation modal — show management link button
      injectManagementLink();
      // Remove calendar button if post list was left
      if (calendarButton && calendarButton.parentElement) {
        calendarButton.remove();
        calendarButton = null;
      }
    } else {
      // Clean up any injected elements when in an unknown state
      if (calendarButton && calendarButton.parentElement) {
        calendarButton.remove();
        calendarButton = null;
      }
      const mgmtEl = root.querySelector('.lc-mgmt-link');
      if (mgmtEl) mgmtEl.remove();
    }
  }

  // Watch the shadow root for modal open/close
  function tryWatchShadow() {
    const root = getModalRoot();
    if (!root) {
      // #interop-outlet might not exist yet — retry
      setTimeout(tryWatchShadow, 500);
      return;
    }
    if (shadowObserver) return;

    shadowObserver = new MutationObserver(checkModal);
    shadowObserver.observe(root, { childList: true, subtree: true });
    // Initial check
    checkModal();
  }

  tryWatchShadow();
}

function init() {
  log('initialized');
  setupModalObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
