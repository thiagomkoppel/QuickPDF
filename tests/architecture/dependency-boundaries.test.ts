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
const forbiddenApplicationImports = [
  "react",
  "react-dom",
  "pdfjs-dist",
  "pdf-lib",
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

  it("keeps application use cases independent from React and PDF.js", () => {
    const applicationFiles = readProjectFiles("src/application", [".ts", ".tsx"]);
    const violations = applicationFiles.flatMap((file) =>
      forbiddenApplicationImports
        .filter((forbiddenImport) => file.contents.includes(`from "${forbiddenImport}`))
        .map((forbiddenImport) => `${file.path} imports ${forbiddenImport}`),
    );

    expect(violations).toEqual([]);
  });

  it("isolates PDF.js usage to PDF infrastructure", () => {
    const sourceFiles = readProjectFiles("src", [".ts", ".tsx"]);
    const violations = sourceFiles
      .filter((file) => file.contents.includes("pdfjs-dist"))
      .filter((file) => !file.path.includes("src\\infrastructure\\pdf"))
      .map((file) => `${file.path} imports pdfjs-dist outside PDF infrastructure`);

    expect(violations).toEqual([]);
  });

  it("prevents presentation from directly accessing DocumentSession", () => {
    const presentationFiles = readProjectFiles("src/presentation", [".ts", ".tsx"]);
    const violations = presentationFiles
      .filter((file) => file.contents.includes("DocumentSession"))
      .map((file) => `${file.path} references DocumentSession`);

    expect(violations).toEqual([]);
  });

  it("does not introduce browser persistence, analytics, service workers, remote assets, or document network APIs", () => {
    const sourceFiles = readProjectFiles("src", [".ts", ".tsx", ".css"]);
    const forbiddenPatterns = [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "document.cookie",
      "navigator.serviceWorker",
      "gtag(",
      "analytics",
      "telemetry",
      "fetch(",
      "XMLHttpRequest",
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
