// What each set needs from its upstream repository: the pinned commits (set pin
// plus any article pins) and the files quoted at each of them. Read straight from
// the YAML without verifying anything, so it works before the clones exist.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface RepoSources {
  repo: string;
  release?: { tag: string; commit: string };
  /** Pinned commit → files quoted at that commit. */
  commits: Map<string, Set<string>>;
  /** Pins that are not full SHAs yet (placeholders), with where they were found. */
  skipped: string[];
}

const SHA = /^[0-9a-f]{40}$/;

type Yaml = Record<string, unknown>;

function readYaml(file: string): Yaml {
  const data = parseYaml(readFileSync(file, "utf8"));
  return data && typeof data === "object" ? (data as Yaml) : {};
}

function quotedFiles(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) quotedFiles(item, into);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "file" && typeof child === "string") into.add(child);
      else quotedFiles(child, into);
    }
  }
}

export function collectSources(contentDir: string): RepoSources[] {
  const setsDir = join(contentDir, "sets");
  const byRepo = new Map<string, RepoSources>();

  for (const entry of readdirSync(setsDir, { withFileTypes: true })) {
    const setFile = join(setsDir, entry.name, "set.yaml");
    if (!entry.isDirectory() || !existsSync(setFile)) continue;

    const set = readYaml(setFile);
    const repo = String(set.repo ?? "");
    const pin = (set.pin ?? {}) as Yaml;
    const setPin = String(pin.commit ?? "");
    const sources: RepoSources = byRepo.get(repo) ?? { repo, commits: new Map(), skipped: [] };
    byRepo.set(repo, sources);

    const add = (commit: string, where: string, files: Set<string> = new Set()) => {
      if (!SHA.test(commit)) {
        sources.skipped.push(`${where}: "${commit}"`);
        return;
      }
      const existing = sources.commits.get(commit) ?? new Set();
      for (const f of files) existing.add(f);
      sources.commits.set(commit, existing);
    };

    add(setPin, setFile);
    if (typeof pin.release === "string" && SHA.test(setPin)) {
      sources.release = { tag: pin.release, commit: setPin };
    }

    const chaptersDir = join(setsDir, entry.name, "chapters");
    if (!existsSync(chaptersDir)) continue;
    for (const chapter of readdirSync(chaptersDir, { withFileTypes: true })) {
      if (!chapter.isDirectory()) continue;
      for (const name of readdirSync(join(chaptersDir, chapter.name))) {
        if (!/\.ya?ml$/.test(name) || /^chapter\.ya?ml$/.test(name)) continue;
        const file = join(chaptersDir, chapter.name, name);
        const article = readYaml(file);
        const files = new Set<string>();
        quotedFiles(article, files);
        add(typeof article.pin === "string" ? article.pin : setPin, file, files);
      }
    }
  }

  return [...byRepo.values()];
}
