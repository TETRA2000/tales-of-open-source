import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLibrary } from "../src/lib/content.ts";
import { localCloneDir } from "../src/lib/git.ts";

// Runs against the real content and the real local clone at the pin, when the clone is present.
describe.skipIf(!existsSync(localCloneDir("facebook/react")))("real React content", () => {
  it("the React set is pinned to the v19.3.0 commit", () => {
    const { sets } = loadLibrary({ contentDir: join(import.meta.dirname, "../content") });
    const react = sets.find((s) => s.id === "react");
    expect(react?.repo).toBe("facebook/react");
    expect(react?.pin).toEqual({ commit: "1d34f91dfde6bba84d08b683aaba164c7194dacb", release: "v19.3.0", syncedAt: "2026-09-27" });
    expect(react?.parts.map((p) => p.title)).toEqual(["Elements", "Fiber", "Hooks", "Scheduling", "Commit"]);
  });

  it("every React chapter that lists GT has a Guided Trace", () => {
    const { sets } = loadLibrary({ contentDir: join(import.meta.dirname, "../content") });
    const react = sets.find((s) => s.id === "react");
    const listed = react?.chapters.filter((c) => c.plannedFormats.includes("GT")) ?? [];
    expect(listed.map((c) => c.id)).toEqual([
      "03-first-render",
      "05-work-loop",
      "06-reconciling-children",
      "07-use-state",
      "08-use-effect",
      "10-scheduler",
      "11-commit",
    ]);
    for (const chapter of listed) {
      expect(chapter.articles.map((a) => a.format.code), chapter.id).toContain("GT");
    }
  });

  it("04 · Anatomy of a Fiber loads against the pin", () => {
    const { sets } = loadLibrary({ contentDir: join(import.meta.dirname, "../content") });
    const chapter = sets.find((s) => s.id === "react")?.chapters.find((c) => c.id === "04-fiber-node");
    const article = chapter?.articles.find((a) => a.format.code === "AN");
    expect(article?.format.code).toBe("AN");
    if (article?.body.format !== "AN") throw new Error("04-fiber-node has no Anatomy body");
    const { struct, sections } = article.body.data;
    expect(struct.groups.map((g) => g.key)).toEqual(["ID", "TR", "IN", "EF", "LN", "MD", "AL"]);
    expect(sections.map((s) => s.kind)).toEqual(["pointer-tree", "twin-trees", "reference-grid"]);
    expect(struct.source.url.endsWith("packages/react-reconciler/src/ReactFiber.js#L134-L207")).toBe(true);
  });
});
