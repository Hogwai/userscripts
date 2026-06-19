import { SCHEDULED_POSTS_URL } from './config.js';
import { state } from './state.js';
import { getModalRoot } from './utils.js';

export function injectCalendarButton(onClick) {
  const root = getModalRoot();
  if (!root) return;
  if (state.calendarButton && state.calendarButton.parentElement) return;

  const headerInner = root.querySelector('.artdeco-modal__header .display-flex');
  if (!headerInner) return;
  if (headerInner.querySelector('.lc-calendar-btn')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lc-calendar-btn';
  btn.title = 'Calendar view of scheduled posts';
  btn.innerHTML = '📅';
  btn.style.cssText = `
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
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(0,0,0,0.06)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
  btn.addEventListener('click', onClick);

  headerInner.appendChild(btn);
  state.calendarButton = btn;
}

export function injectManagementLink() {
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
    window.location.href = SCHEDULED_POSTS_URL;
  });

  footer.insertBefore(btn, footer.firstChild);
}
