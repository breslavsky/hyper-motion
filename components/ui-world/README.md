# UI world proof on HyperFrames

A six-second switch → ball → slider composition, rendered directly by pinned
HyperFrames 0.9.19 at 1920×1080, 1080×1080 and 1080×1920. One white ball is first
the switch thumb, then a free actor, then the slider handle. One SVG world and
one camera persist across the entire shot. The public [reference recipe](https://www.motionfab.app/en/prompts/looping-ui-ball-ride-through-an-app-interface)
informed the interaction and visual direction; this is a new implementation of
its first interaction, not a reproduction of the full ten-second film.

## Contract

| Part | Responsibility |
| --- | --- |
| `model.mjs` | Compile layout, named anchors, action schedule, camera poses and semantic events; evaluate a complete state at any time. |
| `view.mjs` | Draw the world and its single actor; measure real projected labels and bounds. No clock, playback or audio. |
| `runtime.mjs` | Adapt a paused native GSAP timeline to pure `stateAt(t)` evaluation. |
| `audio.mjs` | Map semantic events to local licensed effects, gain and mute, then emit clip descriptors. |
| `build.mjs` | Emit a native sub-composition, local dependencies/fonts and root-level native audio clips. |

The action schedule holds `toggle`, `jump` and `slide` with their times and named
anchors. Both visuals and sound derive from it. Slider clicks occur at actual
10% crossings of its easing curve, not at evenly spaced timestamps. The model
has no advancing simulation, random numbers, wall clock, browser media playback
calls or callbacks that must fire during a seek. HyperFrames owns time and media.

Landscape lays the controls across the world. Square and portrait place the
slider below the switch and resolve a new route to its anchor. Camera poses are
art-directed per format; this is responsive layout, not a cropped wide render.
Vertical camera follow starts later than horizontal reframing to keep the jump
inside the safe frame. The same thirteen semantic sounds serve all formats.

## Use

From the repository root, build an offline project:

```sh
node components/ui-world/build.mjs recipe.json /tmp/ui-world
```

Example `recipe.json`:

```json
{
  "aspect": "9:16",
  "style": {"font":"Geist","accent":"#FB2D89","bg":"#0D0B1E"},
  "labels": {"switch":"FOCUS","slider":"INTENSITY"},
  "sound": {
    "gain": 1,
    "targets": {"slider":{"gain":0.8}},
    "mapping": {"actor.land":{"sound":"wood","gain":0.5}}
  }
}
```

`style` merges with shared defaults. Bundled font choices are Geist, Archivo and
Geist Mono. Labels are measured with their loaded font and fitted from 24 to 22
world units; text that cannot fit fails explicitly. Native variables expose
brand and label JSON for a mounted world. Sound controls compile into native
audio clips: master, event-kind or per-target gain/mute, with five interchangeable
local CC0 effect aliases. Rebuild to change sound mapping or layout.

`sliderLength` can vary within the tested model's supported envelope (300–480
world units wide, 300–440 in square/portrait). The build refuses unsupported
formats, lengths, fonts and durations instead of silently producing a bad fit.

The slide can also follow a musical grid. For example,
`"music":{"bpm":120},"timing":{"slide":{"startBeat":3,"endBeat":15}}`
slows the gesture from three to six seconds: it starts at 1.5 s and reaches 100
at 7.5 s. The camera and every threshold sound follow the same span. Duration
automatically includes 1.5 s for the ending; an explicit shorter duration fails.
`music.offset` places the grid's beat zero in seconds. These settings describe
the grid; they do not stretch an audio track or generate music. Rebuild after
changing them so native sound clips and the visual recipe remain synchronized.

Use the pinned CLI binary from `kit/node_modules/.bin`,
running from the generated project or `/tmp`:

```sh
hyperframes lint --json /tmp/ui-world
hyperframes check --json --samples 9 --budget 90s /tmp/ui-world
hyperframes render /tmp/ui-world --output /tmp/ui-world.mp4 --fps 60 --workers 2 --browser-gpu --strict --no-best-effort
```

Reproduce the checks from the repository root:

```sh
node --test components/ui-world/model.test.mjs components/ui-world/audio.test.mjs components/ui-world/build.test.mjs
node components/ui-world/tools/probe.mjs /tmp/ui-world-check
```

After rendering the three videos into one delivery folder as
`ui-world-16x9.mp4`, `ui-world-1x1.mp4` and `ui-world-9x16.mp4`,
`tools/report.mjs <folder>` creates the local synchronized video gallery.
`tools/summarize.mjs <folder>` creates `acceptance.json` from the retained
`qa/` results and export audio/video verification, refusing stale source hashes.

The native probe builds all three formats plus a different font/color/label/length
variant, blocks external HTTP, checks native audio placement, counts one actor
and camera, measures projected active labels, and compares pixels after reverse
seeks. The model tests check every frame at 60 fps. Sound tests verify the pinned
PCM, onset trim, no clipping, tail bounds and per-target overrides. Provenance
travels with fonts and effects into every generated project.

The CLI retains its warnings about the camera world's intentional overflow and
inactive off-canvas labels. The world is larger than the viewport by design;
the independent probe checks the actor and active text against safe areas.
No blanket overflow exemption is applied to hide a real fit failure.

## What this proves and what remains

HyperFrames can render this family directly, including shared space, continuous
actor identity, camera, offline dependencies and native sound. A second film
playback engine is unnecessary for this proof. The application still needs its
own semantic model: layout, anchors, actions, ownership, camera rules, brand
resolution, fit checks and event-to-sound mapping.

The current implementation is deliberately a small family-specific world. It
does not yet provide a registry of independent world-element factories, arbitrary
action ordering, obstacles, collision/path solving, multiple actors, typing,
runtime sound editing or all text/font/language combinations. It is not a claim
that every existing Pure Kinetic scene has been migrated. The existing five-scene
pilot remains a separate library of full-frame components.

The next production boundary should be two compatible contracts: **scene**
(root, content, style, duration) and **world element** (geometry, named anchors,
states, supported actions, fit constraints and semantic sound hooks). A world
compiler assembles the latter and exposes the completed world as one native
HyperFrames scene. Avoid adding physics or a universal layout solver before a
second real recipe needs them.
