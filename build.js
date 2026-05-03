import { existsSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import readline from 'readline';
import { readManifest, listScripts, validateManifest } from './scripts/manifest.js';

function parseArgs(argv) {
  const args = { all: false, noVersion: false, scripts: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') args.all = true;
    else if (arg === '--no-version') args.noVersion = true;
    else if (arg === '--script') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) {
        throw new Error('--script requires a script id like "site/script"');
      }
      args.scripts.push(value);
    } else if (arg.startsWith('--script=')) {
      const value = arg.slice('--script='.length);
      if (!value) throw new Error('--script requires a script id like "site/script"');
      args.scripts.push(value);
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return args;
}

function bumpVersion(version) {
  const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(version ?? '');
  if (!match) return '0.0.1';
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function promptSelect(options) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('Select scripts (comma-separated numbers, or type all):');
    console.log(`0) all`);
    options.forEach((option, index) => console.log(`${index + 1}) ${option}`));
    rl.question('Choice: ', (answer) => {
      rl.close();
      resolve(String(answer ?? '').trim().toLowerCase());
    });
  });
}

const { all, noVersion, scripts: requestedScripts } = parseArgs(process.argv.slice(2));
const manifest = readManifest();
const errors = validateManifest(manifest, { requireEntries: true });

if (errors.length > 0) {
  console.error('Invalid userscripts.json:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const scripts = listScripts(manifest);

async function main() {
  if (all && requestedScripts.length > 0) {
    throw new Error('Use either --all or --script, not both');
  }

  if (requestedScripts.length > 0) {
    for (const id of requestedScripts) {
      if (!scripts.some((script) => script.id === id)) {
        throw new Error(`Unknown script: ${id}`);
      }
    }
  }

  if (scripts.length === 0) {
    console.log('Done');
    return;
  }

  let selected = [];
  if (all) selected = scripts;
  else if (requestedScripts.length > 0) {
    selected = [];
    for (const id of requestedScripts) {
      selected.push(scripts.find((script) => script.id === id));
    }
  } else {
    if (process.stdin.isTTY) {
      const choice = await promptSelect(scripts.map((item) => item.id));
      if (!choice) {
        console.log('Done');
        return;
      }
      if (choice === 'all' || choice === '0') {
        selected = scripts;
      } else {
        const indexes = choice.split(',').map((part) => Number.parseInt(part.trim(), 10) - 1);
        const invalid = indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= scripts.length);
        if (invalid) throw new Error('Invalid selection');
        selected = [...new Map(indexes.map((index) => [scripts[index].id, scripts[index]])).values()];
      }
      if (!selected.length) {
        console.log('Done');
        return;
      }
    } else {
      throw new Error('No selection provided in non-TTY mode. Use --all or --script.');
    }
  }

  if (selected.length === 0) {
    console.log('Done');
    return;
  }

  const updates = [];
  for (const item of selected) {
    const nextVersion = noVersion ? item.version : bumpVersion(item.version);
    const rollupBin = 'node_modules/rollup/dist/bin/rollup';
    if (!existsSync(rollupBin)) {
      throw new Error(`Rollup entry not found: ${rollupBin}`);
    }
    const env = { ...process.env, USERSCRIPT_ID: item.id, USERSCRIPT_VERSION: nextVersion };
    execFileSync(process.execPath, [rollupBin, '-c'], { stdio: 'inherit', env });
    updates.push({ site: item.site, script: item.script, version: nextVersion });
  }

  if (!noVersion) {
    for (const update of updates) {
      const scriptConfig = manifest.sites?.[update.site]?.scripts?.[update.script];
      if (scriptConfig && typeof scriptConfig === 'object') scriptConfig.version = update.version;
    }
    writeFileSync('userscripts.json', `${JSON.stringify(manifest, null, 2)}\n`);
  }

  console.log('Done');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
