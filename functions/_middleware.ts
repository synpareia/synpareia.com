// Cloudflare Pages middleware — markdown content negotiation.
//
// When an agent sends Accept: text/markdown, serve the .md sidecar emitted
// by scripts/emit-markdown-sidecars.mjs at <path>/index.md instead of the
// rendered HTML. Falls through to the normal response on any miss.
//
// This implements the "Markdown for Agents" check that isitagentready.com
// looks for — reducing token usage for agents that consume our docs.

interface PagesContext {
  request: Request;
  next: () => Promise<Response>;
  env: unknown;
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

export const onRequest: (ctx: PagesContext) => Promise<Response> = async (ctx) => {
  const { request, next } = ctx;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !wantsMarkdown(request.headers.get('Accept'))) {
    return next();
  }
  if (url.pathname.startsWith('/.well-known/') || url.pathname === '/llms.txt' || url.pathname === '/robots.txt') {
    return next();
  }

  const mdResponse = await fetch(markdownUrl(url).toString());
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
  return next();
};
