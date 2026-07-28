import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface ProjectFile {
  readonly path: string;
  readonly contents: string;
}

const readFiles = (root: string, extensions: readonly string[]): readonly ProjectFile[] => {
  const entries = readdirSync(root, { withFileTypes: true });

  return entries.flatMap((entry): readonly ProjectFile[] => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return readFiles(path, extensions);
    }

    if (!entry.isFile() || !extensions.some((extension) => path.endsWith(extension))) {
      return [];
    }

    return [{ path, contents: readFileSync(path, "utf8") }];
  });
};

export const readProjectFiles = (
  root: string,
  extensions: readonly string[],
): readonly ProjectFile[] => {
  if (!statSync(root).isDirectory()) {
    return [];
  }

  return readFiles(root, extensions);
};
