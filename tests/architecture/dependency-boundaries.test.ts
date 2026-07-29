import { describe, expect, it } from "vitest";

import { readProjectFiles } from "./readProjectFiles";

const forbiddenDomainImports = [
  "react",
  "react-dom",
  "pdfjs-dist",
  "pdf-lib",
  "../application",
  "../infrastructure",
  "../presentation",
];

const forbiddenApplicationImports = [
  "react",
  "react-dom",
  "pdfjs-dist",
  "pdf-lib",
  "../presentation",
  "../infrastructure",
];

describe("source dependency boundaries", () => {
  it("keeps the domain layer independent from application, UI, PDF libraries, and browser adapters", () => {
    const domainFiles = readProjectFiles("src/domain", [".ts", ".tsx"]);

    const violations = domainFiles.flatMap((file) =>
      forbiddenDomainImports
        .filter((forbiddenImport) => file.contents.includes(`from "${forbiddenImport}`))
        .map((forbiddenImport) => `${file.path} imports ${forbiddenImport}`),
    );

    expect(violations).toEqual([]);
  });

  it("keeps the application layer free of presentation, React, browser, and PDF dependencies", () => {
    const applicationFiles = readProjectFiles("src/application", [".ts", ".tsx"]);
    const forbiddenPatterns = ["window", "document.", "localStorage", "indexedDB", "navigator"];

    const violations = applicationFiles.flatMap((file) => [
      ...forbiddenApplicationImports
        .filter((forbiddenImport) => file.contents.includes(`from "${forbiddenImport}`))
        .map((forbiddenImport) => `${file.path} imports ${forbiddenImport}`),
      ...forbiddenPatterns
        .filter((pattern) => file.contents.includes(pattern))
        .map((pattern) => `${file.path} contains ${pattern}`),
    ]);

    expect(violations).toEqual([]);
  });

  it("prevents presentation code from directly importing DocumentSession", () => {
    const presentationFiles = readProjectFiles("src/presentation", [".ts", ".tsx"]);

    const violations = presentationFiles.flatMap((file) =>
      ["../domain/document-session", "DocumentSession"]
        .filter((pattern) => file.contents.includes(pattern))
        .map((pattern) => `${file.path} directly references ${pattern}`),
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
