# Anatomy format + "Anatomy of a Fiber" — design

Date: 2026-09-27 · Status: approved in conversation, awaiting spec review

## Context and goal

The user asked for more React articles, both more Guided Traces and articles in the formats that are not built yet. Only Guided Trace (GT) renders today. The work was split into sub-projects, each with its own spec, plan and PR:

1. **Anatomy (AN) format + React 04 · Anatomy of a Fiber** ← this spec
2. Quick Tale format + React Quick Tales
3. Source Reading format + React Source Readings
4. Field Guide format + React 01 · The repository map
5. New React Guided Trace chapters (content only, can run in parallel)

Revision Note is out of scope: it belongs to the drift checker.

**Goal:** a reader opens `/react/04-fiber-node/anatomy/` and gets the page from `design/canvas/Anatomy.dc.html`. Every fact on it (excerpts, field names, tag values) is checked at build time against the React pin (`facebook/react@1d34f91`, v19.3.0). The format is built so that the Anatomies for 02 · Elements, 09 · Lanes and 11 · Commit can be added later without changing it, apart from any new diagram kinds they need.

**Success:** `pnpm test`, `pnpm verify`, `pnpm build` and `pnpm test:e2e` all pass. The page follows the artboard's structure at desktop and at 375px wide. Chapter 04 shows as Up to date on the React set home, and its format switcher lists Anatomy.

**Out of scope:** Anatomies for chapters 02, 09 and 11. Diagram kinds other than the three below. Interactivity, such as hover-linking the card to the legend. Changes to the Rails set.

## Decisions made

| Question | Decision |
|---|---|
| Which Anatomies ship | Only 04 · Anatomy of a Fiber |
| How strictly the build checks | Excerpts **plus** the structured facts built on them (struct fields, reference rows) |
| How sections and diagrams are modelled | Fixed page layout + a registry of typed section kinds; this PR ships `pointer-tree`, `twin-trees` and `reference-grid` |

## 1. Content schema

One file, `content/sets/react/chapters/04-fiber-node/anatomy.yaml`. It uses the common article fields from `ArticleBase` (`format: AN`, `title`, `level`, `minutes`, `pin`, `tracked_symbols`) plus these:

```yaml
deck: >-                     # one sentence under the title
  Every component you render gets one plain JavaScript object ...
struct:
  name: FiberNode            # heading of the struct card
  source:                    # required; a verified excerpt
    file: packages/react-reconciler/src/ReactFiber.js
    lines: 134-207
    code: |
      function FiberNode(
      // ...
        this.tag = tag;
      // ...
  groups:                    # order = display order
    - key: ID                # 2 uppercase letters, unique
      name: Identity
      fields: [tag, key, elementType, type, stateNode]
      what: What this fiber is: ...
    # TR Tree links, IN Inputs and state, EF Effects, LN Scheduling, MD Mode and refs, AL Double buffering
sections:                    # order = display order
  - id: tree-links           # unique, used by tracked_symbols.used_in
    kind: pointer-tree
    title: Three pointers make a tree
    body: A fiber points only to its first child ...
    jsx: |                   # illustrative example; shown with an "Example" label, not verified
      <App>
        <Header />
        <List>
          <Item />
          <Item />
        </List>
      </App>
    tree:                    # nested nodes; edges are derived from this
      name: App
      children:
        - name: Header
        - name: List
          children: [{ name: Item }, { name: Item }]
    source: { file, lines, code }   # optional
  - id: double-buffering
    kind: twin-trees
    title: Two trees, one screen
    body: React keeps the tree on screen (current) ...
    nodes: [App, List, Item]
    source:                  # optional; here createWorkInProgress wiring `alternate`
      file: packages/react-reconciler/src/ReactFiber.js
      lines: 323-351
      code: |
        ...
  - id: work-tags
    kind: reference-grid
    title: Tags you will meet first
    body: ...                # optional
    source:                  # required for reference-grid
      file: packages/react-reconciler/src/ReactWorkTags.js
      lines: 44-50
      code: |
        ...
    rows:
      - { name: FunctionComponent, value: "0", example: "function App()" }
      # ClassComponent 1, HostRoot 3, HostComponent 5, HostText 6, Fragment 7
tracked_symbols:
  - { symbol: FiberNode, file: packages/react-reconciler/src/ReactFiber.js, used_in: struct }
  - { symbol: createWorkInProgress, file: packages/react-reconciler/src/ReactFiber.js, used_in: double-buffering }
  - { symbol: WorkTag, file: packages/react-reconciler/src/ReactWorkTags.js, used_in: work-tags }
```

During implementation, the `WorkTag` entry above was replaced by one tracked symbol per quoted work-tag constant (`FunctionComponent`, `ClassComponent`, `HostRoot`, `HostPortal`, `HostComponent`, `HostText`, `Fragment`), because an article tracks the symbols it quotes and `WorkTag` (`ReactWorkTags.js:10-42`) is outside the quoted lines.

The line ranges above were read from the pinned clone while designing. The implementation re-reads them, and the loader enforces them.

### Section kinds (registry)

| kind | Fields besides `id`, `kind`, `title`, `body` | `source` |
|---|---|---|
| `pointer-tree` | `jsx` (string), `tree` (recursive `{name, children?}`) | optional |
| `twin-trees` | `nodes` (non-empty string list) | optional |
| `reference-grid` | `rows` (non-empty list of `{name, value, example}`) | required |

The schema is a zod discriminated union on `kind`. Adding a kind means one schema entry plus one component (see §2). An unknown `kind` fails parsing.

## 2. Checks at build time (`src/lib/anatomy.ts`)

`parseAnatomy(raw, ctx)` is registered as `PARSERS.AN` in `content.ts`, and `ArticleBody` gains `{ format: "AN"; data: AnatomyBody }`. It collects every problem and throws one error listing them all, the same way `parseGuidedTrace` does, so `loadLibrary` reports it with the file name.

1. **Excerpts:** every `source` (the struct's and each section's) passes `verifyExcerpt` against the file at the article's pin, and gets a `githubBlobUrl`.
2. **Struct fields, both ways:**
   - Every field in every group must appear in the struct excerpt as an assignment `this.<field> =`.
   - Every `this.<name> =` in the excerpt (ignoring `//` elision lines) must belong to exactly one group.
   - A field listed in two groups is an error.

   So elided code (the profiler and `__DEV__` blocks) is out of scope by design, but an upstream field added to the part of the constructor that is quoted fails the build until someone places it in a group.
3. **Reference rows:** each row must match a line in its section's excerpt against `\b<name>\s*=\s*<value>\b`, with `name` and `value` regex-escaped.
4. **Ids:** section ids are unique and are not `struct`. Group keys are unique and match `^[A-Z]{2}$`.
5. **Tracked symbols:** `used_in` must be `struct` or a section id, and `file` must equal that block's `source.file`. A section without a `source` cannot be named in `used_in`.
6. **pointer-tree:** the tree has at least one node, and node names are non-empty. Duplicate names are allowed (two `Item`s); nodes are identified by their path in the tree.

## 3. Rendering

**Page:** `src/pages/[set]/[chapter]/[format].astro` switches on `article.body.format`:

- GT keeps its example panel and `GuidedTrace` island.
- AN renders `deck` as a paragraph under the `h1` and `<Anatomy body={…} />` as the page body.

The top bar, breadcrumb, format switcher and meta chips are unchanged.

**Components** (static Astro unless noted; none ship JavaScript to the browser):

- `src/components/CodePanel.tsx` (Preact) is **pulled out of `GuidedTrace.tsx`**: file path + line range header, "View on GitHub at pin" link, and a `<pre>` with elided lines dimmed. GuidedTrace uses it inside its island, and Anatomy renders it at build time without `client:`. Its CSS moves from `GuidedTrace.css` into `CodePanel.css`, and its class names go from `gt-code*` / `gt-file` / `gt-lines` / `gt-elided` to neutral `code-panel*` names. The e2e selectors are updated to match.
- `src/components/anatomy/Anatomy.astro` lays out the struct panel (card in 5 columns, legend in 7) and then each section. It picks the component through a `kind → component` map.
- `StructCard.astro`: the struct name header, then one row per group with the key in the left column and the fields in mono.
- `StructLegend.astro`: key, name and `what` for each group, then the struct's `CodePanel`, collapsed in a `<details>` labelled "Source at pin", so the card stays the focus.
- `PointerTree.astro`: title and body (4 columns); the JSX example labelled "Example" and the SVG diagram (columns 6–12); a legend for child/sibling and for return; the `CodePanel` if there is a source. The SVG comes from `layoutPointerTree(tree)` in `src/lib/anatomy-layout.ts`, a pure function that returns:
  - `nodes[{ id, name, x, y }]` on a fixed grid: the row is the depth, the column is the node's position among the leaves, and a parent sits over the midpoint of its children;
  - `edges[{ from, to, kind: "child" | "sibling" | "return" }]`: `child` from a parent to its **first** child only, `sibling` between adjacent children, `return` from each non-root node to its parent;
  - `width` and `height` for the `viewBox`.

  The SVG uses token colours through CSS custom properties: child and sibling in the set accent, return in muted and dashed. It carries `role="img"` with a `<title>`. A visually hidden `<ul>` lists every edge as text, for example "List — child → Item".
- `TwinTrees.astro`: title and body, then two HTML columns ("current · on screen", "workInProgress · being built") with one row per node and `⇄ alternate` between twins, then the `CodePanel` if there is a source.
- `ReferenceGrid.astro`: title and body, the `CodePanel`, and a grid of cards showing value, name and example.

**Responsive and accessibility:** below 900px every two-column block becomes one column, and the SVG scales through its `viewBox`. Links are at least 44px tall, and `<pre>` scrolls inside itself, so there is no page-level horizontal scroll at 375px. Text contrast is at least 4.5:1 using the existing tokens. No emoji, no gradients.

## 4. Content

`anatomy.yaml` for 04 starts from the artboard's copy: the deck, the seven group descriptions, the two section texts and the six tags. Every claim is re-checked against the pinned source while writing. Findings so far at the pin:

- `FiberNode` is at `ReactFiber.js:134-207`. It assigns exactly the artboard's fields in the artboard's order, then the `enableProfilerTimer` and `__DEV__` blocks, which are elided.
- `createWorkInProgress` (`ReactFiber.js:323`) sets `workInProgress.alternate = current; current.alternate = workInProgress;` (lines 350–351).
- The root swap is `root.current = finishedWork;` at `ReactFiberWorkLoop.js:4051`. The twin-trees body may state this; if it quotes it, that becomes the section's source instead of `createWorkInProgress`.
- The work tags at `ReactWorkTags.js:44-50` match the artboard's values (0, 1, 3, 5, 6, 7). The excerpt also shows `HostPortal = 4`, which is not a row.

## 5. Testing

- `tests/anatomy.test.ts` uses fixture repos, like the GT tests. It has one passing fixture and one failing case per check in §2; each asserts the error message names the problem:
  - an excerpt mismatch
  - a group field not assigned in the excerpt
  - an assignment in the excerpt that is in no group
  - a field listed in two groups
  - a reference row missing from its excerpt
  - a duplicate section id or group key
  - an unknown `kind`
  - a bad `used_in`, or a `used_in` whose file doesn't match its block
- `tests/anatomy-layout.test.ts`:
  - The artboard tree (App → Header, List → Item, Item) gives exactly the expected edges: 2 `child` (App→Header, List→first Item), 2 `sibling` (Header→List, Item→Item) and 4 `return`. (The artboard draws only two of the returns; the page draws all four.)
  - No two nodes overlap, and parents are centred over their children.
  - A single node gives no edges, and a deep chain with one child per level has no siblings.
- `tests/react-content.test.ts` checks that 04 has an Anatomy loaded against the real clone, with 7 groups and 3 sections. It is skipped without the clone, like the rest of the file.
- `e2e/pages.spec.ts`, on `/react/04-fiber-node/anatomy/`:
  - The struct card shows 7 groups, and `tag` appears under Identity.
  - The struct's "View on GitHub at pin" link ends in `ReactFiber.js#L134-L207` at the pin.
  - The diagram has an accessible name, and its edge list includes "List — child → Item".
  - The format switcher marks Anatomy as current.
  - At a 375px viewport, `scrollWidth <= clientWidth`.
  - The React set home shows 04 as Up to date.
- The existing GT unit and e2e tests keep passing after the `CodePanel` extraction, with selectors updated.

## 6. Docs and tooling

- `scripts/verify-excerpts.ts` also prints AN excerpts: `ok  struct  <file>:<range>` and one line per section that has a source.
- `docs/formats.md` expands the AN entry into a data spec (§1 and §2), and states that a new diagram kind is one schema entry plus one component.
- `README.md` changes its status line to mention Anatomy.

## Risks

- **Moving the code panel out of `GuidedTrace.tsx` could break GT styling.** The GT e2e tests and a visual check of one Rails and one React trace cover this.
- **`this.X =` matching is regex-based.** It is enough for constructor-style structs. Anatomies of object literals or Flow types (for example Elements in 02) will need a different field check. That is a later spec's problem, and the struct schema can take a `match` option then (YAGNI now).
