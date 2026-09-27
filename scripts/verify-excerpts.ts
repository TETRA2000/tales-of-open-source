// Checks every code excerpt in content/ against its file at the article's pin,
// using the read-only local clones (REPOS_DIR, default ~/repo).
//   pnpm verify

import { join } from "node:path";
import { loadLibrary, shortSha } from "../src/lib/content.ts";

try {
  const { sets } = loadLibrary({ contentDir: join(import.meta.dirname, "../content") });
  for (const set of sets) {
    console.log(`${set.repo} @ ${shortSha(set.pin.commit)} (${set.pin.release})`);
    for (const chapter of set.chapters) {
      for (const article of chapter.articles) {
        console.log(`  ${chapter.id} · ${article.format.name} @ ${shortSha(article.pin)}`);
        if (article.body.format === "GT") {
          for (const step of article.body.data.steps) {
            console.log(`    ok  ${step.id}  ${step.file}:${step.lines.start}-${step.lines.end}`);
          }
        }
      }
    }
  }
  console.log("All excerpts match their pinned source.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
