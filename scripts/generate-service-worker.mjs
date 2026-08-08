import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const manifest = JSON.parse(await readFile(join(dist, ".vite", "manifest.json"), "utf8"));
const assets = new Set([
  "/",
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

const precache = [...assets].sort();
const digest = createHash("sha256");
for (const asset of precache) {
  const file = asset === "/" ? "index.html" : asset.slice(1);
  digest.update(asset);
  digest.update(await readFile(join(dist, file)));
}
const cacheName = `quickpdf-shell-${digest.digest("hex").slice(0, 16)}`;

const source = `const CACHE_PREFIX="quickpdf-shell-";
const CACHE_NAME="${cacheName}";
const APP_SHELL_URL="/";
const PRECACHE=${JSON.stringify(precache)};
const expectedContentType=(pathname)=>{
  if(pathname==="/"||pathname.endsWith(".html"))return ["text/html"];
  if(/\\.(?:js|mjs)$/i.test(pathname))return ["javascript","ecmascript"];
  if(/\\.css$/i.test(pathname))return ["text/css"];
  if(/\\.webmanifest$/i.test(pathname))return ["application/manifest+json","application/json"];
  if(/\\.(?:ttf|woff2?)$/i.test(pathname))return ["font/","application/font","application/octet-stream"];
  if(/\\.(?:png|ico)$/i.test(pathname))return ["image/"];
  return [];
};
const hasExpectedContentType=(pathname,response)=>{
  const expected=expectedContentType(pathname);
  if(expected.length===0)return true;
  const contentType=response.headers.get("content-type")?.toLowerCase()??"";
  return expected.some((value)=>contentType.includes(value));
};
const normalizeNavigationResponse=async(response)=>{
  const headers=new Headers();
  for(const name of ["content-type","content-language"]){
    const value=response.headers.get(name);
    if(value!==null)headers.set(name,value);
  }
  return new Response(await response.arrayBuffer(),{status:200,statusText:"OK",headers});
};
const isExactPrecacheRequest=(request,url)=>url.origin===self.location.origin&&PRECACHE.includes(url.pathname)&&url.search==="";
const populateCache=async()=>{
  const cache=await caches.open(CACHE_NAME);
  try{
    await Promise.all(PRECACHE.map(async(pathname)=>{
      const response=await fetch(new Request(pathname,{cache:"reload"}));
      if(!response.ok||!hasExpectedContentType(pathname,response))throw new Error("QuickPDF shell asset could not be safely cached");
      await cache.put(pathname,pathname===APP_SHELL_URL?await normalizeNavigationResponse(response):response);
    }));
  }catch(error){
    await caches.delete(CACHE_NAME);
    throw error;
  }
};
self.addEventListener("install",event=>event.waitUntil(populateCache()));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=="GET"||url.protocol==="blob:"||url.protocol==="data:"||url.origin!==self.location.origin||url.pathname.endsWith(".pdf"))return;
  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{return await fetch(request)}catch{
        const cache=await caches.open(CACHE_NAME);
        return(await cache.match(APP_SHELL_URL))??Response.error();
      }
    })());
    return;
  }
  if(isExactPrecacheRequest(request,url)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      return(await cache.match(url.pathname))??fetch(request);
    })());
  }
});`;
await writeFile(join(dist, "service-worker.js"), source);
