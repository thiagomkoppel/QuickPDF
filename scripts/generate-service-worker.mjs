import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const manifest = JSON.parse(await readFile(join(dist, ".vite", "manifest.json"), "utf8"));
const assets = new Set([
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon-16.png",
  "/favicon-32.png",
  "/quickpdf-192.png",
  "/quickpdf-512.png",
  "/quickpdf-maskable-512.png",
]);
for (const entry of Object.values(manifest)) {
  if (typeof entry !== "object" || entry === null) continue;
  const record = entry;
  if (typeof record.file === "string") assets.add(`/${record.file}`);
  if (Array.isArray(record.css))
    for (const file of record.css) if (typeof file === "string") assets.add(`/${file}`);
  if (Array.isArray(record.assets))
    for (const file of record.assets) if (typeof file === "string") assets.add(`/${file}`);
}
const source = `const CACHE_PREFIX="quickpdf-shell";const CACHE_NAME="${"quickpdf-shell-v1"}";const PRECACHE=${JSON.stringify([...assets].sort())};const isShell=u=>u.origin===self.location.origin&&PRECACHE.includes(u.pathname);self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(PRECACHE))));self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});self.addEventListener("fetch",event=>{const request=event.request;const url=new URL(request.url);if(request.method!=="GET"||url.protocol==="blob:"||url.protocol==="data:"||url.origin!==self.location.origin||url.pathname.endsWith(".pdf"))return;if(request.mode==="navigate"){event.respondWith(fetch(request).then(response=>response).catch(()=>caches.match("/index.html")));return}if(isShell(url)){event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));}});`;
await writeFile(join(dist, "service-worker.js"), source);
