import { readManifest, listScripts, validateManifest } from './scripts/manifest.js';

function sanitize(value) {
  return String(value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
}

function metadataBlock(item) {
  const includes = item.includes ?? [`*://*.${item.site}/*`];
  const grants = item.grants ?? ['none'];
  const lines = [
    '// ==UserScript==',
    `// @name        ${sanitize(item.name)}`,
    `// @namespace   ${sanitize(item.namespace ?? 'userscripts')}`,
    `// @version     ${sanitize(process.env.USERSCRIPT_VERSION ?? item.version)}`,
    `// @description ${sanitize(item.description)}`,
    `// @author      ${sanitize(item.author)}`,
    ...[].concat(includes).map((include) => `// @include     ${sanitize(include)}`),
    ...[].concat(grants).map((grant) => `// @grant       ${sanitize(grant)}`),
    '// @noframes',
    `// @license     ${sanitize(item.license)}`,
    '// ==/UserScript==',
  ];
  if (item.runAt) {
    lines.splice(lines.length - 1, 0, `// @run-at      ${sanitize(item.runAt)}`);
  }
  return lines.join('\n');
}

const manifest = readManifest();
const errors = validateManifest(manifest, { requireEntries: true });
if (errors.length > 0) throw new Error(errors.join('\n'));

const selectedId = process.env.USERSCRIPT_ID || '';
const items = listScripts(manifest).filter((item) => !selectedId || item.id === selectedId);
if (selectedId && items.length === 0) throw new Error(`Unknown script: ${selectedId}`);

export default items.map((item) => ({
  input: item.entry,
  output: {
    file: item.output,
    format: 'iife',
    banner: metadataBlock(item),
    intro: `const __VERSION__ = ${JSON.stringify(process.env.USERSCRIPT_VERSION ?? item.version)};`,
  },
}));
