// Serves a built out/ the way the static host does, shared by dc-check.mjs,
// dc-compare.mjs (#309) and dc-contrast.mjs (#383): /reports is reports.html,
// /reports/x is reports/x.html, and a page it lacks is a 404, with a body, as
// Chrome fails page.goto on an empty one.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Resolves to the server, listening on a free port of 127.0.0.1.
export function serve(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const tries = urlPath.endsWith("/") ? [urlPath + "index.html"] : [urlPath, urlPath + ".html"];
    const file = tries
      .map((p) => path.join(root, p))
      .find((f) => f.startsWith(root + path.sep) && fs.statSync(f, { throwIfNoEntry: false })?.isFile());
    if (!file) return res.writeHead(404, { "content-type": TYPES[".txt"] }).end("not found");
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
