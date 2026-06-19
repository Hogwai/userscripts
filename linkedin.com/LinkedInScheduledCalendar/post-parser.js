import { MONTHS_EN } from './config.js';
import { parseDateFromLabel } from './date-utils.js';
import { state } from './state.js';
import { getModalRoot } from './utils.js';

export function parseScheduledPosts() {
  const root = getModalRoot();
  if (!root) return;

  const map = new Map();
  const posts = [];

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
    const dateStr = `${MONTHS_EN[parsed.month]} ${parsed.day}, ${parsed.year}`;

    const key = `${parsed.year}-${parsed.month}-${parsed.day}`;
    const postData = { date: parsed.date, labelDate: dateStr, labelTime: timeStr, text };
    posts.push(postData);

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(postData);
  });

  state.scheduledPostsByDate = map;
  state.rawPosts = posts;
}
