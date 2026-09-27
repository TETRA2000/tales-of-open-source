// Makes a managed clone hold everything the content needs:
//   1. blobless clone of the upstream if the folder does not exist yet
//      (full history, file contents fetched on demand);
//   2. fetch any pinned commit that is missing;
//   3. download every quoted file at its pin, so later builds work offline;
//   4. check that the set's release tag points at the set pin.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { gitSucceeds, hasCommit, normalizeRemote, runGit } from "./git.ts";
import type { RepoSources } from "./sources.ts";

export interface SyncOptions {
  dir: string;
  url: string;
  log?: (message: string) => void;
}

export interface SyncReport {
  cloned: boolean;
  fetched: string[];
  problems: string[];
}

function gitLoud(args: string[]): void {
  execFileSync("git", args, { stdio: ["ignore", "inherit", "inherit"] });
}

export function syncRepo(sources: RepoSources, { dir, url, log = () => {} }: SyncOptions): SyncReport {
  const report: SyncReport = { cloned: false, fetched: [], problems: [] };

  if (!existsSync(dir)) {
    log(`cloning ${url} into ${dir} (blobless)`);
    mkdirSync(dirname(dir), { recursive: true });
    gitLoud(["clone", "--filter=blob:none", "--no-checkout", url, dir]);
    report.cloned = true;
  }

  let origin: string;
  try {
    origin = runGit(dir, ["remote", "get-url", "origin"]);
  } catch {
    throw new Error(`${dir} exists but is not a git clone; remove it and run pnpm repos:sync again`);
  }
  if (normalizeRemote(origin) !== normalizeRemote(url)) {
    throw new Error(`${dir} is a clone of ${origin.trim()}, expected ${url}`);
  }

  for (const [commit, files] of sources.commits) {
    if (!hasCommit(dir, commit)) {
      log(`fetching ${commit}`);
      gitLoud(["-C", dir, "fetch", "--filter=blob:none", "origin", commit]);
      report.fetched.push(commit);
      if (!hasCommit(dir, commit)) {
        report.problems.push(`${commit} could not be fetched from ${url}`);
        continue;
      }
    }
    for (const file of files) {
      // In a blobless clone this downloads the blob once; afterwards it is local.
      if (!gitSucceeds(dir, ["cat-file", "blob", `${commit}:${file}`])) {
        report.problems.push(`${file} does not exist at ${commit}`);
      }
    }
  }

  if (sources.release) {
    const { tag, commit } = sources.release;
    const ref = `refs/tags/${tag}`;
    if (!gitSucceeds(dir, ["rev-parse", "--verify", "-q", ref])) {
      log(`fetching tag ${tag}`);
      if (!gitSucceeds(dir, ["fetch", "--filter=blob:none", "origin", `${ref}:${ref}`])) {
        report.problems.push(`release tag ${tag} not found at ${url}`);
      }
    }
    if (gitSucceeds(dir, ["rev-parse", "--verify", "-q", ref])) {
      const tagged = runGit(dir, ["rev-parse", `${ref}^{commit}`]).trim();
      if (tagged !== commit) report.problems.push(`release tag ${tag} points at ${tagged}, but the set pin is ${commit}`);
    }
  }

  return report;
}
