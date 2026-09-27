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
    const chapter = rails?.chapters.find((c) => c.id === "04-request-lifecycle");
    expect(chapter?.articles.map((a) => a.format.code)).toEqual(["GT"]);
    const body = chapter?.articles[0].body;
    if (body?.format !== "GT") throw new Error("expected GT");
    expect(body.data.steps).toHaveLength(8);
    // An unquoted " #" in YAML starts a comment and silently truncates the value.
    expect(body.data.steps[1].title).toBe("The application object answers #call");
  });
});
