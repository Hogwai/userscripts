import { DAYS_HEADER, MONTHS_EN } from './config.js';
import { state } from './state.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function getCalendarHeader(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const key = `${year}-${month}-${dayNum}`;
    const hasPost = state.scheduledPostsByDate.has(key);
    const posts = hasPost ? state.scheduledPostsByDate.get(key) : [];
    const isToday = dayNum === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
    return `
      <div data-calendar-day="${key}" style="position:relative;min-height:60px;padding:4px;border-radius:8px;background:${hasPost ? '#f0fdf4' : isToday ? '#f0f7ff' : '#fff'};border:1px solid ${hasPost ? '#86efac' : isToday ? '#93c5fd' : '#f3f4f6'};cursor:${hasPost ? 'pointer' : 'default'};transition:box-shadow 0.15s;">
        <div style="font-size:13px;font-weight:${isToday ? '700' : '500'};color:${hasPost ? '#166534' : isToday ? '#1e40af' : '#374151'};margin-bottom:2px;">${dayNum}</div>
        ${hasPost ? `<div style="font-size:10px;color:#166534;line-height:1.3;">${posts.length} post${posts.length > 1 ? 's' : ''}</div>` : ''}
      </div>
    `;
  }).join('');

  const headerCells = DAYS_HEADER.map(
    (d) => `<div style="font-size:12px;font-weight:600;color:#6b7280;padding:4px 0;">${d}</div>`
  ).join('');

  return `
    <div style="padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <button type="button" data-calendar-prev title="Previous month" style="background:none;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:18px;font-weight:700;line-height:1;color:#374151;">◀</button>
        <h3 style="margin:0;font-size:18px;font-weight:600;color:#111827;">${MONTHS_EN[month]} ${year}</h3>
        <button type="button" data-calendar-next title="Next month" style="background:none;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:18px;font-weight:700;line-height:1;color:#374151;">▶</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">
        ${headerCells}
        ${Array.from({ length: offset }, () => '<div></div>').join('')}
        ${dayCells}
      </div>
    </div>
  `;
}

function getCalendarDetailView(posts) {
  const backBtn = `<button type="button" data-calendar-back-to-grid style="background:none;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:12px;color:#374151;">◀ Back to calendar</button>`;

  if (!posts || posts.length === 0) {
    return `
      <div style="padding:16px;">
        ${backBtn}
        <div style="padding:20px;text-align:center;color:#6b7280;">No scheduled posts on this day.</div>
      </div>`;
  }

  const postCards = posts.map((post) => `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:8px;background:#fff;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${post.labelTime}</div>
      <div style="font-size:14px;color:#111827;line-height:1.4;word-break:break-word;">${escapeHtml(post.text || '(no text)')}</div>
    </div>
  `).join('');

  return `
    <div style="padding:16px;">
      ${backBtn}
      <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#111827;">Scheduled posts — ${posts[0].labelDate}</h3>
      <div style="overflow-y:auto;">${postCards}</div>
    </div>
  `;
}

export function renderCalendarGrid() {
  if (!state.calendarView) return;
  state.calendarView.innerHTML = getCalendarHeader(state.currentDate);
  state.calendarView.scrollTop = 0;
  state.calendarView.querySelector('[data-calendar-prev]')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendarGrid();
  });
  state.calendarView.querySelector('[data-calendar-next]')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendarGrid();
  });
  state.calendarView.querySelectorAll('[data-calendar-day]').forEach((dayEl) => {
    dayEl.addEventListener('click', () => {
      const key = dayEl.getAttribute('data-calendar-day');
      const posts = state.scheduledPostsByDate.get(key) || [];
      renderCalendarDetail(posts);
    });
  });
}

export function renderCalendarDetail(posts) {
  if (!state.calendarView) return;
  state.calendarView.innerHTML = getCalendarDetailView(posts);
  state.calendarView.scrollTop = 0;
  state.calendarView.querySelector('[data-calendar-back-to-grid]')?.addEventListener('click', renderCalendarGrid);
}
