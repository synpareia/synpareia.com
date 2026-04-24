#!/usr/bin/env node
// Post-build: copy each Starlight doc source to dist/<slug>.md so
// Cloudflare Pages can serve it when agents request Accept: text/markdown.
//
// - .md files are copied verbatim (frontmatter preserved; agents benefit from it).
// - .mdx files have imports and JSX tags stripped with simple regexes. This is
//   lossy but good enough for retrieval — the HTML is still canonical. Keep
//   MDX content minimal if you want clean markdown output.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const docsDir = join(root, 'src', 'content', 'docs');
const distDir = join(root, 'dist');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      files.push(full);
    }
  }
  return files;
}

function stripMdx(source) {
  return source
    .replace(/^import\s.+?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/<\/?[A-Z][A-Za-z0-9]*(\s[^>]*)?\/?>/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function slugFromPath(srcPath) {
  const rel = relative(docsDir, srcPath).replace(/\.mdx?$/, '');
  if (rel === 'index') return '';
  return rel;
}

async function main() {
  const files = await walk(docsDir);
  let written = 0;
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    const md = file.endsWith('.mdx') ? stripMdx(src) : src;
    const slug = slugFromPath(file);
    const outPath = slug === ''
      ? join(distDir, 'index.md')
      : join(distDir, slug, 'index.md');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, md, 'utf8');
    written++;
  }
  console.log(`emit-markdown-sidecars: wrote ${written} markdown sidecars to ${distDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
