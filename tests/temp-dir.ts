// Temporary folders for a test file, removed after the file's tests finish.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const made: string[] = [];

afterAll(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

export function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `toos-${prefix}-`));
  made.push(dir);
  return dir;
}
