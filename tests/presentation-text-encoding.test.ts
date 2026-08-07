import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const encodingDamage = /[\u00c3\u00e2\u00ef\ufffd]/;

const sourceFile = (path: string): string => resolve(root, path);

describe("presentation text encoding", () => {
  it("keeps visible landing and navigation copy free from mojibake", async () => {
    const files = [
      "src/presentation/components/Shell.tsx",
      "src/presentation/pages/LandingPage.tsx",
      "src/presentation/styles/global.css",
      "docs/01-architecture/FILE_LIFECYCLE.md",
    ];

    for (const file of files) {
      expect(await readFile(sourceFile(file), "utf8")).not.toMatch(encodingDamage);
    }
  });
});
