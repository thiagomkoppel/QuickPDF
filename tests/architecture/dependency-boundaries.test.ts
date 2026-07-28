import { describe, expect, it } from "vitest";

import { readProjectFiles } from "./readProjectFiles";

const forbiddenDomainImports = [
  "react",
  "react-dom",
  "pdfjs-dist",
  "pdf-lib",
  "../infrastructure",
  "../presentation",
];

describe("source dependency boundaries", () => {
  it("keeps the domain layer independent from UI, PDF libraries, and browser adapters", () => {
    const domainFiles = readProjectFiles("src/domain", [".ts", ".tsx"]);

    const violations = domainFiles.flatMap((file) =>
      forbiddenDomainImports
        .filter((forbiddenImport) => file.contents.includes(`from "${forbiddenImport}`))
        .map((forbiddenImport) => `${file.path} imports ${forbiddenImport}`),
    );

    expect(violations).toEqual([]);
  });

  it("does not introduce browser persistence, analytics, service workers, or remote assets", () => {
    const sourceFiles = readProjectFiles("src", [".ts", ".tsx", ".css"]);
    const forbiddenPatterns = [
      "localStorage",
      "indexedDB",
      "navigator.serviceWorker",
      "gtag(",
      "analytics",
      "telemetry",
      "fonts.googleapis.com",
      "http://",
      "https://",
    ];

    const violations = sourceFiles.flatMap((file) =>
      forbiddenPatterns
        .filter((pattern) => file.contents.includes(pattern))
        .map((pattern) => `${file.path} contains ${pattern}`),
    );

    expect(violations).toEqual([]);
  });
});
