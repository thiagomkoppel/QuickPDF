import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

const nonEmpty = (value) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
const shortSha = (value) => {
  const resolved = nonEmpty(value);
  return resolved === undefined ? undefined : resolved.slice(0, 7);
};
const readGitValue = (argumentsList) => {
  try {
    return nonEmpty(
      execFileSync("git", argumentsList, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
    );
  } catch {
    return undefined;
  }
};

/** Resolves deterministic build metadata without requiring Git in deployment environments. */
export const resolveQuickPdfBuildMetadata = ({
  mode,
  environment = process.env,
  gitValue = readGitValue,
} = {}) => {
  const requestedMode = nonEmpty(mode) ?? "production";
  const resolvedMode =
    requestedMode === "development" || requestedMode === "test" ? "development" : "production";
  const sha =
    shortSha(
      environment.QUICKPDF_BUILD_SHA ?? environment.GIT_SHA ?? environment.CF_PAGES_COMMIT_SHA,
    ) ??
    shortSha(gitValue(["rev-parse", "--short=7", "HEAD"])) ??
    "unknown";
  const branch =
    nonEmpty(
      environment.QUICKPDF_BUILD_BRANCH ?? environment.GIT_BRANCH ?? environment.CF_PAGES_BRANCH,
    ) ??
    gitValue(["branch", "--show-current"]) ??
    "unknown";

  return Object.freeze({ version: packageJson.version, sha, branch, mode: resolvedMode });
};
