import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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
});
