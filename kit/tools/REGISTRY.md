# HyperFrames registry: adapted batch 01

Five registry items are adapted into Pure Kinetic's existing native catalog.
The registry is an editable source library, not a guarantee of fit, sound,
brand compatibility or narrative quality. Each adaptation owns that work.

The pinned upstream revision is `29a5003eebdd1a1a01e4d1a4e3f375da93b078ab`.
`source/lib/components/upstream/hyperframes-registry-01/RECEIPT.json` records
original URLs, the tools archive path and SHA-256 hashes. The preserved files match the actual
`hyperframes add` output byte for byte; the Apache-2.0 license and modified
source notices accompany them. Original HTML lives under `tools/upstream/`,
not the renderable source: Studio cannot mistake it for extra compositions.
The provenance receipt and license ship with the adapted runtime.

| Component | Supplied content | Preserved mechanism |
| --- | --- | --- |
| `before-after-wipe` | `before`, `after`, optional `title`, two `images`, `split` 10–90 | Single sine-eased reveal, one divider owner, steady resting split |
| `screen-flow-carousel` | 2–5 `screens` with `label`, optional matching `images`, `title` | 42% throw / 58% catch, receding neighbours, caption handoff |
| `chart-story` | 2–5 `items` with `label` and finite nonnegative `value`, optional `chart`, `unit`, `title`, `emphasize` | Bars / cumulative-length line / sequential-share donut / progress, followed by an exact-value callout |
| `testimonial-proof-card` | `quote`, `name`, optional `role`, `company`, exact `emphasis`, portrait `image` | Measured line masks, staggered quote, overlapping byline arrival, drawn underline |
| `modal-morph` | `title`, `body`, `cta`, optional `eyebrow`, `register` calm/snappy | Shared-element surface morph, persistent keyed children, reciprocal scaling |

Canonical fields, limits, examples, event times and sounds live in
`source/lib/components/metadata.cjs`; `metadata.mjs`, authoring guide and
`beats.json` are generated from it. All content paths use existing local
`image` / `images` loading. `brand.font` and exact brand token roles propagate
through the existing context. No engine, clock, registry package or render
adapter was added; the installed HyperFrames version remains 0.9.19.

All 105 catalog components now share `design-system.mjs`, based on pinned Radix Themes
3.3.0 type, spacing, radius and button tokens. Semantic roles retain their
size/leading/tracking pairs; text never grows simply to fill available space.
Long copy may use only its role's permitted smaller steps or a measured compact
layout. If it still cannot fit, construction fails explicitly. The font and
colours still come from the existing brand context. See `docs/HYPERFRAMES_CATALOG_DESIGN_SYSTEM.md` for the full-catalog
acceptance and comparison record; `docs/HYPERFRAMES_DESIGN_SYSTEM.md` preserves
the first five components’ migration record. The quote's author stack
uses actual measured heights. Before/after labels and carousel captions sit
outside image clipping. These constraints reserve readability as the shapes move.
A readable size does not guarantee enough reading time: long copy still needs
an appropriate beat count and viewing review. Arbitrary aspect ratios beyond
the three accepted formats are not claimed.

The chart preserves exact final numbers, zero geometry and true donut shares;
all-zero donut data are rejected. Placeholder screens are abstract shapes.
Example figures and attribution are explicitly demonstration content. Authors
must supply actual figures, testimonials and assets for production claims.

Visual and sound scheduling uses the same `times(scene, logicalDuration, beat)`
function. Existing tempo, pace, per-scene mute, gain and sound kits apply.
Native edits still follow the scene catalog's existing rebuild-required audio
contract; Folio's separate sequence audio guard is not claimed for these items.

## Reproduction

Run from repository root:

```sh
node --test kit/tools/registry-batch.test.mjs kit/tools/design-system.test.mjs
node kit/tools/registry-native.mjs --out /tmp/pk-registry-acceptance
PURE_KINETIC_TESTS=1 PURE_KINETIC_QUICK=1 .venv/bin/pytest -q tests/test_pure_kinetic.py tests/test_pure_kinetic_contract.py tests/test_pure_kinetic_registry.py
```

`registry-demo.json` is a five-scene demonstration, with sound effects and no
music bed so the semantic cue timing is easy to inspect. Copy the template's
`source` into a fresh project, replace `film.json` with this example, then run
`node lib/film.cjs fit` and regenerate `music.py` before native check/preview/render.
Change `aspect` to `9:16`, `1:1` or `16:9` and rebuild each project separately.

Acceptance receipts and actual export results are recorded in
`docs/HYPERFRAMES_REGISTRY_QUALITY.md`. These are reusable scene components;
adding them does not create a universal actor/world director or establish
artistic parity with Claude Motion.
