// Clones or updates .repos/<name> for every set so the build can read each pinned
// commit, and downloads the quoted files so later builds work offline.
//   pnpm repos:sync
// With REPOS_DIR set, the clones there are someone else's: they are only checked,
// never fetched into.

import { join } from "node:path";
import { hasCommit, localCloneDir, MANAGED_REPOS_DIR, openRepo } from "../src/lib/git.ts";
import { collectSources } from "../src/lib/sources.ts";
import { syncRepo } from "../src/lib/sync.ts";

const external = process.env.REPOS_DIR;
const problems: string[] = [];

for (const sources of collectSources(join(import.meta.dirname, "../content"))) {
  for (const skipped of sources.skipped) console.warn(`skip  ${sources.repo}: placeholder pin in ${skipped}`);

  if (external) {
    try {
      const { dir } = openRepo(sources.repo);
      const missing = [...sources.commits.keys()].filter((c) => !hasCommit(dir, c));
      if (missing.length > 0) problems.push(`${dir} is missing ${missing.join(", ")}; fetch them there yourself (REPOS_DIR clones are never modified)`);
      else console.log(`ok    ${sources.repo} → ${dir} (REPOS_DIR, read-only)`);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
    continue;
  }

  const dir = localCloneDir(sources.repo, MANAGED_REPOS_DIR);
  try {
    const report = syncRepo(sources, {
      dir,
      url: `https://github.com/${sources.repo}.git`,
      log: (m) => console.log(`      ${m}`),
    });
    problems.push(...report.problems.map((p) => `${sources.repo}: ${p}`));
    if (report.problems.length === 0) {
      console.log(`ok    ${sources.repo} → ${dir} (${sources.commits.size} pinned commit${sources.commits.size === 1 ? "" : "s"})`);
    }
  } catch (error) {
    problems.push(`${sources.repo}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.map((p) => `error ${p}`).join("\n")}`);
  process.exit(1);
}
