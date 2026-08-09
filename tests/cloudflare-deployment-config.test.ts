import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import packageJson from "../package.json";
import { describe, expect, it } from "vitest";

const configurationSource = readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf8");

describe("Cloudflare static deployment configuration", () => {
  it("defines a named static-assets deployment with a compatibility date", () => {
    expect(configurationSource).toContain('"name": "quickpdf"');
    expect(configurationSource).toContain('"compatibility_date": "2026-08-09"');
    expect(configurationSource).toContain('"directory": "./dist"');
    expect(packageJson.devDependencies.wrangler).toBe("4.120.0");
  });
});
