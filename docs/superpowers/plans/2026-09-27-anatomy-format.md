# Anatomy Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Anatomy (AN) article format and its first article, React 04 · Anatomy of a Fiber. Every excerpt, struct field and reference row on the page is checked against the React pin at build time.

**Architecture:**
- `src/lib/anatomy.ts` parses and checks `anatomy.yaml` and is registered as `PARSERS.AN` in `content.ts`.
- `src/lib/anatomy-layout.ts` is a pure function that lays out the pointer-tree diagram.
- Static Astro components under `src/components/anatomy/` render the page, choosing a component by each section's `kind`.
- The excerpt panel is pulled out of `GuidedTrace.tsx` into `CodePanel.tsx`, which both formats use.

**Tech Stack:** Astro 7, Preact islands (GT only), zod 4, yaml, vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-anatomy-format-design.md`. Read it first; this plan does not restate its prose.

## Global Constraints

- The React pin is `1d34f91dfde6bba84d08b683aaba164c7194dacb` (v19.3.0). Every excerpt must be the file's `lines` range at that pin, dedented; `// ...` marks trimmed lines. Never invent code, line numbers or counts.
- Upstream code is read only from `.repos/react`, which `pnpm repos:sync` creates. Never commit anything under `.repos/`.
- The AN page ships no client JavaScript: no `client:*` directive on anything under `src/components/anatomy/`.
- Visual rules: tokens from `src/styles/global.css` only, real `<a>` elements, links at least 44px tall, text contrast at least 4.5:1, no emoji, no gradients, no page-level horizontal scroll at 390px.
- Commit messages follow the repo's plain-sentence style ("Add …", "Let …") and end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Uk3JbuYDrcuu3GhcCWWsQ6
  ```
- Work on branch `claude/react-articles-oqwahj`; push with `git push -u origin claude/react-articles-oqwahj`. Draft PR #4 already exists.

## Review Focus

Inputs the spec implies but no happy-path test exercises. Each one has a named test in Task 3.

1. **A comparison is not an assignment.** `this.tag === x` or `this.tag == x` in a struct excerpt must not count as assigning `tag`. Test: `ignores comparisons when collecting assignments`.
2. **Commented-out code is not an assignment.** A non-elision comment line such as `// this.old = null;` must not demand a group. Test: `ignores assignments inside // comments`.
3. **Values must match exactly.** A reference row `{ name: Beta, value: "1" }` must not match source `Beta = 10`. Test: `does not match a reference value by prefix`.
4. **Unquoted numbers work.** YAML `value: 0` (unquoted) must load as the string `"0"`, as `lines` already is. Test: `coerces unquoted reference values to strings`.
5. **Reassigning a field is still one field.** A field assigned twice in the excerpt (in two branches) counts once, not as a field in two groups. Test: `counts a field assigned twice once`.

---

### Task 1: Pull the code panel out of GuidedTrace

**Files:**
- Create: `src/components/CodePanel.tsx`, `src/components/CodePanel.css`
- Modify: `src/lib/excerpt.ts` (add `CodeSource`), `src/components/GuidedTrace.tsx:104-124` (replace the `<figure class="gt-code">` block), `src/components/GuidedTrace.css:165-212` (move the `.gt-code*`, `.gt-file`, `.gt-lines`, `.gt-elided` rules out)
- Test: `e2e/pages.spec.ts:22-23,46` (selectors)

**Interfaces:**
- Produces: `export interface CodeSource { file: string; lines: LineRange; url: string; code: string }` in `src/lib/excerpt.ts` (lib must not import from components), and `export default function CodePanel({ source }: { source: CodeSource })` in `src/components/CodePanel.tsx`. `TraceStep` already has these four fields, so GuidedTrace passes `source={step}`.
- The markup is the current figure unchanged, apart from class names: `gt-code` → `code-panel`, `gt-code-head` → `code-panel-head`, `gt-file` → `code-panel-file`, `gt-lines` → `code-panel-lines`, `gt-elided` → `code-panel-elided`. Keep the `aria-label` on `<pre>`, the "View on GitHub at pin" text, `target="_blank" rel="noopener"` and the `L<start>–<end>` range text exactly as now. Move the `range` computation from GuidedTrace into CodePanel.

- [ ] **Step 1: Update the e2e selectors first.** In `e2e/pages.spec.ts`, replace `.gt-code pre` with `.code-panel pre` (lines 22 and 46) and `.gt-lines` with `.code-panel-lines` (line 23).
- [ ] **Step 2: Run** `pnpm test:e2e -g "Guided Trace"`. Expected: FAIL; the new selectors match nothing.
- [ ] **Step 3: Implement.** Create `CodePanel.tsx`, which imports `./CodePanel.css` and `isElision` from `../lib/excerpt.ts`. Move the CSS rules over with the new names. Use `<CodePanel source={step} />` in GuidedTrace.
- [ ] **Step 4: Run** `pnpm check && pnpm test && pnpm test:e2e`. Expected: all pass, including every GT and phone-width test. Open `/rails/04-request-lifecycle/guided-trace/` and `/react/07-use-state/guided-trace/` in `pnpm dev` and confirm the code panel looks unchanged.
- [ ] **Step 5: Commit** "Share the code panel between formats".

---

### Task 2: Pointer-tree layout

**Files:**
- Create: `src/lib/anatomy-layout.ts`
- Test: `tests/anatomy-layout.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TreeNode { name: string; children?: TreeNode[] }
  export type EdgeKind = "child" | "sibling" | "return";
  export interface LaidOutNode { id: string; name: string; x: number; y: number }   // x, y = box centre
  export interface TreeEdge { from: string; to: string; kind: EdgeKind }
  export interface TreeLayout { nodes: LaidOutNode[]; edges: TreeEdge[]; width: number; height: number }
  export const NODE_W = 96, NODE_H = 36, COL_GAP = 24, ROW_GAP = 56, PAD = 16;
  export function layoutPointerTree(tree: TreeNode): TreeLayout;
  export function describeEdge(layout: TreeLayout, edge: TreeEdge): string; // "List — child → Item"
  ```
- Node `id` is its path from the root: `"0"` for the root, `"0.1"` for the root's second child, `"0.1.0"` below that. Duplicate names are fine.
- Layout rules:
  - Leaves take columns 0, 1, 2… in depth-first order, with `x = PAD + col*(NODE_W+COL_GAP) + NODE_W/2`.
  - A parent's `x` is the midpoint of its first and last child's `x`.
  - `y = PAD + depth*(NODE_H+ROW_GAP) + NODE_H/2`.
  - `width = 2*PAD + leaves*NODE_W + (leaves-1)*COL_GAP`, and `height` works the same way over the number of rows.
- Edge rules:
  - `child` goes from a parent to its **first** child only.
  - `sibling` goes from each child to the next child of the same parent.
  - `return` goes from every non-root node to its parent.

- [ ] **Step 1: Write the failing tests** in `tests/anatomy-layout.test.ts`, with `const APP = { name: "App", children: [{ name: "Header" }, { name: "List", children: [{ name: "Item" }, { name: "Item" }] }] }`:
  - `derives child, sibling and return edges from the tree`: the sorted `describeEdge` strings equal the sorted list `["App — child → Header", "Header — sibling → List", "List — child → Item", "Item — sibling → Item", "Header — return → App", "List — return → App", "Item — return → List", "Item — return → List"]`.
  - `centres parents over their children`: List's `x` is the mean of its two Items' `x`, and App's `x` is the mean of Header's and List's `x`.
  - `never overlaps two nodes`: for every pair on the same `y`, `|x1 - x2| >= NODE_W + COL_GAP`.
  - `a single node has no edges`: `layoutPointerTree({ name: "Root" })` gives 1 node, 0 edges, and `width === 2*PAD + NODE_W`.
  - `a chain has no siblings`: A→B→C gives 2 `child` edges, 0 `sibling` edges and 2 `return` edges, and all three nodes have the same `x`.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/anatomy-layout.test.ts`. Expected: FAIL, because the module is missing.
- [ ] **Step 3: Implement** `src/lib/anatomy-layout.ts` to the rules above.
- [ ] **Step 4: Run** the same command. Expected: 5 passed.
- [ ] **Step 5: Commit** "Lay out pointer-tree diagrams from a nested tree".

---

### Task 3: Anatomy parser and checks

**Files:**
- Create: `src/lib/anatomy.ts`
- Modify: `src/lib/content.ts` (import, the `ArticleBody` union, `PARSERS.AN`), `docs/formats.md` (the AN section)
- Test: `tests/anatomy.test.ts`

**Interfaces:**
- Consumes: `verifyExcerpt`, `parseLineRange`, `githubBlobUrl`, `isElision`, `LineRange` from `src/lib/excerpt.ts`; `ArticleContext` from `content.ts`; `TreeNode` from Task 2; `CodeSource` from `src/lib/excerpt.ts` (Task 1).
- Produces, in `src/lib/anatomy.ts`:
  ```ts
  export interface StructGroup { key: string; name: string; fields: string[]; what: string }
  interface SectionBase { id: string; title: string; body: string | null }
  export type AnatomySection =
    | (SectionBase & { kind: "pointer-tree"; jsx: string; tree: TreeNode; source: CodeSource | null })
    | (SectionBase & { kind: "twin-trees"; nodes: string[]; source: CodeSource | null })
    | (SectionBase & { kind: "reference-grid"; rows: { name: string; value: string; example: string }[]; source: CodeSource });
  export interface AnatomyBody {
    deck: string;
    struct: { name: string; source: CodeSource; groups: StructGroup[] };
    sections: AnatomySection[];
  }
  export function parseAnatomy(raw: unknown, ctx: ArticleContext): AnatomyBody;
  export function assignedFields(code: string): string[]; // unique `this.X =` names, in order
  ```
- `content.ts`: `ArticleBody` becomes `{ format: "GT"; data: GuidedTraceBody } | { format: "AN"; data: AnatomyBody }`, and `PARSERS.AN = (raw, ctx) => ({ format: "AN", data: parseAnatomy(raw, ctx) })`.
- Schema:
  - `source` is `{ file, lines: z.coerce.string(), code }`.
  - `sections` is `z.discriminatedUnion("kind", …)`, with `body` required on `pointer-tree` and `twin-trees` and optional on `reference-grid`, as in spec §1.
  - Row `value` is `z.coerce.string()`.
  - Group `key` matches `/^[A-Z]{2}$/`.
  - `deck`, `struct` and `sections` (`.min(1)`) are required.
- `assignedFields` skips `isElision` lines and lines whose trimmed text starts with `//`, and matches `/\bthis\.(\w+)\s*=(?!=)/g`.
- Problems are collected into one error, `excerpt check failed at <pin>:\n  <problem>\n  <problem>`, the same form as `parseGuidedTrace`. Each problem string starts with the block it concerns (`struct`, or the section id). Exact wording the tests pin:
  - `struct: field "<f>" is not assigned in the excerpt`
  - `struct: "this.<f>" is assigned in the excerpt but is in no group`
  - `struct: field "<f>" is in more than one group`
  - `<id>: row <name> = <value> is not in the excerpt`
  - `section ids must be unique`, `group keys must be unique`, `"struct" cannot be a section id`
  - `tracked symbol <s> is used_in "<x>", which is not struct or a section with a source`
  - `tracked symbol <s>: file <f> does not match <x>'s file <g>`
  - An excerpt mismatch reuses the GT form: `<block> (<file>:<lines>): <reason>`.

- [ ] **Step 1: Write the fixtures and the failing tests** in `tests/anatomy.test.ts`. Use a fake reader (`readAtCommit(commit, file)`, the same shape as `fakeRepo` in `tests/content.test.ts`) serving `lib/thing.js`:
  ```js
  function Thing(tag, key) {
    // Identity
    this.tag = tag;
    this.key = key;

    // Links
    this.next = null;

    if (__DEV__) {
      this._debug = null;
    }
  }

  export const Alpha = 0;
  export const Beta = 10;
  export const Gamma = 1;
  ```
  Build the valid input `VALID` in TypeScript:
  - `struct`: lines `1-12`, with the code eliding the `__DEV__` block through one `// ...` line before the closing `}`. Groups are `ID [tag, key]` and `LK [next]`.
  - One section of each kind. The `reference-grid` section uses lines `14-16` and rows `Alpha = 0`, `Gamma = 1`. The `twin-trees` section has no source.
  - `tracked_symbols: [{ symbol: Thing, file: lib/thing.js, used_in: struct }]`.

  Call `parseAnatomy(VALID, { repo: "example/demo", pin: PIN, reader })`, with each case below applying a small change to a `structuredClone` of it.

  **Tests:**
  - `parses a valid anatomy`: 2 groups, 3 sections, `struct.source.url` ends in `lib/thing.js#L1-L12`, and the pointer-tree `source` is `null`.
  - `rejects an excerpt that does not match the pin`: change `this.key = key;` to `this.key = null;` in the struct code. The error contains `struct (lib/thing.js:1-12)`.
  - `rejects a group field that is not assigned`: add `ref` to group ID. The error contains `struct: field "ref" is not assigned in the excerpt`.
  - `rejects an assignment that is in no group`: remove `next`. The error contains `"this.next" is assigned in the excerpt but is in no group`.
  - `rejects a field in two groups`: add `tag` to LK. The error contains `field "tag" is in more than one group`.
  - `rejects a reference row that is not in the excerpt`: add the row `Delta = 2`. The error contains `row Delta = 2 is not in the excerpt`.
  - `rejects duplicate section ids and group keys`: two sections with the same id and two groups keyed `ID`. The error contains both messages.
  - `rejects an unknown section kind`: a section with `kind: bitmask` throws a ZodError that mentions `kind`.
  - `rejects a used_in that points nowhere`, and `rejects a used_in whose file does not match`: two tests with the messages above. The first also covers a section that has no source.
  - The five Review Focus tests:
    - `ignores comparisons when collecting assignments`: `assignedFields("if (this.tag === 1) {}\nthis.key = 1;")` is `["key"]`.
    - `ignores assignments inside // comments`: `assignedFields("// this.old = null;\nthis.key = 1;")` is `["key"]`.
    - `does not match a reference value by prefix`: the row `Beta = 1` over lines `14-16` fails with `row Beta = 1 is not in the excerpt`.
    - `coerces unquoted reference values to strings`: the row `value: 0` given as a number parses, and `rows[0].value === "0"`.
    - `counts a field assigned twice once`: `assignedFields("this.tag = a;\nthis.tag = b;")` is `["tag"]`.
  - `loadLibrary picks up anatomy.yaml`: copy `tests/fixtures/content` into a `tempDir` (from `tests/temp-dir.ts`), write the `VALID` YAML (with `format: AN`, `title`, `level: practitioner`, `minutes: 10`) to `sets/demo/chapters/02-call/anatomy.yaml`, and have the fake reader also serve `lib/demo.rb`. `loadLibrary` must then list the chapter's formats as `["GT", "AN"]`, with the AN article's `href` `/demo/02-call/anatomy/`.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/anatomy.test.ts`. Expected: FAIL, because the module is missing.
- [ ] **Step 3: Implement** `src/lib/anatomy.ts` and register the parser in `content.ts`. Rewrite the AN section of `docs/formats.md` as a data spec covering the fields and checks from spec §1 and §2. Add one line: "A new section kind is one schema entry in `src/lib/anatomy.ts` plus one component in `src/components/anatomy/`."
- [ ] **Step 4: Run** `pnpm exec vitest run && pnpm check`. Expected: all tests pass, including the existing content and GT tests, with 0 type errors.
- [ ] **Step 5: Commit** "Parse and verify Anatomy articles".

---

### Task 4: The Fiber anatomy content

**Files:**
- Create: `content/sets/react/chapters/04-fiber-node/anatomy.yaml`
- Modify: `scripts/verify-excerpts.ts` (print AN blocks), `tests/react-content.test.ts` (new test)

**Interfaces:**
- Consumes: the schema from Task 3.
- Values fixed by the spec (§1 and §4). Re-read each one at the pin before using it.
  - `struct`: `FiberNode`, from `packages/react-reconciler/src/ReactFiber.js`, lines `134-207`, with the `enableProfilerTimer` and `__DEV__` blocks elided using `// ...`.
    - The groups are the artboard's seven, with these fields in this order:
      - ID Identity: `[tag, key, elementType, type, stateNode]`
      - TR Tree links: `[return, child, sibling, index]`
      - IN Inputs and state: `[pendingProps, memoizedProps, updateQueue, memoizedState, dependencies]`
      - EF Effects: `[flags, subtreeFlags, deletions]`
      - LN Scheduling: `[lanes, childLanes]`
      - MD Mode and refs: `[mode, ref, refCleanup]`
      - AL Double buffering: `[alternate]`
    - Take the `what` texts from `design/canvas/Anatomy.dc.html`, checking each claim against the source.
  - Section `tree-links` (`pointer-tree`): the artboard's title and body. The `jsx` is `<App>` containing `<Header />` and `<List>` with two `<Item />`s. The tree is App → Header, List → Item, Item. No source.
  - Section `double-buffering` (`twin-trees`): nodes `[App, List, Item]`. The source is `ReactFiber.js` `323-351` (`createWorkInProgress`, down to `current.alternate = workInProgress;`), eliding the `__DEV__` block and the comment lines as needed. The body may mention `root.current = finishedWork` in `ReactFiberWorkLoop.js`, but only as prose.
  - Section `work-tags` (`reference-grid`): source `packages/react-reconciler/src/ReactWorkTags.js` `44-50`. Rows (value, example):
    - `FunctionComponent`: 0, `function App()`
    - `ClassComponent`: 1, `class App extends …`
    - `HostRoot`: 3, `createRoot(el)`
    - `HostComponent`: 5, `<div>`
    - `HostText`: 6, `"hello"`
    - `Fragment`: 7, `<>…</>`
  - Header fields: `title: Anatomy of a Fiber`, `level: practitioner`, `minutes: 10`, `pin` = the React pin, and `deck` = the artboard's sentence.
  - `tracked_symbols`: `FiberNode → struct`, `createWorkInProgress → double-buffering`, `WorkTag → work-tags`, each with the file of its block.

- [ ] **Step 1: Write the failing test** in `tests/react-content.test.ts`, inside the existing `describe.skipIf`: `04 · Anatomy of a Fiber loads against the pin`. It asserts that the chapter `04-fiber-node` has an article with `format.code === "AN"`, 7 groups with keys `["ID","TR","IN","EF","LN","MD","AL"]`, and 3 sections of kinds `["pointer-tree","twin-trees","reference-grid"]`. It also asserts that `struct.source.url` ends in `packages/react-reconciler/src/ReactFiber.js#L134-L207`.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/react-content.test.ts`. Expected: FAIL, because 04 has no AN article. If the test is skipped instead, run `pnpm repos:sync` first.
- [ ] **Step 3: Write `anatomy.yaml`** from the values above. Copy every `code` block from `git -C .repos/react show 1d34f91dfde6bba84d08b683aaba164c7194dacb:<file>`, never from memory. Start the file with the same two header comment lines the GT files use. In `scripts/verify-excerpts.ts`, add an `else if (article.body.format === "AN")` branch that prints `    ok  struct  <file>:<start>-<end>` and then `    ok  <section id>  <file>:<start>-<end>` for each section that has a source.
- [ ] **Step 4: Run** `pnpm exec vitest run && pnpm verify`. Expected: all tests pass, and `pnpm verify` lists `04-fiber-node · Anatomy` with 3 `ok` lines (struct, double-buffering, work-tags), ending in "All excerpts match their pinned source."
- [ ] **Step 5: Commit** "Add the Anatomy of a Fiber article".

---

### Task 5: Render Anatomy pages

**Files:**
- Create: `src/components/anatomy/Anatomy.astro`, `StructCard.astro`, `StructLegend.astro`, `PointerTree.astro`, `TwinTrees.astro`, `ReferenceGrid.astro`
- Modify: `src/pages/[set]/[chapter]/[format].astro`, `e2e/pages.spec.ts`, `README.md` (status line 5 and the `content/` line 35: say "Guided Traces and an Anatomy")
- Test: `e2e/pages.spec.ts`

**Interfaces:**
- Consumes: `AnatomyBody` and `AnatomySection` (Task 3), `layoutPointerTree`, `describeEdge`, `NODE_W` and `NODE_H` (Task 2), and `CodePanel` (Task 1, rendered without `client:`).
- `Anatomy.astro` takes the prop `body: AnatomyBody`. It maps each section's `kind` to its component with a `const SECTIONS = { "pointer-tree": PointerTree, "twin-trees": TwinTrees, "reference-grid": ReferenceGrid }` object, and each section component takes `section` narrowed to its own kind.
- Page: in the header, render `<p class="deck">{article.body.data.deck}</p>` under the `h1` when `article.body.format === "AN"`. In the body, add `{article.body.format === "AN" && <Anatomy body={article.body.data} />}` next to the GT line.
- Layout follows spec §3 and the artboard's grid:
  - The struct panel is a card surface with a 12-column grid: the card spans 5 columns and the legend spans columns 6 to 12.
  - The legend ends with a `<details><summary>Source at pin</summary><CodePanel …/></details>` whose summary is at least 44px tall.
  - Sections sit in a 12-column grid: text spans 4 columns and the figure spans columns 6 to 12.
  - Below 900px every block spans `1 / -1`.
- PointerTree markup:
  - `<figure>` holds the "Example" label and `<pre>` with the JSX, then an `<svg viewBox="0 0 {width} {height}" role="img" aria-labelledby>` with a `<title>` of `<section title> — diagram`.
  - Nodes are a `rect` plus `text`. Edges are straight `line`s with arrow markers, `stroke: var(--accent)` for child and sibling, and `stroke: var(--color-textMuted)` with `stroke-dasharray` for return. Offset the return line a few pixels from the child line so the two don't overlap.
  - Then `<ul class="visually-hidden" aria-label="Edges in this diagram">` with one `<li>{describeEdge(…)}</li>` per edge, and a visible legend of two items: "child / sibling — the way down and across" and "return — the way back up".

- [ ] **Step 1: Write the failing e2e tests.** Add `test.describe("Anatomy", …)` on `const ANATOMY = "/react/04-fiber-node/anatomy/"`:
  - `struct card lists the seven groups`: `.struct-card` shows the keys ID, TR, IN, EF, LN, MD, AL, and the ID row contains `tag`.
  - `struct source links to the pin`: after opening "Source at pin", the "View on GitHub at pin" link's `href` is `https://github.com/facebook/react/blob/1d34f91dfde6bba84d08b683aaba164c7194dacb/packages/react-reconciler/src/ReactFiber.js#L134-L207`. Scope it to the struct `<details>`, since the page has three such links.
  - `the pointer-tree diagram is described in text`: `getByRole("img", { name: /Three pointers make a tree/ })` is visible, and the list "Edges in this diagram" contains "List — child → Item".
  - `format switcher marks Anatomy as current`: `getByRole("navigation", { name: "Formats of this chapter" }).getByRole("link", { name: "Anatomy" })` has `aria-current="page"`.
  - `React set home shows 04 as up to date and links it`: on `/react/`, the link "Anatomy of a Fiber" goes to `ANATOMY`.
  - Also:
    - Append `ANATOMY` to the phone-width path list at `e2e/pages.spec.ts:68`.
    - Change `Tracked symbols71` to `Tracked symbols73`. FiberNode and WorkTag are new; createWorkInProgress is already tracked by 05.
- [ ] **Step 2: Run** `pnpm test:e2e -g "Anatomy|phone width|React set home"`. Expected: the new tests fail (no struct card or diagram), and the count assertion fails at 73.
- [ ] **Step 3: Implement** the components and the page change, and update the README.
- [ ] **Step 4: Run** `pnpm check && pnpm test && pnpm test:e2e`. Expected: all pass. Then compare the page with `design/canvas/Anatomy.dc.html` at 1280px and at 390px in `pnpm dev`: the struct panel, the tree diagram, the twin columns and the tag grid should all be present, in the artboard's order.
- [ ] **Step 5: Commit** "Render Anatomy pages".

---

### Task 6: Whole-branch check and push

- [ ] **Step 1: Run** `pnpm check && pnpm test && pnpm verify && pnpm build && pnpm test:e2e`. Expected: all pass, with 0 type errors.
- [ ] **Step 2: Run** `grep -rn "client:" src/components/anatomy`. Expected: no output.
- [ ] **Step 3: Push** with `git push -u origin claude/react-articles-oqwahj`. Then update PR #4's body: replace the "Status" section with what shipped and how it was verified, keeping the attribution lines, and mark the PR ready only if the user asks.
