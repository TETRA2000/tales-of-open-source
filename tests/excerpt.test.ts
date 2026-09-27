import { describe, expect, it } from "vitest";
import { githubBlobUrl, isElision, parseLineRange, verifyExcerpt } from "../src/lib/excerpt.ts";

const source = [
  "module Demo",            // 1
  "  class Thing",          // 2
  "    def call(env)",      // 3
  "      a = 1",            // 4
  "      b = 2",            // 5
  "",                       // 6
  "      a + b",            // 7
  "    end",                // 8
  "  end",                  // 9
  "end",                    // 10
].join("\n");

describe("parseLineRange", () => {
  it("parses single lines and ranges", () => {
    expect(parseLineRange("7")).toEqual({ start: 7, end: 7 });
    expect(parseLineRange("3-8")).toEqual({ start: 3, end: 8 });
  });
  it("rejects malformed or reversed ranges", () => {
    expect(() => parseLineRange("8-3")).toThrow();
    expect(() => parseLineRange("L3")).toThrow();
  });
});

describe("isElision", () => {
  it("recognises Ruby and JS markers, with or without a note", () => {
    expect(isElision("# ...")).toBe(true);
    expect(isElision("    # ... X-Cascade handling ...")).toBe(true);
    expect(isElision("// ...")).toBe(true);
    expect(isElision("# a comment")).toBe(false);
  });
});

describe("verifyExcerpt", () => {
  it("accepts an exact, dedented excerpt", () => {
    const code = "def call(env)\n  a = 1\n  b = 2\n\n  a + b\nend\n";
    expect(verifyExcerpt(source, code, { start: 3, end: 8 })).toEqual({ ok: true });
  });

  it("accepts trimmed lines marked with an elision", () => {
    const code = "def call(env)\n  # ...\n  a + b\nend";
    expect(verifyExcerpt(source, code, { start: 3, end: 8 })).toEqual({ ok: true });
  });

  it("rejects an unmarked gap", () => {
    const result = verifyExcerpt(source, "def call(env)\n  a + b\nend", { start: 3, end: 8 });
    expect(result.ok).toBe(false);
  });

  it("rejects a changed line and names both versions", () => {
    const result = verifyExcerpt(source, "def call(env)\n  a = 100\n  # ...\nend", { start: 3, end: 8 });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain('"  a = 100"');
  });

  it("rejects a range that does not end where the excerpt ends", () => {
    const result = verifyExcerpt(source, "def call(env)\n  a = 1", { start: 3, end: 8 });
    expect(result.ok).toBe(false);
  });

  it("rejects a range that starts at the wrong line", () => {
    const result = verifyExcerpt(source, "def call(env)\n  # ...\nend", { start: 4, end: 8 });
    expect(result.ok).toBe(false);
  });

  it("rejects excerpts that start or end with a marker", () => {
    expect(verifyExcerpt(source, "# ...\nend", { start: 3, end: 8 }).ok).toBe(false);
    expect(verifyExcerpt(source, "def call(env)\n# ...", { start: 3, end: 8 }).ok).toBe(false);
  });

  it("rejects a range past the end of the file", () => {
    expect(verifyExcerpt(source, "end", { start: 10, end: 12 }).ok).toBe(false);
  });
});

describe("githubBlobUrl", () => {
  it("links to the file at the pinned commit with a line anchor", () => {
    expect(githubBlobUrl("rails/rails", "abc123", "railties/lib/rails/engine.rb", { start: 532, end: 535 })).toBe(
      "https://github.com/rails/rails/blob/abc123/railties/lib/rails/engine.rb#L532-L535",
    );
    expect(githubBlobUrl("rails/rails", "abc123", "a.rb", { start: 5, end: 5 })).toBe(
      "https://github.com/rails/rails/blob/abc123/a.rb#L5",
    );
  });
});
