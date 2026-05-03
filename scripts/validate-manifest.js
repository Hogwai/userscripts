import { readManifest, validateManifest } from './manifest.js';

let manifest;

try {
  manifest = readManifest();
} catch (error) {
  if (error && error.code === 'ENOENT') {
    console.error('Invalid userscripts.json:');
    console.error('- userscripts.json not found');
    process.exit(1);
  }

  console.error('Invalid userscripts.json:');
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const errors = validateManifest(manifest, { requireEntries: true });

if (errors.length > 0) {
  console.error('Invalid userscripts.json:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('✓ userscripts.json is valid');
