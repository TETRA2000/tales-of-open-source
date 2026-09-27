# Keeping content in step with upstream

## Idea

Each article is pinned to a commit and declares `tracked_symbols`. A checker compares each symbol between the article's pin and the target ref (usually the default branch) and classifies it:

| Status | Meaning |
|---|---|
| unchanged | Symbol body identical |
| body_changed | Symbol still exists in the same file, body differs |
| moved | Symbol found in a different file |
| removed | Symbol not found anywhere |

Any status other than `unchanged` marks the chapter **Drifted** on the set home and in the article's status chip, and produces a draft **Revision Note** (diff hunks + affected passages).

## Suggested pipeline

1. Maintain bare/partial clones of each set's repo (or reuse local checkouts, e.g. `~/repo/rails`).
2. For each article: `git fetch`, then locate each symbol at `pin` and at `target`.
   - Start simple: file + regex for `def name` / `function name` / `class Name`, with an end-of-block heuristic per language.
   - Upgrade later to tree-sitter queries per language (Ruby, JS/TS/Flow, C/C++).
3. Store results as data (e.g. `content/sets/<set>/drift.json` or a DB table), never by editing article text.
4. Code excerpts in articles should reference `{file, symbol, pin}` and optionally trimming rules, so they can be **re-extracted automatically** on re-pin; only prose needs human review.
5. Re-pin flow: update excerpts → show prose diff for review → bump `pin` and `synced_at`.
6. Run on a schedule (CI) and on demand.

## Non-goals

- Automatically rewriting prose without review.
- Fabricating diffs or SHAs for display — if data is missing, show a visible placeholder.
