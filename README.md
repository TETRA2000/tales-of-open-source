# Tales of Open Source

Interactive e-book explaining how open-source applications (Ruby on Rails, React, Node.js, …) work inside — one set per application, chapters per feature, each chapter told in several formats for different reader levels, pinned to real commits and kept in step with upstream.

Status: Library home, Rails set home and seven Rails Guided Traces (chapters 02, 04, 05, 07, 10, 11, 12) are built (Astro + Preact islands).

## Running it

Needs Node 22.12+, pnpm and a recent git (tested with 2.55). The upstream repositories are not stored in this repo:
`pnpm repos:sync` makes blobless clones of them in `.repos/<name>` (gitignored), fetches every commit pinned
in `content/`, downloads the quoted files so builds then work offline, and checks each set's release tag
points at its pin. `pnpm build` runs it first; it is a no-op when nothing changed.

To build from clones you already have instead, set `REPOS_DIR` (e.g. `REPOS_DIR=~/repo` for `~/repo/rails`).
Those clones are only read, never fetched into; sync just checks they contain the pinned commits.

```sh
pnpm install
pnpm repos:sync   # first time, and after changing a pin
pnpm dev          # http://localhost:4321
pnpm build        # static site in dist/; fails if any excerpt does not match its pinned source
pnpm verify       # check every excerpt against its pin and print the line ranges
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # browser tests (Playwright)
pnpm check        # type check
```

- `CLAUDE.md` — brief, requirements, design system, accuracy rules, first milestones (start here)
- `docs/formats.md` — the six article formats
- `docs/content-model.md` — Library → Set → Part → Chapter → Article schema
- `docs/sync-and-drift.md` — how articles stay current with upstream code
- `design/` — tokens and the prototype artboards
- `content/` — Rails set outline and its Guided Traces
