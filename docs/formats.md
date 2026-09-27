# Article formats

Every article shares: breadcrumb, format switcher (other formats of the same chapter), set-accent eyebrow (`<Format> · <Set>`), title, meta chips (level pips + name, reading time, `owner/repo @ SHA`, status chip), and a list of **tracked symbols** in its data (not always shown).

---

## QT · Quick Tale
- **Goal:** first mental model of a subsystem. Newcomer, 3–5 min.
- **Structure:** narrow reading column (~680px). Title + one-sentence deck → opening paragraph (drop cap in set accent) → one analogy section → **one diagram** (full-width surface band, diagram left, numbered legend right) → one "Try it" block (code + expected output + one-line explanation) → "Where this lives in the source" with one short simplified excerpt + file path → "Remember three things" recap (exactly 3) → two "keep reading" cards (Field Guide / deeper format).
- **Rules:** one analogy only; jargon introduced once; excerpt ≤ 15 lines and labelled `simplified`.

## GT · Guided Trace — interactive
- **Goal:** follow one call end to end. Practitioner, 10–15 min.
- **Structure:** header with the concrete example being traced (e.g. `GET /articles/42 → ArticlesController#show`) in an inverted panel; progress bar; left rail of N steps (number, title, symbol), right pane for the selected step: `Step k of N · <gem/package>`, title, prose, code panel (file path header + "View on GitHub at pin" link + excerpt), "Hands off to →" box naming the next call. Prev/next buttons (44px round).
- **Data per step:** `title, symbol, package, file, body, code, next`.
- **Rules:** each step = one hop across a function boundary; the `next` of step k must match the symbol of step k+1.

## SR · Source Reading
- **Goal:** read one or two functions line by line. Contributor, 25–40 min.
- **Structure:** "Before you start" prerequisite aside linking another article; numbered sections (§1, §2…). Each section: 8-col code block with line gutter; annotated lines highlighted and carry a marker (A, B, C… or 1, 2, 3…); 4-col margin notes with the same markers (title + 1–3 sentences). Ends with "Verify it yourself" — concrete breakpoints/experiments.
- **Rules:** keep real types/signatures; label removed branches ("DEV branches removed"); every marker has a note and vice versa.

## AN · Anatomy
- **Goal:** explain a core data structure. Practitioner, 8–12 min.
- **Structure:** struct card (type name header, one row per field group keyed by 2 letters) beside a legend explaining each group and holding the struct's source (collapsed, "Source at pin") → one section per configured kind, in order, each with a title, an optional body and, where the kind uses one, a source excerpt.
- **Content schema** (`src/lib/anatomy.ts`, `parseAnatomy`): the common article fields (`format: AN`, `title`, `level`, `minutes`, `pin`, `tracked_symbols`) plus:
  - `deck` — one sentence shown under the title.
  - `struct: { name, source: {file, lines, code}, groups: [{key, name, fields[], what}] }`. `source` is a required, verified excerpt.
  - `sections` — at least one, in display order. Each has `id`, `kind`, `title`, and `body` (required on `pointer-tree`/`twin-trees`, optional on `reference-grid`). A **section kind registry**, discriminated on `kind`:

    | kind | Fields besides `id`, `kind`, `title`, `body` | `source` |
    |---|---|---|
    | `pointer-tree` | `jsx` (illustrative example, not verified), `tree` (nested `{name, children?}`) | optional |
    | `twin-trees` | `nodes` (non-empty list of names) | optional |
    | `reference-grid` | `rows` (non-empty list of `{name, value, example}`) | required |

    An unknown `kind` fails to parse.
- **Checks at build time** (`parseAnatomy`, collected into one "excerpt check failed at `<pin>`" error, like Guided Trace):
  1. Every `source` — the struct's and each section's — is verified against its file at the pin (`verifyExcerpt`) and gets a GitHub blob URL.
  2. Struct fields, both ways: every field listed in a group must appear in the struct excerpt as `this.<field> =`; every such assignment in the excerpt (ignoring elided lines and `//` comments) must belong to exactly one group; a field listed in two groups is an error. Elided code (e.g. `__DEV__` blocks) is out of scope by design.
  3. Reference rows: each `reference-grid` row must match a line of its excerpt against `\b<name>\s*=\s*<value>\b`, with `name` and `value` regex-escaped (so a value is never matched by prefix).
  4. Ids: section ids are unique and none is `struct`; group keys are unique and match `^[A-Z]{2}$`.
  5. Tracked symbols: `used_in` must be `struct` or a section id that has a source, and `file` must equal that block's source file.
  6. `pointer-tree`: the tree has at least one node, and node names are non-empty; duplicate names are fine since nodes are identified by their path in the tree.
- A new section kind is one schema entry in `src/lib/anatomy.ts` plus one component in `src/components/anatomy/`.

## FG · Field Guide — interactive
- **Goal:** orient in the repository. All levels, reference.
- **Structure:** language/kind legend (colored squares); left: tree of folders/files with depth indentation, color dot, short hint; right: selected entry — kind, path, description, "Start reading at", "Talks to", "Chapters that visit here" (links, planned ones marked).
- **Data per entry:** `path, depth, kind (js|cpp|c|vendored|docs|build…), hint, what, startAt, talksTo, chapters[]`.
- **Rules:** generated skeleton from the pinned tree is fine, but descriptions are hand-written.

## RN · Revision Note
- **Goal:** tell readers (and maintainers) what changed upstream since a chapter's pin. Practitioner+, 2–4 min.
- **Structure:** maintainer actions (Re-pin chapter to main / Mark reviewed, keep pin) → inverted comparison bar (pinned SHA + date → main SHA + commits later; counts unchanged / body changed / moved / removed) → tracked-symbols table (symbol, file, status chip, used in → link to the step/section) → diff hunk for each changed symbol + "What it means for you" plain-language note + affected passage links.
- **Rules:** generated from real `git diff`; commentary is written by a human/LLM and reviewed.
