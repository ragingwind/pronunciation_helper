// Development server: serves the project over http:// with caching disabled,
// and rebuilds data/articles.json whenever articles.md changes.
//
// The app fetches articles.md / data/articles.json, and the microphone + ES
// module import require an http(s) origin — so a file:// open won't work; use this.
//
// Run: `npm run dev` (optionally `PORT=3000 npm run dev` or `node scripts/dev-server.mjs 3000`)

import http from 'node:http';
import { createReadStream, watch, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArticlesJson } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 8000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
    try {
        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';

        const filePath = path.join(ROOT, path.normalize(urlPath));
        if (!filePath.startsWith(ROOT)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const info = await stat(filePath).catch(() => null);
        if (!info || !info.isFile()) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        res.writeHead(200, {
            'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        createReadStream(filePath).pipe(res);
    } catch (err) {
        res.writeHead(500);
        res.end('Server error');
    }
});

server.listen(PORT, () => {
    console.log(`Dev server running: http://localhost:${PORT}/`);
    if (!existsSync(path.join(ROOT, 'data', 'articles.json'))) {
        console.log('No data/articles.json yet — the app will parse articles.md live.');
        console.log('Run `npm run build` to prebuild translations for instant loading.');
    }
    console.log('Watching articles.md for changes...');
});

// Debounced auto-rebuild of prepared data on articles.md edits.
let rebuildTimer = null;
let rebuilding = false;
function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
        if (rebuilding) return;
        rebuilding = true;
        console.log('articles.md changed — rebuilding data/articles.json...');
        try {
            await buildArticlesJson();
            console.log('data/articles.json updated. Refresh the browser.');
        } catch (err) {
            console.error('Rebuild failed:', err.message);
        }
        rebuilding = false;
    }, 300);
}

try {
    watch(path.join(ROOT, 'articles.md'), scheduleRebuild);
} catch (err) {
    console.warn('Could not watch articles.md:', err.message);
}
