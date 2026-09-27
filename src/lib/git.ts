// Read access to local clones of each set's upstream repository.
//
// By default the clones live in .repos/<name> inside this project and are created
// and updated by `pnpm repos:sync` (blobless clones, see src/lib/sync.ts). Setting
// REPOS_DIR points the build at other clones instead, such as an existing ~/repo/rails;
// those are only read here: `git show`, `git cat-file` and `git remote get-url`.

import { execFileSync } from "node:child_process";
import { join } from "node:path";

export type ReadAtCommit = (commit: string, file: string) => string;

export interface RepoReader {
  dir: string;
  readAtCommit: ReadAtCommit;
}

export function runGit(dir: string, args: string[], env?: Record<string, string>): string {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    env: env && { ...process.env, ...env },
  });
}

export function gitSucceeds(dir: string, args: string[], env?: Record<string, string>): boolean {
  try {
    runGit(dir, args, env);
    return true;
  } catch {
    return false;
  }
}

/** Whether the commit is in the clone itself; a partial clone must not fetch it to answer. */
export function hasCommit(dir: string, commit: string): boolean {
  return gitSucceeds(dir, ["cat-file", "-e", `${commit}^{commit}`], { GIT_NO_LAZY_FETCH: "1" });
}

/** The project's own clone folder, managed by `pnpm repos:sync`. */
export const MANAGED_REPOS_DIR = join(process.cwd(), ".repos");

/** Where the clones are read from: $REPOS_DIR if set, else .repos/ in this project. */
export function reposDir(): string {
  return process.env.REPOS_DIR ?? MANAGED_REPOS_DIR;
}

/** Local clone of `owner/name`: <reposDir>/<name>. */
export function localCloneDir(repo: string, dir = reposDir()): string {
  const name = repo.split("/")[1];
  if (!name) throw new Error(`Expected "owner/name", got "${repo}"`);
  return join(dir, name);
}

export function normalizeRemote(url: string): string {
  return url.trim().replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
}

export function openRepo(repo: string, dir = localCloneDir(repo)): RepoReader {
  let origin: string;
  try {
    origin = runGit(dir, ["remote", "get-url", "origin"]);
  } catch {
    throw new Error(`No git clone of ${repo} at ${dir}. Run pnpm repos:sync (or set REPOS_DIR to where your clones are).`);
  }
  if (normalizeRemote(origin) !== `https://github.com/${repo}`) {
    throw new Error(`${dir} is a clone of ${origin.trim()}, expected github.com/${repo}`);
  }

  return {
    dir,
    readAtCommit(commit, file) {
      try {
        return runGit(dir, ["show", `${commit}:${file}`]);
      } catch (error) {
        throw new Error(
          hasCommit(dir, commit)
            ? `${file} does not exist in ${repo} at ${commit}`
            : `Commit ${commit} is not in ${dir}; run pnpm repos:sync`,
          { cause: error },
        );
      }
    },
  };
}
