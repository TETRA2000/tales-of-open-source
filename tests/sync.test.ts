import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { hasCommit, runGit } from "../src/lib/git.ts";
import { collectSources, type RepoSources } from "../src/lib/sources.ts";
import { syncRepo } from "../src/lib/sync.ts";
import { tempDir } from "./temp-dir.ts";

const FIXTURE = join(import.meta.dirname, "fixtures/content");

describe("collectSources", () => {
  it("collects the set pin, release and quoted files per repo", () => {
    const [demo] = collectSources(FIXTURE);
    expect(demo.repo).toBe("example/demo");
    expect(demo.release).toEqual({ tag: "v1.0.0", commit: "1111111111111111111111111111111111111111" });
    expect([...demo.commits.entries()].map(([c, files]) => [c, [...files]])).toEqual([
      ["1111111111111111111111111111111111111111", ["lib/demo.rb"]],
    ]);
    expect(demo.skipped).toEqual([]);
  });
});

// A throwaway upstream served over file:// so partial clone and fetch-by-SHA behave like GitHub.
describe("syncRepo", () => {
  let upstream: string;
  let url: string;
  let first: string;
  let second: string;

  const git = (dir: string, ...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();

  beforeAll(() => {
    upstream = tempDir("upstream");
    git(upstream, "init", "-q", "-b", "main");
    git(upstream, "config", "user.email", "test@example.com");
    git(upstream, "config", "user.name", "Test");
    git(upstream, "config", "uploadpack.allowFilter", "true");
    git(upstream, "config", "uploadpack.allowAnySHA1InWant", "true");
    writeFileSync(join(upstream, "a.rb"), "def a\nend\n");
    git(upstream, "add", ".");
    git(upstream, "commit", "-q", "-m", "one");
    first = git(upstream, "rev-parse", "HEAD");
    git(upstream, "tag", "v1.0.0");
    writeFileSync(join(upstream, "b.rb"), "def b\nend\n");
    git(upstream, "add", ".");
    git(upstream, "commit", "-q", "-m", "two");
    second = git(upstream, "rev-parse", "HEAD");
    url = `file://${upstream}`;
  });

  const sources = (commits: Record<string, string[]>, release?: RepoSources["release"]): RepoSources => ({
    repo: "example/demo",
    release,
    commits: new Map(Object.entries(commits).map(([c, files]) => [c, new Set(files)])),
    skipped: [],
  });

  it("makes a blobless clone that can read every quoted file at its pin", () => {
    const dir = join(tempDir("repos"), "demo");
    const report = syncRepo(sources({ [first]: ["a.rb"], [second]: ["b.rb"] }, { tag: "v1.0.0", commit: first }), { dir, url });
    expect(report).toEqual({ cloned: true, fetched: [], problems: [] });
    expect(runGit(dir, ["config", "remote.origin.partialclonefilter"]).trim()).toBe("blob:none");
    expect(runGit(dir, ["show", `${second}:b.rb`])).toBe("def b\nend\n");
  });

  it("is a no-op when everything is already there", () => {
    const dir = join(tempDir("repos"), "demo");
    syncRepo(sources({ [first]: ["a.rb"] }), { dir, url });
    expect(syncRepo(sources({ [first]: ["a.rb"] }), { dir, url })).toEqual({ cloned: false, fetched: [], problems: [] });
  });

  it("fetches a pinned commit the clone does not have yet", () => {
    const dir = join(tempDir("repos"), "demo");
    syncRepo(sources({ [first]: [] }), { dir, url });
    writeFileSync(join(upstream, "c.rb"), "def c\nend\n");
    git(upstream, "add", ".");
    git(upstream, "commit", "-q", "-m", "three");
    const third = git(upstream, "rev-parse", "HEAD");
    expect(hasCommit(dir, third)).toBe(false);

    const report = syncRepo(sources({ [third]: ["c.rb"] }), { dir, url });
    expect(report.fetched).toEqual([third]);
    expect(report.problems).toEqual([]);
    expect(hasCommit(dir, third)).toBe(true);
  });

  it("reports missing files and a release tag that points elsewhere", () => {
    const dir = join(tempDir("repos"), "demo");
    const report = syncRepo(sources({ [second]: ["nope.rb"] }, { tag: "v1.0.0", commit: second }), { dir, url });
    expect(report.problems).toEqual([
      `nope.rb does not exist at ${second}`,
      `release tag v1.0.0 points at ${first}, but the set pin is ${second}`,
    ]);
  });

  it("refuses a folder that is a clone of something else", () => {
    const dir = join(tempDir("repos"), "demo");
    syncRepo(sources({}), { dir, url });
    expect(() => syncRepo(sources({}), { dir, url: "https://github.com/example/other.git" })).toThrow(/expected https:\/\/github.com\/example\/other/);
  });
});
