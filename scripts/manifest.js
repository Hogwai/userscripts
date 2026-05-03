import { existsSync, readFileSync } from 'fs';

export const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export function readManifest(path = 'userscripts.json') {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function listScripts(manifest) {
  const result = [];

  for (const [site, siteConfig] of Object.entries(manifest?.sites ?? {})) {
    for (const [script, scriptConfig] of Object.entries(
      siteConfig && typeof siteConfig === 'object' && !Array.isArray(siteConfig)
        ? siteConfig.scripts ?? {}
        : {},
    )) {
      result.push({
        ...scriptConfig,
        id: `${site}/${script}`,
        tagPrefix: `${site}-${script}`,
        site,
        script,
      });
    }
  }

  return result;
}

export function validateManifest(manifest, { requireEntries = false } = {}) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return ['userscripts.json must contain a JSON object'];
  }

  if (!manifest.sites || typeof manifest.sites !== 'object' || Array.isArray(manifest.sites)) {
    errors.push('userscripts.json must contain a sites object');
  }

  for (const [site, siteConfig] of Object.entries(manifest.sites ?? {})) {
    if (!siteConfig || typeof siteConfig !== 'object' || Array.isArray(siteConfig)) {
      errors.push(`${site}: scripts must be an object`);
      continue;
    }

    if (siteConfig.scripts == null || typeof siteConfig.scripts !== 'object' || Array.isArray(siteConfig.scripts)) {
      errors.push(`${site}: scripts must be an object`);
      continue;
    }
  }

  for (const item of listScripts(manifest)) {
    if (!SEMVER_RE.test(item.version ?? '')) {
      errors.push(`${item.id}: version must be x.y.z`);
    }

    for (const field of ['entry', 'output', 'name']) {
      if (!item[field] || typeof item[field] !== 'string') {
        errors.push(`${item.id}: ${field} must be a non-empty string`);
      }
    }

    if (requireEntries && item.entry && !existsSync(item.entry)) {
      errors.push(`${item.id}: entry does not exist: ${item.entry}`);
    }
  }

  return errors;
}
