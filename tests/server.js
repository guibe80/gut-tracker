// Simple static file server for Playwright smoke tests
// Serves the parent directory (project root) on localhost:8080
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8080;

const MIME = {
  '': 'text/html',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  // Prevent path traversal
  const filePath = path.normalize(path.join(ROOT, urlPath)).startsWith(ROOT)
    ? path.join(ROOT, urlPath)
    : path.join(ROOT, 'index.html');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'text/plain');
  res.end(fs.readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`Serving Gut + Glucose at http://localhost:${PORT}`);
});
