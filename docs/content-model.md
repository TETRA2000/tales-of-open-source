# Content model

A suggestion, not a mandate — adapt to the stack you choose. The key properties to keep: sets are independent; chapters and formats are additive; every article carries its pin and tracked symbols.

## Set (`content/sets/<set-id>/set.yaml`)

```yaml
id: rails
title: Ruby on Rails
subtitle: in depth
accent: "#F28B6D"
repo: rails/rails
pin:
  commit: "[SHA]"          # full SHA of the pinned commit
  release: "[VERSION]"
  synced_at: "[DATE]"
blurb: How Rails turns a request into a response, and Ruby into SQL.
paths:                      # reading paths shown on the set home
  - level: newcomer
    name: The short way round
    formats: [QT]
  - level: practitioner
    name: Follow the calls
    formats: [GT, AN]
  - level: contributor
    name: Read the source
    formats: [SR, FG]
parts:
  - id: boot
    num: I
    title: Boot
    chapters: [01-repository-map, 02-booting, 03-zeitwerk]
```

## Chapter (`content/sets/<set-id>/chapters/<chapter-id>/chapter.yaml`)

```yaml
id: 04-request-lifecycle
title: Request lifecycle
path_hint: actionpack/lib/action_dispatch/
status: planned | up_to_date | drifted     # derived by the drift checker, not hand-set
```

## Article (`.../chapters/<chapter-id>/<format>.{md,mdx,yaml}`)

Common frontmatter:

```yaml
format: GT                  # QT | GT | SR | AN | FG | RN | (new ones)
title: "From socket to controller: the path of one request"
level: practitioner         # newcomer | practitioner | contributor | all
minutes: 12
pin: "[SHA]"                # defaults to the set pin; may lag behind it
tracked_symbols:
  - symbol: Rails::Engine#call
    file: railties/lib/rails/engine.rb
    used_in: step-2
```

Format-specific bodies are described in `docs/formats.md`. See `content/sets/rails/chapters/04-request-lifecycle/guided-trace.yaml` for a complete seeded example.

## Adding things

- **New set:** new folder under `content/sets/`, a `set.yaml`, a cover accent. Nothing else changes.
- **New chapter:** new folder + add its id to a part in `set.yaml`.
- **New format for a chapter:** add one file in the chapter folder; the format switcher discovers it.
- **New format type:** add a renderer + register its code, name, default level and length in the format registry.
