# Design sources

`canvas/*.dc.html` are the artboards from the Claude Design canvas (https://claude.ai/artifact/XwnrZWggVPCTzHmPXKMwse).

They are **reference, not runnable pages**: they load `./support.js`, the canvas runtime, which is not included. Read them for layout, spacing, copy and structure:

- Markup lives inside `<x-dc>`; styles are inline.
- `{{name}}` holes and `<sc-for list="{{items}}" as="item">` loops are filled from the `renderVals()` method in the `<script type="text/x-dc">` block at the bottom — that script also holds sample data (steps, fields, tree entries…).
- `<sc-if>` is a conditional; `onClick="{{fn}}"` binds handlers from `renderVals()`.
- `canvas.json` lists each artboard's size (all 1280px wide) and title.

| File | Screen |
|---|---|
| Main.dc.html | Library home |
| SetHome.dc.html | Set home (Rails) |
| QuickTale.dc.html | Quick Tale sample (Node.js event loop) |
| GuidedTrace.dc.html | Guided Trace sample (Rails request) — interactive stepper |
| SourceReading.dc.html | Source Reading sample (React setState) |
| Anatomy.dc.html | Anatomy sample (React Fiber) |
| FieldGuide.dc.html | Field Guide sample (Node.js repo) — interactive tree |
| RevisionNote.dc.html | Revision Note sample (Rails drift) |

Tokens: `tokens.json` (source) and `tokens.css` (CSS custom properties).
