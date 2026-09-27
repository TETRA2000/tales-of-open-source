# Tales of Open Source

Interactive e-book explaining how open-source applications (Ruby on Rails, React, Node.js, …) work inside — one set per application, chapters per feature, each chapter told in several formats for different reader levels, pinned to real commits and kept in step with upstream.

Status: Library home, Rails set home and the chapter 04 Guided Trace are built (Astro + Preact islands).

## Running it

Needs Node 22.12+, pnpm, and a local clone of each set's repository at `$REPOS_DIR/<name>`
(default `~/repo`, so `~/repo/rails` for `rails/rails`). Clones are only read (`git show`), never fetched or checked out;
the pinned commit must already be in the clone.

```sh
pnpm install
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
- `content/` — seed content (Rails set outline, Request lifecycle Guided Trace)
