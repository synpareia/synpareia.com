// Cloudflare Worker entry — markdown content negotiation for the
// static-asset deploy.
//
// Supersedes functions/_middleware.ts (a Cloudflare *Pages* Function that
// never executed after the 2026-05-13 move to a Workers static-asset
// deploy — see launch hit-list 2.6a). Same negotiation contract: when an
// agent sends `Accept: text/markdown`, serve the .md sidecar emitted by
// scripts/emit-markdown-sidecars.mjs at <path>/index.md instead of the
// rendered HTML. Falls through to the normal asset response on any miss.
//
// Requires wrangler.jsonc: `main` pointing here, `assets.binding: ASSETS`,
// and `assets.run_worker_first: true` (without run_worker_first, requests
// that match an asset never reach this code — the exact failure mode that
// killed the Pages middleware).

interface Env {
  ASSETS: { fetch(request: Request | string): Promise<Response> };
}

function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const entries = accept.split(',').map((s) => s.trim().toLowerCase());
  for (const entry of entries) {
    const [type, ...params] = entry.split(';').map((s) => s.trim());
    if (type === 'text/markdown' || type === 'text/x-markdown') {
      const q = params.find((p) => p.startsWith('q='));
      if (!q || parseFloat(q.slice(2)) > 0) return true;
    }
  }
  return false;
}

function markdownUrl(url: URL): URL {
  const md = new URL(url.toString());
  let path = md.pathname;
  if (path.endsWith('/')) {
    path = path + 'index.md';
  } else if (!path.endsWith('.md')) {
    path = path + '/index.md';
  }
  md.pathname = path;
  return md;
}

// The response on a negotiable path differs by Accept header, so EVERY
// response for such a path must carry `Vary: Accept` — including the
// plain-HTML branch. Without it, a shared cache that stored the HTML
// (no Vary) would serve that HTML to a later markdown-requesting client
// at the same URL (and vice versa). (#258 review.)
async function withVaryAccept(resp: Response): Promise<Response> {
  const headers = new Headers(resp.headers);
  headers.append('Vary', 'Accept');
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

function isExempt(pathname: string): boolean {
  return pathname === '/llms.txt' || pathname === '/robots.txt';
}

// Content types for extensionless /.well-known/ files (Cloudflare can't
// infer these from a missing extension). Files WITH a known extension
// (.json) get the right type from ASSETS automatically and are omitted.
const WELL_KNOWN_CONTENT_TYPES: Record<string, string> = {
  '/.well-known/api-catalog': 'application/linkset+json',
};

// Cloudflare Workers Static Assets does not upload hidden dot-directories,
// so /.well-known/* 404s if served directly from ASSETS (wrangler-legacy
// #980). scripts/mirror-well-known.mjs mirrors the built tree to a non-dot
// path dist/well-known/ that wrangler DOES upload; here we rewrite the
// canonical request to fetch that mirror. The mirror script and this
// function are load-bearing together — remove one and .well-known 404s.
// (The mirror path /well-known/* is itself publicly reachable — a harmless
// duplicate of already-public content; the canonical /.well-known/* URLs
// are what consumers use.)
async function serveWellKnown(request: Request, url: URL, env: Env): Promise<Response> {
  const mirrored = new URL(url.toString());
  mirrored.pathname = '/well-known/' + url.pathname.slice('/.well-known/'.length);
  // Forward the ORIGINAL request (new Request(url, request) copies method +
  // headers): preserves HEAD as well as GET, and conditional/range headers
  // (If-None-Match, If-Modified-Since, Range, Accept-Encoding) so these files
  // get 304s/ranges like the rest of the site. HEAD matters — some MCP /
  // marketplace validators probe with HEAD before GET.
  const resp = await env.ASSETS.fetch(new Request(mirrored.toString(), request));
  const override = WELL_KNOWN_CONTENT_TYPES[url.pathname];
  if (!resp.ok || !override) return resp;
  const headers = new Headers(resp.headers);
  headers.set('Content-Type', override);
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Canonical .well-known path: served from the non-dot mirror (see
    // serveWellKnown). GET *and* HEAD, before everything else; never
    // negotiated. serveWellKnown forwards the original method, so HEAD to a
    // dot-directory no longer falls through to the un-mirrored 404 path.
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname.startsWith('/.well-known/')
    ) {
      return serveWellKnown(request, url, env);
    }

    // Non-negotiable requests: pass through untouched (no Vary needed —
    // these paths never vary by Accept).
    if (request.method !== 'GET' || isExempt(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    if (!wantsMarkdown(request.headers.get('Accept'))) {
      return withVaryAccept(await env.ASSETS.fetch(request));
    }

    const mdResponse = await env.ASSETS.fetch(markdownUrl(url).toString());
    if (mdResponse.ok) {
      const body = await mdResponse.text();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Vary': 'Accept',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Negotiated': 'markdown',
        },
      });
    }
    return withVaryAccept(await env.ASSETS.fetch(request));
  },
};
