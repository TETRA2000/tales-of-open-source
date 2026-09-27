import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cpSync } from "node:fs";
import { stringify } from "yaml";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { assignedFields, parseAnatomy, type AnatomyBody, type AnatomySection } from "../src/lib/anatomy.ts";
import { loadLibrary, type ArticleContext } from "../src/lib/content.ts";
import type { RepoReader } from "../src/lib/git.ts";
import { tempDir } from "./temp-dir.ts";

const FIXTURE = join(import.meta.dirname, "fixtures/content");
const PIN = "1111111111111111111111111111111111111111";

// Matches the fixture repo used by tests/content.test.ts, so that the
// loadLibrary integration test's chapter still parses its existing GT article.
const DEMO_RB = [
  "module Demo",
  "  class Thing",
  "    def call(env)",
  "      a = 1",
  "      b = 2",
  "",
  "      a + b",
  "    end",
  "  end",
  "end",
].join("\n");

const THING_JS = [
  "function Thing(tag, key) {",
  "  // Identity",
  "  this.tag = tag;",
  "  this.key = key;",
  "",
  "  // Links",
  "  this.next = null;",
  "",
  "  if (__DEV__) {",
  "    this._debug = null;",
  "  }",
  "}",
  "",
  "export const Alpha = 0;",
  "export const Beta = 10;",
  "export const Gamma = 1;",
].join("\n");

const STRUCT_CODE = [
  "function Thing(tag, key) {",
  "  // Identity",
  "  this.tag = tag;",
  "  this.key = key;",
  "",
  "  // Links",
  "  this.next = null;",
  "",
  "  // ...",
  "}",
].join("\n");

const GRID_CODE = ["export const Alpha = 0;", "export const Beta = 10;", "export const Gamma = 1;"].join("\n");

function fakeRepo(files: Record<string, string>): (repo: string) => RepoReader {
  return () => ({
    dir: "/fake",
    readAtCommit(commit, file) {
      if (commit !== PIN) throw new Error(`unexpected commit ${commit}`);
      const text = files[file];
      if (text === undefined) throw new Error(`${file} does not exist`);
      return text;
    },
  });
}

const ctx: ArticleContext = { repo: "example/demo", pin: PIN, reader: fakeRepo({ "lib/thing.js": THING_JS })("example/demo") };

// Plain JSON-shaped data, so structuredClone works for every test's variant.
const VALID = {
  deck: "One struct, told three ways.",
  struct: {
    name: "Thing",
    source: { file: "lib/thing.js", lines: "1-12", code: STRUCT_CODE },
    groups: [
      { key: "ID", name: "Identity", fields: ["tag", "key"], what: "What this is." },
      { key: "LK", name: "Links", fields: ["next"], what: "Tree links." },
    ],
  },
  sections: [
    {
      id: "tree-links",
      kind: "pointer-tree",
      title: "Pointers make a tree",
      body: "A fiber points only to its first child.",
      jsx: "<App><Child /></App>",
      tree: { name: "App", children: [{ name: "Child" }] },
      source: null,
    },
    {
      id: "twins",
      kind: "twin-trees",
      title: "Two trees",
      body: "One on screen, one being built.",
      nodes: ["App", "Child"],
    },
    {
      id: "tags",
      kind: "reference-grid",
      title: "Tags you will meet first",
      body: "A handful of constants.",
      source: { file: "lib/thing.js", lines: "14-16", code: GRID_CODE },
      rows: [
        { name: "Alpha", value: "0", example: "const a = Alpha" },
        { name: "Gamma", value: "1", example: "const g = Gamma" },
      ],
    },
  ],
  tracked_symbols: [{ symbol: "Thing", file: "lib/thing.js", used_in: "struct" }],
};

function grid(body: typeof VALID) {
  return body.sections.find((s) => s.id === "tags") as (typeof VALID)["sections"][number] & { rows: { name: string; value: string; example: string }[] };
}

describe("parseAnatomy", () => {
  it("parses a valid anatomy", () => {
    const result: AnatomyBody = parseAnatomy(structuredClone(VALID), ctx);
    expect(result.struct.groups).toHaveLength(2);
    expect(result.sections).toHaveLength(3);
    expect(result.struct.source.url).toMatch(/lib\/thing\.js#L1-L12$/);
    const tree = result.sections.find((s) => s.kind === "pointer-tree");
    expect(tree?.source).toBeNull();
  });

  it("rejects an excerpt that does not match the pin", () => {
    const bad = structuredClone(VALID);
    bad.struct.source.code = bad.struct.source.code.replace("this.key = key;", "this.key = null;");
    expect(() => parseAnatomy(bad, ctx)).toThrow(/struct \(lib\/thing\.js:1-12\)/);
  });

  it("rejects a group field that is not assigned", () => {
    const bad = structuredClone(VALID);
    bad.struct.groups[0].fields.push("ref");
    expect(() => parseAnatomy(bad, ctx)).toThrow(/struct: field "ref" is not assigned in the excerpt/);
  });

  it("rejects an assignment that is in no group", () => {
    const bad = structuredClone(VALID);
    bad.struct.groups = bad.struct.groups.filter((g) => g.key !== "LK");
    expect(() => parseAnatomy(bad, ctx)).toThrow(/"this\.next" is assigned in the excerpt but is in no group/);
  });

  it("rejects a field in two groups", () => {
    const bad = structuredClone(VALID);
    bad.struct.groups[1].fields.push("tag");
    expect(() => parseAnatomy(bad, ctx)).toThrow(/field "tag" is in more than one group/);
  });

  it("rejects a reference row that is not in the excerpt", () => {
    const bad = structuredClone(VALID);
    grid(bad).rows.push({ name: "Delta", value: "2", example: "x" });
    expect(() => parseAnatomy(bad, ctx)).toThrow(/row Delta = 2 is not in the excerpt/);
  });

  it("rejects duplicate section ids and group keys", () => {
    const bad = structuredClone(VALID);
    bad.sections[1].id = bad.sections[0].id;
    bad.struct.groups[1].key = "ID";
    expect(() => parseAnatomy(bad, ctx)).toThrow(/section ids must be unique/);
    expect(() => parseAnatomy(bad, ctx)).toThrow(/group keys must be unique/);
  });

  it("rejects an unknown section kind", () => {
    const bad = structuredClone(VALID) as unknown as Record<string, unknown>;
    (bad.sections as Array<Record<string, unknown>>)[0].kind = "bitmask";
    try {
      parseAnatomy(bad, ctx);
      expect.fail("expected parseAnatomy to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
      expect(String(error)).toMatch(/kind/i);
    }
  });

  it("rejects a used_in that points nowhere", () => {
    const bad = structuredClone(VALID);
    // "twins" is a real section id but has no source, so it cannot be named.
    bad.tracked_symbols = [{ symbol: "Thing", file: "lib/thing.js", used_in: "twins" }];
    expect(() => parseAnatomy(bad, ctx)).toThrow(
      /tracked symbol Thing is used_in "twins", which is not struct or a section with a source/,
    );
  });

  it("rejects a used_in whose file does not match", () => {
    const bad = structuredClone(VALID);
    bad.tracked_symbols = [{ symbol: "Thing", file: "lib/other.js", used_in: "struct" }];
    expect(() => parseAnatomy(bad, ctx)).toThrow(
      /tracked symbol Thing: file lib\/other\.js does not match struct's file lib\/thing\.js/,
    );
  });

  // Review Focus tests.
  it("ignores comparisons when collecting assignments", () => {
    expect(assignedFields("if (this.tag === 1) {}\nthis.key = 1;")).toEqual(["key"]);
  });

  it("ignores assignments inside // comments", () => {
    expect(assignedFields("// this.old = null;\nthis.key = 1;")).toEqual(["key"]);
  });

  it("does not match a reference value by prefix", () => {
    const bad = structuredClone(VALID);
    grid(bad).rows = [{ name: "Beta", value: "1", example: "x" }];
    expect(() => parseAnatomy(bad, ctx)).toThrow(/row Beta = 1 is not in the excerpt/);
  });

  it("coerces unquoted reference values to strings", () => {
    const good = structuredClone(VALID) as unknown as Record<string, unknown>;
    (grid(good as unknown as typeof VALID) as unknown as { rows: unknown[] }).rows = [{ name: "Alpha", value: 0, example: "x" }];
    const result = parseAnatomy(good, ctx);
    const section = result.sections.find((s): s is AnatomySection & { kind: "reference-grid" } => s.kind === "reference-grid");
    expect(section?.rows[0].value).toBe("0");
  });

  it("counts a field assigned twice once", () => {
    expect(assignedFields("this.tag = a;\nthis.tag = b;")).toEqual(["tag"]);
  });
});

describe("loadLibrary with an Anatomy article", () => {
  it("picks up anatomy.yaml", () => {
    const dir = tempDir("anatomy-content");
    cpSync(FIXTURE, dir, { recursive: true });
    const articleRaw = {
      format: "AN",
      title: "Thing anatomy",
      level: "practitioner",
      minutes: 10,
      ...structuredClone(VALID),
    };
    writeFileSync(join(dir, "sets/demo/chapters/02-call/anatomy.yaml"), stringify(articleRaw));

    const { sets } = loadLibrary({
      contentDir: dir,
      openRepo: fakeRepo({ "lib/thing.js": THING_JS, "lib/demo.rb": DEMO_RB }),
    });
    const chapter = sets[0].chapters[1];
    expect(chapter.articles.map((a) => a.format.code)).toEqual(["GT", "AN"]);
    const anatomy = chapter.articles.find((a) => a.format.code === "AN");
    expect(anatomy?.href).toBe("/demo/02-call/anatomy/");
  });
});
