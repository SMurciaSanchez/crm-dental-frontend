/**
 * Mini servidor para servir el frontend CRM Dental UNICOC
 * Ejecutar: node servidor-frontend.js
 * Luego abrir: http://localhost:5500
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 5500;
const DIR  = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  let filePath = path.join(DIR, req.url === '/' ? '/crm_dental_final.html' : req.url);
  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('No encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`✅ Frontend disponible en: http://localhost:${PORT}`);
  console.log(`   Backend API en:         http://localhost:3000/api`);
  console.log(`\n   Ctrl+C para detener`);
});
