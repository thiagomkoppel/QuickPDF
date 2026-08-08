import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];
const root = process.cwd();
const staticFiles = [
  "manifest.webmanifest",
  "apple-touch-icon.png",
  "favicon.ico",
  "favicon-16.png",
  "favicon-32.png",
  "quickpdf-192.png",
  "quickpdf-512.png",
  "quickpdf-maskable-512.png",
] as const;

const writeBuild = async (directory: string, html: string): Promise<void> => {
  const dist = join(directory, "dist");
  await mkdir(join(dist, ".vite"), { recursive: true });
  await mkdir(join(dist, "assets"), { recursive: true });
  await writeFile(join(dist, "index.html"), html);
  await writeFile(join(dist, "manifest.webmanifest"), "{}");
  for (const file of staticFiles) await writeFile(join(dist, file), file);
  await writeFile(join(dist, "assets", "app-123.js"), "export {};");
  await writeFile(join(dist, "assets", "app-123.css"), "body{}");
  await writeFile(
    join(dist, ".vite", "manifest.json"),
    JSON.stringify({
      "src/main.tsx": { file: "assets/app-123.js", css: ["assets/app-123.css"] },
    }),
  );
};

const generateWorker = (directory: string): void => {
  execFileSync(process.execPath, [resolve(root, "scripts", "generate-service-worker.mjs")], {
    cwd: directory,
    stdio: "pipe",
  });
};

const readCacheName = async (directory: string): Promise<string> => {
  const source = await readFile(join(directory, "dist", "service-worker.js"), "utf8");
  const match = /const CACHE_NAME="([^"]+)"/.exec(source);
  if (match?.[1] === undefined) throw new Error("Generated worker did not declare a cache name.");
  return match[1];
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("service-worker generator", () => {
  it("creates a distinct atomic shell cache when final build content changes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quickpdf-shell-"));
    temporaryRoots.push(directory);
    await writeBuild(directory, "<main>build A</main>");
    generateWorker(directory);
    const firstCacheName = await readCacheName(directory);

    await writeBuild(directory, "<main>build B</main>");
    generateWorker(directory);
    const secondCacheName = await readCacheName(directory);
    const source = await readFile(join(directory, "dist", "service-worker.js"), "utf8");

    expect(firstCacheName).toMatch(/^quickpdf-shell-[a-f0-9]{16}$/);
    expect(secondCacheName).toMatch(/^quickpdf-shell-[a-f0-9]{16}$/);
    expect(secondCacheName).not.toBe(firstCacheName);
    expect(source).toContain("await caches.delete(CACHE_NAME)");
    expect(source).toContain("try{return await fetch(request)}catch{");
    expect(source).toContain("cache.match(APP_SHELL_URL)");
    expect(source).toContain("cache.match(url.pathname)");
  });

  it("normalizes a redirected HTML fetch into a redirect-free offline navigation shell", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quickpdf-shell-"));
    temporaryRoots.push(directory);
    await writeBuild(directory, "<main>shell</main>");
    generateWorker(directory);
    const source = await readFile(join(directory, "dist", "service-worker.js"), "utf8");
    const entries = new Map<string, Response>();
    const cache = {
      put: (key: string, response: Response): Promise<void> => {
        entries.set(key, response.clone());
        return Promise.resolve();
      },
    };
    type InstallListener = (event: { waitUntil: (promise: Promise<unknown>) => void }) => void;
    const listeners = new Map<string, InstallListener>();
    const redirectedHtml = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      arrayBuffer: (): Promise<ArrayBuffer> =>
        Promise.resolve(new TextEncoder().encode("<main>shell</main>").buffer),
      redirected: true,
      url: "https://quickpdf.example/",
    } as unknown as Response;
    class TestRequest {
      public constructor(public readonly url: string) {}
    }
    const fetchAsset = (request: TestRequest): Promise<Response> => {
      if (request.url === "/") return Promise.resolve(redirectedHtml);
      const contentType = request.url.endsWith(".css")
        ? "text/css"
        : request.url.endsWith(".js")
          ? "application/javascript"
          : request.url.endsWith(".webmanifest")
            ? "application/manifest+json"
            : request.url.endsWith(".ttf")
              ? "font/ttf"
              : request.url.endsWith(".png") || request.url.endsWith(".ico")
                ? "image/png"
                : "application/octet-stream";
      return Promise.resolve(new Response("asset", { headers: { "content-type": contentType } }));
    };
    const workerGlobal = {
      addEventListener: (type: string, listener: InstallListener): void => {
        listeners.set(type, listener);
      },
    };

    runInNewContext(source, {
      self: workerGlobal,
      caches: {
        open: (): Promise<typeof cache> => Promise.resolve(cache),
        delete: (): Promise<boolean> => Promise.resolve(true),
      },
      fetch: fetchAsset,
      Request: TestRequest,
      Response,
      Headers,
      Error,
      Promise,
    });

    let installPromise: Promise<unknown> | undefined;
    listeners.get("install")?.({
      waitUntil: (promise) => {
        installPromise = promise;
      },
    });
    if (installPromise === undefined) throw new Error("Generated worker did not register install.");
    await installPromise;

    const cachedShell = entries.get("/");
    if (cachedShell === undefined) throw new Error("Generated worker did not cache the shell.");
    expect(cachedShell.redirected).toBe(false);
    expect(cachedShell.status).toBe(200);
    expect(cachedShell.headers.get("content-type")).toContain("text/html");
  });
});
