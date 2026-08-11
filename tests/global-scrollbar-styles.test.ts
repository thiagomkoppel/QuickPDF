import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const stylesheetPath = resolve(process.cwd(), "src", "presentation", "styles", "global.css");

describe("global scrollbar styles", () => {
  it("defines one tokenized scrollbar treatment while preserving Layers scroll ownership", async () => {
    const stylesheet = await readFile(stylesheetPath, "utf8");

    for (const token of [
      "--scrollbar-size",
      "--scrollbar-track-color",
      "--scrollbar-thumb-color",
      "--scrollbar-thumb-hover-color",
      "--scrollbar-radius",
    ]) {
      expect(stylesheet).toContain(token);
    }

    expect(stylesheet).toMatch(/\*\s*\{[^}]*scrollbar-color:[^}]*scrollbar-width:\s*thin/s);
    expect(stylesheet).toContain("*::-webkit-scrollbar");
    expect(stylesheet).toContain("*::-webkit-scrollbar-track");
    expect(stylesheet).toContain("*::-webkit-scrollbar-thumb");
    expect(stylesheet).toContain("*::-webkit-scrollbar-thumb:hover");

    expect(stylesheet).toMatch(
      /\.element-inspector__layers-region\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s,
    );
    expect(stylesheet).not.toContain(".element-inspector__layers-region::-webkit-scrollbar");
    expect(stylesheet).not.toMatch(/\.layers-list\s*\{[^}]*overflow-y:\s*(?:auto|scroll)/s);
  });
});
