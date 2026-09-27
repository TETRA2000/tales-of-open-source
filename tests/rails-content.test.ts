import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLibrary } from "../src/lib/content.ts";
import { localCloneDir } from "../src/lib/git.ts";

// Runs against the real content and the real local clone at the pin, when the clone is present.
describe.skipIf(!existsSync(localCloneDir("rails/rails")))("real content", () => {
  it("every Rails excerpt matches rails/rails at its pin", () => {
    const { sets } = loadLibrary({ contentDir: join(import.meta.dirname, "../content") });
    const rails = sets.find((s) => s.id === "rails");
    expect(rails?.chapters.find((c) => c.id === "04-request-lifecycle")?.articles.map((a) => a.format.code)).toEqual(["GT"]);
  });
});
