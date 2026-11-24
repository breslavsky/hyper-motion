# Document Flow — Folio 02

A native HyperFrames sequence for a specific story: six documents become three
organized groups. The same objects survive scanning, carrying and camera focus.
The current example is Folio with `folio-02` choreography. The recipe schema
remains `document-flow.v1`. It is an authored production with replaceable
content, not a general planner for arbitrary worlds.

Use `source/sequence.mjs` to validate, review resolved content, or build a fresh
native project. See `../README.md` and `examples/folio.json` for invocation and
input. Builds require no remote media and do not overwrite existing projects.

## Input contract

| Input | Supported values |
| --- | --- |
| `schema` | `document-flow.v1` |
| `aspect` | `9:16`, `1:1`, `16:9` |
| `bpm` | 96–132; exactly 32 beats |
| `brand` | name, Geist / Geist Mono / Archivo, background, foreground, accent, accent2 |
| `content` | opening, six documents, three categories, three steps, closing, CTA |
| `sound` | master/music gain and mute; mappings by event kind and target |

Colors are exact six-digit hex strings. Foreground is the semantic text role;
accent2 belongs to decorative document art. Explicit incompatible ink is
preserved and must fail visual acceptance. Text on a solid accent CTA chooses
dark or white ink. There is no palette guessing or silent copy shortening.

Document kinds are note, task, sketch, file, idea and draft. IDs are stable;
category assignments are explicit. Each category accepts one to three documents.
The recipe requires all six documents and all three categories. Copy limits and
reading-time checks reject overflow early; actual bundled font measurement
checks the final layout before the native timeline becomes ready.

Semantic events are `document.arrive`, `scan.start`, `document.scanned`,
`document.sorted`, `category.ready`, `action.start` and `cta.reveal`: 26 semantic
events whose resulting audio clips can be muted. Sound target names are `document:<id>`, `category:<id>`,
`action:collect`, `action:arrange`, `action:create`, `scanner` and `cta`. The three
action IDs remain stable when their visible labels change. Events keep their
exact seconds; only export frames quantize the picture. Multiple documents at the
same scan height intentionally create simultaneous independent sound events.

```json
{
  "sound": {
    "gain": 0.8,
    "musicGain": 0.25,
    "mapping": {"document.scanned": {"sound": "tick", "gain": 0.12}},
    "targets": {"document:notes": {"mute": true}}
  }
}
```

BPM moves picture and sound on the same grid. This demonstration's existing pulse
bed uses native playback rate, which changes pitch too. A pitch-preserving bed
or local tempo ramps are not implemented. Do not promise either from this API.

## Native project contract

The builder emits one graphics subcomposition and native root audio clips.
The view constructs six document nodes and one world camera once. A paused GSAP
proxy timeline samples a complete state; no independent render loop, physics
accumulation, browser audio playback or per-document player is involved.

Root brand/content variables apply centrally. Empty child values inherit;
explicit child JSON wins, including an explicit reset to the original value.
The inherited provider belongs to the project DOM root; each world exposes
`root.documentFlow` with its own plan, state, `audit()` and `dispose()`.
No singleton world or global root-variable bridge is used.

The builder embeds a canonical contract of resolved events, sound settings,
BPM and duration. Brand or copy-only variable edits remain live after font/fit
validation when this contract is identical. Changes that affect the contract
fail startup with `DOCUMENT_FLOW_AUDIO_STALE`. The original rejected setup
promise is registered in the supported `window.__hf.buildReady` registry, so
ordinary native export fails even with default CLI settings. A diagnostic flag
alone cannot authorize export. Rebuild from the edited recipe in a fresh folder
to produce matching native audio. The browser does not regenerate that audio.

`buildProject(destination, recipe, {instanceId})` accepts a unique lowercase
composition ID other than `main`. The builder namespaces native audio clip IDs;
packaged `source/build-options.json` preserves this identity on isolated rebuild.
Generated scripts use the scoped native selector to resolve each actual host,
so two aliases of the same source do not share content IDs, readiness promises,
timelines or audits. Manual `mount()` consumers using native aliases should
pass the actual `instanceId` in the fifth argument. Other manual roots require
a unique ID or native composition host.

Two mounts of the same graphics file, distinct native audio schedules, different
brands/content, offset local clocks, reverse seeks and independent disposal are
tested. The builder emits one world per project; combining worlds requires
assembling their native audio schedules as well as graphics hosts. Arbitrary
card counts, action graphs, route planning, other scripts and arbitrary fonts
remain outside this version's acceptance. The default worker still uses
`film.json`; this entry point and bounded recipe writer are a local prototype.

`REVIEW.md` records remaining visual tradeoffs. The project-level report in
`docs/DOCUMENT_FLOW_V2_QUALITY.md` records current acceptance and the comparison
with Folio 01; `docs/DOCUMENT_FLOW_QUALITY.md` preserves the earlier model calls
and comparison against scene components.
