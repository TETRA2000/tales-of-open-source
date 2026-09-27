// Read-only access to local clones of each set's upstream repository.
// Only `git show`, `git cat-file` and `git remote get-url` are used: nothing
// here fetches, checks out or writes, so a user's own checkout is safe to use.

import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export type ReadAtCommit = (commit: string, file: string) => string;

export interface RepoReader {
  dir: string;
  readAtCommit: ReadAtCommit;
}

function git(dir: string, args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Local clone of `owner/name`: $REPOS_DIR/<name>, where REPOS_DIR defaults to ~/repo. */
export function localCloneDir(repo: string, reposDir = process.env.REPOS_DIR ?? join(homedir(), "repo")): string {
  const name = repo.split("/")[1];
  if (!name) throw new Error(`Expected "owner/name", got "${repo}"`);
  return join(reposDir, name);
}

export function openRepo(repo: string, dir = localCloneDir(repo)): RepoReader {
  let origin: string;
  try {
    origin = git(dir, ["remote", "get-url", "origin"]).trim();
  } catch {
    throw new Error(`No git clone of ${repo} at ${dir}. Clone it there or set REPOS_DIR.`);
  }
  const normalized = origin.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
  if (normalized !== `https://github.com/${repo}`) {
    throw new Error(`${dir} is a clone of ${origin}, expected github.com/${repo}`);
  }

  return {
    dir,
    readAtCommit(commit, file) {
      try {
        return git(dir, ["show", `${commit}:${file}`]);
      } catch (error) {
        const hasCommit = (() => {
          try {
            git(dir, ["cat-file", "-e", `${commit}^{commit}`]);
            return true;
          } catch {
            return false;
          }
        })();
        throw new Error(
          hasCommit
            ? `${file} does not exist in ${repo} at ${commit}`
            : `Commit ${commit} is not in ${dir}; fetch it there first`,
          { cause: error },
        );
      }
    },
  };
}
