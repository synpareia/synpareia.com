#!/usr/bin/env node
// Post-build: mirror dist/.well-known/ -> dist/well-known/ (non-dot).
//
// Cloudflare Workers Static Assets does NOT upload hidden dot-directories
// or dotfiles to the asset manifest (wrangler-legacy #980, still open), so
// files under dist/.well-known/ 404 when served from ASSETS — while
// non-dot top-level files (robots.txt, llms.txt) serve fine. Pages used to
// special-case .well-known; the Workers static-asset deploy does not.
//
// We keep public/.well-known/ as the canonical source (it is the RFC-
// mandated location and other repo consumers expect it there) and mirror
// the built tree to a non-dot path that wrangler WILL upload. worker/index.ts
// rewrites the canonical `/.well-known/*` request to fetch this mirror. If
// the mirror is missing, .well-known 404s again — the two are load-bearing
// together (see the worker's serveWellKnown()).

import { cp, access, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const distDir = join(root, 'dist');
const srcDir = join(distDir, '.well-known');
const mirrorDir = join(distDir, 'well-known');

async function main() {
  try {
    await access(srcDir);
  } catch {
    console.error(
      'mirror-well-known: dist/.well-known/ not found — nothing to mirror. ' +
        'Did astro build run and copy public/.well-known/?',
    );
    process.exit(1);
  }
  // recursive copy; overwrites any stale mirror from a previous build
  await cp(srcDir, mirrorDir, { recursive: true });
  const walked = [];
  async function walk(dir, rel) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(dir, e.name), r);
      else walked.push(r);
    }
  }
  await walk(mirrorDir, '');
  if (walked.length === 0) {
    // dir present but empty → a future ignore/build change swallowed the
    // contents. Reporting success here would silently ship a site where
    // /.well-known/* 404s again — the exact failure this script exists to
    // catch. Fail the build instead.
    console.error(
      'mirror-well-known: dist/.well-known/ exists but is EMPTY — nothing to ' +
        'mirror. The build would ship a site where /.well-known/* 404s. Failing.',
    );
    process.exit(1);
  }
  console.log(
    `mirror-well-known: mirrored ${walked.length} file(s) to dist/well-known/ ` +
      `(${walked.join(', ')})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
