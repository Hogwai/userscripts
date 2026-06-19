import { SCRIPT_NAME } from './config.js';
import { state, resetCalendarState } from './state.js';
import { getModalRoot, log } from './utils.js';
import { parseScheduledPosts } from './post-parser.js';
import { renderCalendarGrid } from './calendar-ui.js';
import { injectCalendarButton, injectManagementLink } from './buttons.js';

function toggleCalendarView() {
  const root = getModalRoot();
  if (!root) return;

  if (state.calendarView && state.calendarView.parentElement) {
    restoreListView();
    return;
  }

  const listContainer = root.querySelector('.share-post-list-view__container--dropdown-menu');
  if (!listContainer) return;

  showCalendar(root, listContainer);
}

function showCalendar(root, listContainer) {
  state.originalScaffold = listContainer.querySelector('.scaffold-finite-scroll');
  if (!state.originalScaffold) {
    log('scaffold-finite-scroll not found inside list container');
    return;
  }

  parseScheduledPosts();

  state.calendarView = document.createElement('div');
  state.calendarView.style.borderTop = '1px solid #e5e7eb';
  state.calendarView.style.background = '#fff';
  state.calendarView.style.color = '#111827';
  state.calendarView.style.maxHeight = '60vh';
  state.calendarView.style.minHeight = '400px';
  state.calendarView.style.overflow = 'auto';
  state.calendarView.style.boxSizing = 'border-box';

  renderCalendarGrid();

  state.originalScaffold.replaceWith(state.calendarView);
  if (state.calendarButton) state.calendarButton.innerHTML = '📋';
  log('calendar view inserted');
}

function restoreListView() {
  if (!state.calendarView || !state.calendarView.parentElement || !state.originalScaffold) return;

  state.calendarView.replaceWith(state.originalScaffold);
  resetCalendarState();
  if (state.calendarButton) state.calendarButton.innerHTML = '📅';
}

function cleanup() {
  if (state.calendarButton && state.calendarButton.parentElement) {
    state.calendarButton.remove();
    state.calendarButton = null;
  }
  const mgmtEl = getModalRoot()?.querySelector('.lc-mgmt-link');
  if (mgmtEl) mgmtEl.remove();
  restoreListView();
}

function removeInjectedElements(root) {
  if (state.calendarButton && state.calendarButton.parentElement) {
    state.calendarButton.remove();
    state.calendarButton = null;
  }
  const mgmtEl = root.querySelector('.lc-mgmt-link');
  if (mgmtEl) mgmtEl.remove();
}

function checkModal() {
  const root = getModalRoot();
  if (!root) return;

  if (!root.querySelector('.artdeco-modal')) {
    cleanup();
    return;
  }

  const hasPostsList = root.querySelector('.share-post-list-view__container--dropdown-menu');
  const hasBaseFooter = root.querySelector('.share-creation-state__schedule-and-post-container');

  if (hasPostsList) {
    injectCalendarButton(toggleCalendarView);
    const mgmtEl = root.querySelector('.lc-mgmt-link');
    if (mgmtEl) mgmtEl.remove();
  } else if (hasBaseFooter) {
    injectManagementLink();
    if (state.calendarButton && state.calendarButton.parentElement) {
      state.calendarButton.remove();
      state.calendarButton = null;
    }
  } else {
    removeInjectedElements(root);
  }
}

function setupModalObserver() {
  let shadowObserver = null;

  function tryWatchShadow() {
    const root = getModalRoot();
    if (!root) {
      setTimeout(tryWatchShadow, 500);
      return;
    }
    if (shadowObserver) return;

    shadowObserver = new MutationObserver(checkModal);
    shadowObserver.observe(root, { childList: true, subtree: true });
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
