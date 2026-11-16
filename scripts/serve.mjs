import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
export function createSiteServer() {
  return createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      let path = resolve(root, '.' + pathname);
      if (!path.startsWith(root + '/') && path !== root) throw new Error('Invalid path');
      if (pathname.startsWith('/en/')) {
        response.writeHead(301, { Location: pathname.slice(3) + url.search }); response.end(); return;
      }
      if (extname(path) === '.html') {
        const clean = pathname.endsWith('/index.html') ? pathname.slice(0, -10) : pathname.slice(0, -5);
        response.writeHead(301, { Location: clean + url.search }); response.end(); return;
      }
      if (pathname.endsWith('/')) path = resolve(path, 'index.html');
      else if (!extname(path)) {
        try {
          if (statSync(path).isDirectory()) {
            response.writeHead(301, { Location: pathname + '/' + url.search }); response.end(); return;
          }
        } catch { /* Try a clean HTML path next. */ }
        path += '.html';
      }
      const body = readFileSync(path);
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      response.end(body);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  createSiteServer().listen(port, '127.0.0.1', () => console.log(`Static development server listening on port ${port}`));
}
