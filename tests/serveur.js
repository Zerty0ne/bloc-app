/* Serveur statique minimal pour les tests — sert la racine du repo. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json" };

function demarrer(port) {
  const racine = path.join(__dirname, "..");
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const fichier = path.join(racine, p);
    if (!fichier.startsWith(racine)) { res.writeHead(403).end(); return; }
    fs.readFile(fichier, (err, data) => {
      if (err) { res.writeHead(404); res.end("404"); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(fichier)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(port, () => r(srv)));
}
module.exports = { demarrer };
