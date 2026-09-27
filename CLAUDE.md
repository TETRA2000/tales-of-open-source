# Tales of Open Source

An interactive online e-book that explains **how existing open-source applications work inside** — logic flows, data structures, file structures — not how to use them.

Design prototype (private, owner only): https://claude.ai/artifact/XwnrZWggVPCTzHmPXKMwse
Design sources copied into `design/canvas/` (see `design/README.md`).

## Product requirements

1. **Explain, never tutor.** Every article describes the real code of a real repository: call paths, types/structs, directory layout. No "how to build an app with X" content.
2. **Updatable with upstream code.** Every article is written against a pinned commit and lists the symbols (files, classes, functions) it quotes. When those symbols change upstream, the article is flagged as drifted and a Revision Note can be produced. See `docs/sync-and-drift.md`.
3. **Extensible.** New sets (applications), new chapters (features/subsystems) and new formats of an existing chapter must be addable without touching existing content.
4. **Multiple audiences.** The same chapter can be told in several formats aimed at different reader levels.

## Content model

```
Library
└── Set            one application / repository (e.g. "Ruby on Rails, in depth")
    ├── pin        repo, commit SHA, release, last-synced date
    ├── paths      reading paths per reader level
    └── Part       grouping of chapters (Boot, Request, Active Record…)
        └── Chapter   one feature or subsystem (e.g. "Request lifecycle")
            └── Article  the chapter told in ONE format
```

Full schema and an example: `docs/content-model.md`, seed data in `content/`.

### Reader levels

| Level | Pips | Who |
|---|---|---|
| Newcomer | ●○○ | Knows a programming language; has never opened this repo |
| Practitioner | ●●○ | Uses the framework daily; wants to know what happens underneath |
| Contributor | ●●● | Reads the source line by line, may send a PR |

### Article formats (details in `docs/formats.md`)

| Code | Format | Length | Level | Sample artboard |
|---|---|---|---|---|
| QT | Quick Tale | 3–5 min | Newcomer | `QuickTale.dc.html` (Node.js event loop) |
| GT | Guided Trace | 10–15 min | Practitioner | `GuidedTrace.dc.html` (Rails request) — interactive |
| SR | Source Reading | 25–40 min | Contributor | `SourceReading.dc.html` (React setState) |
| AN | Anatomy | 8–12 min | Practitioner | `Anatomy.dc.html` (React Fiber) |
| FG | Field Guide | reference | All | `FieldGuide.dc.html` (Node.js repo map) — interactive |
| RN | Revision Note | 2–4 min | Practitioner+ | `RevisionNote.dc.html` (Rails drift report) |

New formats may be added; register them in the format registry rather than special-casing pages.

## Screens in the prototype

- `Main.dc.html` — Library home: shelf of set covers + "next set" slot + structure explainer.
- `SetHome.dc.html` — Set home: title, source-of-truth panel (repo, pin, release, synced, tracked symbols, drift alert), three reading paths, contents table (parts → chapters, format chips QT/GT/SR/AN/FG/RN, status Up to date / Drifted / Planned).
- One artboard per format (above). Shared chrome: top bar with breadcrumb `Library / Set / Part · Chapter` and a format switcher for the chapter; metadata chips (level, reading time, `repo @ SHA`, status).

## Visual design

Dark slate theme — never pure black; cream "inverted" panels and bright per-set accents provide contrast. Tokens in `design/tokens.json` / `design/tokens.css`.

- Fonts (Google Fonts): **Bricolage Grotesque** (headings/display), **IBM Plex Sans** (body/UI), **IBM Plex Mono** (code, paths, SHAs).
- Background `#222838`, surface `#2C3346`, card `#2E3549`, code bg `#1B2030`, rule `#3D4660`.
- Text `#EEE9DF`, secondary `#D3D0CA`, muted `#A9AFC2`.
- Inverted panel: bg `#EEE9DF`, text `#222838`, muted `#565C70`.
- Set accents: Rails coral `#F28B6D`, React cyan `#6CC8D6`, Node.js lime `#AAD56F` (dark text `#2E3549` on accent fills).
- Status: Up to date = cyan fill; Drifted = `#A2481F` fill + light text; Planned = dashed outline.
- Code highlight row: `rgba(108,200,214,0.16)` + 3px left inset in cyan; diff add `#26455A`, remove `#4D302E`.
- Rules: real `<button>`/`<a>` elements, 44px touch targets, text contrast ≥ 4.5:1, no emoji, no gradients.

## Accuracy rules for content (important)

- Code excerpts must come from the **pinned commit** of the set's repo. Mark trimmed excerpts ("excerpt", "simplified", "DEV branches removed") and use `# ...` / `// ...` for elided lines.
- Never invent commit SHAs, dates, line numbers, counts or diffs. Placeholders in the prototype look like `[SHA]`, `[DATE]`, `[n]` — fill them from git, or leave them visibly unfilled.
- The excerpts in the prototype were written from memory of upstream code; **verify each one against the pinned commit before publishing.**
- Upstream code is read from blobless clones in `.repos/<name>` (gitignored), created and updated by `pnpm repos:sync` from the pins in `content/`. Never vendor or submodule upstream repos into this repo. The user's own checkouts (`~/repo/rails`, …) may be used read-only via `REPOS_DIR`; never fetch into or modify them.

## Open decisions (yours to make)

- Stack / framework: not chosen. Needs static-friendly content files, interactive islands (Guided Trace stepper, Field Guide tree), and a build step that can read git.
- Where content lives (MDX/Markdown + YAML frontmatter vs. a DB), hosting, search.
- Whether drift detection runs in CI (scheduled) or as a local CLI.

## Suggested first milestones

1. Scaffold the app; implement tokens and shared chrome (top bar, breadcrumb, format switcher, meta chips).
2. Content loader for `content/sets/**` following `docs/content-model.md`.
3. Library home + Set home from data.
4. Guided Trace format end-to-end using `content/sets/rails/chapters/04-request-lifecycle/guided-trace.yaml`, with code excerpts verified against a pinned Rails commit.
5. Remaining formats; then the drift checker (`docs/sync-and-drift.md`) and Revision Note generation.
