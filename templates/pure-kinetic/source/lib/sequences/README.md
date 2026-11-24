# Directed native sequences

This library contains authored productions with constrained content slots.
The existing `film.json` scene catalogue remains a separate entry point.
Both compile to native HyperFrames projects; HyperFrames owns playback,
seeking and export. A sequence's semantic model is not another media player.

The first family is **Document Flow** (`document-flow.v1`): six persistent
documents, scanning, three destination groups, Collect / Arrange / Create
actions and a closing. Its current choreography is `folio-02`; the input schema
remains `document-flow.v1`. It is the Folio quality prototype, not an automatic replacement for
every Pure Kinetic film.

From a copied template source folder:

```sh
node sequence.mjs validate lib/sequences/document-flow/examples/folio.json
node sequence.mjs review lib/sequences/document-flow/examples/folio.json
node sequence.mjs build lib/sequences/document-flow/examples/folio.json --out /tmp/document-flow-project
```

The destination must be fresh or empty. The output includes a native project,
local fonts, pinned GSAP, licensed audio, normalized input, resolved plan,
source receipts and a portable `source/` builder. Rebuild that source into a
new directory after changing input. Existing user projects are never rewritten.

## Responsibilities

- `model.mjs` validates the recipe, resolves format-specific geometry, anchors,
  action timing and sound events, and evaluates a complete state for any time.
- `view.mjs` constructs six stable document nodes and one camera, loads actual
  fonts, measures copy once and paints sampled states. No advancing simulation.
- `runtime.mjs` adapts each mounted world to one paused native timeline and
  exposes its state, audit and disposal through `root.documentFlow`. Variables,
  roots, camera and timeline identity belong to that instance. It does not play
  media or create its own render loop.
- `build.mjs` emits the native composition and native audio clips. `audio.mjs`
  maps the same 26 semantic events to pinned local effects and the existing pulse.
  The pure `audio-contract.mjs` compares the resolved event schedule, sound
  settings, duration and BPM with the contract embedded by the builder.
- `SPEC.md`, `STORYBOARD.md` and `REVIEW.md` hold authored design and review
  decisions. Passing geometry is separate from judging those decisions.

## Supported variations

Three aspect ratios, three bundled fonts, explicit brand roles, six document
labels/kinds/category assignments, three category labels, three short actions,
opening, closing, CTA and 96–132 BPM. The choreography is 32 beats. Word-count
and font-metric constraints reject inputs that cannot fit the reading window;
they do not truncate copy or silently shrink below the floor.

Root brand/content variables apply centrally. Empty child values inherit;
explicit child JSON wins, including a reset to original values. Brand and copy
edits can apply after font/fit validation when the resolved audio contract is
unchanged. An edit that changes semantic events or sound timing rejects the
registered native `window.__hf.buildReady` promise with
`DOCUMENT_FLOW_AUDIO_STALE`. Preview startup and ordinary native CLI export fail
until a fresh build from the edited recipe produces matching audio. This is an
enforced readiness contract, not a warning flag or a strict-export-only check.
Native variable editing never regenerates the soundtrack by itself.

Sound exposes master, music, event-kind and target gain/mute/mapping. Target
names are `document:<id>`, `category:<id>`, `action:collect`, `action:arrange`,
`action:create`, `scanner` and `cta`; equal document/category names therefore
remain independent. Action sounds follow `action.start`, and completed groups
emit `category.ready`. The music-only pulse is reused at native playback
rate when BPM changes: pitch changes with tempo. Preserving pitch would require
a separately prepared bed. No provider media generation is part of a build.

## Instance boundary

The builder accepts an explicit `instanceId`, namespaces native clip IDs and
preserves that identity in the portable source build options. Generated scripts
resolve the actual native mount identity through HyperFrames' scoped selector,
including aliases of one source file. Audits and the root-variable provider use
DOM-owned state; there is no singleton world or global variable bridge.

Native acceptance mounts the same graphics file twice with different brands,
content and start offsets, checks independent audio schedules, seeks backward
and forward, and disposes one instance while the other remains live. The builder
still emits one world per project. Combining worlds also requires composing
their native audio schedules; this is tested integration, not a universal graph
builder or an automatic multi-world authoring API.

## Authoring boundary

`tools/sequence-authoring.mjs` is a bounded template-level prototype. It accepts
a trusted brief contract, asks a data-only writer for one recipe, and permits
at most one correction. It preserves exact texts, brand roles, order and category
assignments. Renderer diagnostics are not sent back as requests to rewrite the
story. Cost reservations, known-cost checks and timeouts bound calls.

The current trusted contracts come from independently authored fixtures.
Extracting reliable constraints from arbitrary prose, product routing and
worker integration remain separate work. This controller has not replaced the
running worker. Three successful direct DeepSeek calls prove only these data
fixtures, not general art direction, full agent reliability or artistic parity.

The family does not accept arbitrary action graphs, obstacles, multiple actors,
arbitrary numbers of cards or every script/font. Add another real production
before generalizing it into a universal world solver.
