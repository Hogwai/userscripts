import { SCRIPT_NAME, INTEROP_OUTLET_SELECTOR } from './config.js';

export function getModalRoot() {
  const outlet = document.querySelector(INTEROP_OUTLET_SELECTOR);
  return outlet ? outlet.shadowRoot : null;
}

export function log(...args) {
  console.info(`[${SCRIPT_NAME}]`, ...args);
}
