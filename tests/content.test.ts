import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLibrary } from "../src/lib/content.ts";
import type { RepoReader } from "../src/lib/git.ts";
import { tempDir } from "./temp-dir.ts";

const FIXTURE = join(import.meta.dirname, "fixtures/content");
const PIN = "1111111111111111111111111111111111111111";
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

function fakeRepo(files: Record<string, string> = { "lib/demo.rb": DEMO_RB }): (repo: string) => RepoReader {
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

function copyFixture(): string {
  const dir = tempDir("content");
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

const TRACE = "sets/demo/chapters/02-call/guided-trace.yaml";

describe("loadLibrary", () => {
  const { sets } = loadLibrary({ contentDir: FIXTURE, openRepo: fakeRepo() });
  const [demo] = sets;

  it("loads sets, parts and chapters from set.yaml", () => {
    expect(sets.map((s) => s.id)).toEqual(["demo"]);
    expect(demo.pin).toEqual({ commit: PIN, release: "v1.0.0", syncedAt: "2026-01-01" });
    expect(demo.parts[0].chapters.map((c) => [c.num, c.title])).toEqual([
      ["01", "The map"],
      ["02", "The call"],
    ]);
  });

  it("discovers articles from the chapter folder, not from the outline", () => {
    const [map, call] = demo.chapters;
    expect(map.articles).toEqual([]);
    expect(map.status).toBe("planned");
    expect(map.href).toBeNull();
    expect(map.plannedFormats).toEqual(["FG"]);
    expect(call.articles.map((a) => a.format.code)).toEqual(["GT"]);
    expect(call.status).toBe("up_to_date");
    expect(call.href).toBe("/demo/02-call/guided-trace/");
  });

  it("defaults the article pin to the set pin and builds GitHub links from it", () => {
    const article = demo.chapters[1].articles[0];
    expect(article.pin).toBe(PIN);
    if (article.body.format !== "GT") throw new Error("expected GT");
    expect(article.body.data.steps[0].lines).toEqual({ start: 3, end: 8 });
    expect(article.body.data.steps[0].url).toBe(`https://github.com/example/demo/blob/${PIN}/lib/demo.rb#L3-L8`);
  });

  it("counts tracked symbols across the set", () => {
    expect(demo.trackedSymbolCount).toBe(1);
  });

  it("fails the build when an excerpt does not match the pinned source", () => {
    const changed = DEMO_RB.replace("a = 1", "a = 10");
    expect(() => loadLibrary({ contentDir: FIXTURE, openRepo: fakeRepo({ "lib/demo.rb": changed }) })).toThrow(
      /step-1 \(lib\/demo\.rb:3-8\).*does not match source line 4/s,
    );
  });

  it("fails when a quoted file is missing at the pin", () => {
    expect(() => loadLibrary({ contentDir: FIXTURE, openRepo: fakeRepo({}) })).toThrow(/lib\/demo\.rb does not exist/);
  });

  it("rejects placeholder pins", () => {
    const dir = copyFixture();
    const file = join(dir, TRACE);
    writeFileSync(file, readFileSync(file, "utf8").replace("minutes: 5", 'minutes: 5\npin: "[SHA]"'));
    expect(() => loadLibrary({ contentDir: dir, openRepo: fakeRepo() })).toThrow(/pin: must be a full 40-character commit SHA/);
  });

  it("rejects an article whose format does not match its file name", () => {
    const dir = copyFixture();
    const file = join(dir, TRACE);
    writeFileSync(file, readFileSync(file, "utf8").replace("format: GT", "format: QT"));
    expect(() => loadLibrary({ contentDir: dir, openRepo: fakeRepo() })).toThrow(/file name says GT/);
  });

  it("rejects tracked symbols that point at a missing step", () => {
    const dir = copyFixture();
    const file = join(dir, TRACE);
    writeFileSync(file, readFileSync(file, "utf8").replace("used_in: step-1", "used_in: step-9"));
    expect(() => loadLibrary({ contentDir: dir, openRepo: fakeRepo() })).toThrow(/not a step/);
  });
});
