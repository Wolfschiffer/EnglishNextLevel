const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const projectRealRoot = fs.realpathSync(projectRoot);
const host = '127.0.0.1';
const port = 4173;
const basePath = '/EnglishNextLevel/';
const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

const server = http.createServer((request, response) => {
    let requestUrl;
    try {
        requestUrl = new URL(request.url, `http://${host}:${port}`);
    } catch {
        response.writeHead(400).end('Bad request');
        return;
    }

    if (requestUrl.pathname === basePath.slice(0, -1)) {
        response.writeHead(308, { Location: basePath }).end();
        return;
    }

    if (!requestUrl.pathname.startsWith(basePath)) {
        response.writeHead(404).end('Not found');
        return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
        return;
    }

    let relativePath;
    try {
        relativePath = decodeURIComponent(requestUrl.pathname.slice(basePath.length)) || 'index.html';
    } catch {
        response.writeHead(400).end('Bad request');
        return;
    }

    const filePath = path.resolve(projectRoot, relativePath);
    if (!filePath.startsWith(`${projectRoot}${path.sep}`)) {
        response.writeHead(404).end('Not found');
        return;
    }

    fs.realpath(filePath, (realPathError, realFilePath) => {
        if (realPathError) {
            response.writeHead(404).end('Not found');
            return;
        }

        const relativeRealPath = path.relative(projectRealRoot, realFilePath);
        if (relativeRealPath === '..' ||
            relativeRealPath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeRealPath)) {
            response.writeHead(404).end('Not found');
            return;
        }

        fs.stat(realFilePath, (statError, stats) => {
            if (statError || !stats.isFile()) {
                response.writeHead(404).end('Not found');
                return;
            }

            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Length': stats.size,
                'Content-Type': contentTypes[path.extname(realFilePath).toLowerCase()] || 'application/octet-stream'
            });
            if (request.method === 'HEAD') {
                response.end();
                return;
            }

            fs.createReadStream(realFilePath).pipe(response);
        });
    });
});

server.listen(port, host);
