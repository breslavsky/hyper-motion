# Thinking Orbs for HyperFrames

A reusable port of [Libraries.dev Thinking Orbs](https://libraries.dev/orbs).
All nine states use the **unchanged published `thinking-orbs@0.3.2` engine**.
The adapter replaces the React component's wall clock with explicit composition
time. No React, ReactDOM, WebGL, animation loop or new npm dependency is needed.

The shared component catalogue exposes `thinking-orbs`; build-plan lookup and
automatic suggestions can find it from relevant AI/process motion descriptions.
Pure Kinetic exposes the native scene type `thinking-orb`, with all nine states.
The original Pure Kinetic `orb` scene remains available separately.

## Use in a film

In a Pure Kinetic project whose local component catalogue includes `thinking-orb`,
add a scene to `source/film.json` and build with the normal film workflow:

```json
{
  "type": "thinking-orb",
  "state": "searching",
  "title": "Find the signal",
  "body": "One question. Connected answers.",
  "beats": 5
}
```

`state` is required. Optional `title` (48 characters), `body` (100), `orbSpeed`
(0–4), `size` (.25–1 of the available area), and `tint` (palette name or hex)
control the scene. The scene uses the film's brand, type system, safe area and
clock. Choose a state that explains the story: searching for research, listening
for voice input, solving for reasoning, composing for writing, and so on.
Automatic suggestions guide the agent's choice; they do not insert scenes into
a film or claim that the illustrated task actually happened.

Older projects retain their own copied component library. Check their local
`source/lib/components/catalog.json` before using the new scene; refreshing agent
instructions alone does not upgrade an older film compiler.

For a free-form HyperFrames composition, search/install the shared component:

```sh
python3 "$HARNESS_SKILL_REFERENCES/hyperframes/registry_search.py" "thinking orbs"
python3 "$HARNESS_SKILL_REFERENCES/hyperframes/registry_search.py" --install thinking-orbs
```

Run the installer from the project's `source/` directory. It prints the installed
component path and mounting instructions. Installation copies local editable
source and attribution, without fetching packages.

The native Pure Kinetic runtime mirror is generated from this directory by
`templates/pure-kinetic/tools/sync-thinking-orbs.cjs`; edit the canonical adapter
here and resync, rather than changing the two copies independently.

## Component Storybook

The component Storybook generates the `thinking-orb` entry from the same native
catalogue and metadata. Its default preview exposes the scene's real controls;
`previewVariants: ["state"]` also generates a named example for every state in
the canonical enum. There is no second list of states to maintain.

When running the component Storybook from another checkout, point its
`PURE_KINETIC_TEMPLATE` environment variable at this checkout's absolute
`templates/pure-kinetic` directory before preparation, building or testing.
The prepared assets are copies for preview only; the canonical component stays
here. Rebuild Storybook after changes to the component or its metadata.

A new imported component is complete when its catalogue entry, meaningful
Storybook examples, editable controls and native browser smoke checks are
available together. Preview variants must exercise supported public parameters
and the production renderer; an unimplemented effect is not a working story.

## Build the demonstration

From the harness repository root, using its existing pinned HyperFrames install:

```sh
node runtimes/hyperframes/components/thinking-orbs/build.mjs \
  /tmp/orbs-gallery runtimes/hyperframes/components/thinking-orbs/example.json
templates/pure-kinetic/node_modules/.bin/hyperframes preview /tmp/orbs-gallery
templates/pure-kinetic/node_modules/.bin/hyperframes render /tmp/orbs-gallery \
  --output /tmp/orbs-gallery.mp4 --fps 30 --quality high --workers 1
```

The destination must be fresh or empty. The generated project contains local
fonts, the existing pinned GSAP, the orb engine, the adapter, source attribution
and native HyperFrames sub-compositions. It renders without external asset
requests. The upstream golden test fixture is excluded from output projects.

`example.json` shows the nine states together. A single orb can be built with:

```json
{
  "layout": "single",
  "aspect": "1:1",
  "duration": 6,
  "state": "composing",
  "dark": false,
  "color": "#2f6be5",
  "speed": 0.75,
  "presetSize": 64
}
```

Supported layouts: `gallery`, `single`. Formats: `16:9`, `9:16`, `1:1`.
The native orb definition exposes state, display size, preset density, speed,
theme, tint, position and caption as per-instance variables. Changing state
selects another original preset; it does not create a morph between states.
The demo's canvas and caption placement is fixed by its generated layout.
Custom titles and captions need a visual fit check; character limits are input
guards, not measured text-fit guarantees.

## Reuse in a composition

Copy `orb.mjs` and the runtime files in `vendor/` beside the consuming module,
keeping `vendor/LICENSE`, `vendor/SOURCE.json` and `vendor/INTEGRITY.json`. The published engine's local
chunk must retain its original filename. `native.mjs` and the generated
`compositions/orb.html` demonstrate native HyperFrames mounting and variables.

The lower-level API also works with an existing Canvas:

```js
import {createOrb} from './assets/orbs/orb.mjs';

const orb = createOrb(canvas, {
  state: 'searching',
  size: 320,
  presetSize: 64,
  pixelRatio: 1,
  speed: 1,
  dark: true,
});

// A property setter still runs when HyperFrames suppresses GSAP callbacks.
let elapsed = 0;
const clock = {
  get time() { return elapsed; },
  set time(value) { elapsed = value; orb.draw(value); },
};
const timeline = gsap.timeline({paused:true})
  .to(clock, {time:duration, duration, ease:'none'}, 0);
orb.draw(0);
window.__timelines[compositionId] = timeline;

// On disposal: timeline.kill(); orb.dispose();
```

- States: `working`, `searching`, `solving`, `listening`, `connecting`, `weaving`,
  `composing`, `breathing`, `shaping`.
- `size` is the displayed square in composition pixels. `presetSize` selects the
  original separately tuned geometry (`20`, `32`, `64`); scaling a 64px preset
  preserves its original dot density and proportions.
- `pixelRatio` explicitly sets Canvas backing resolution. It never reads the
  machine's devicePixelRatio. Set it deliberately for higher-resolution output.
- `speed` multiplies the original preset's speed; zero holds its initial frame.
- Optional `color` accepts `#rgb`, `#rrggbb` or `rgb(r,g,b)`. Omit it for the
  original monochrome. The demonstration builder accepts hex tints.
- `draw(seconds)` renders the requested local time, including backward seeks.
  `frame(seconds)` returns geometry in the original preset's logical pixels.
  `sampleOrb(options, seconds)` provides geometry without a Canvas.
- `dispose()` restores the Canvas dimensions and releases the adapter's
  ownership. A Canvas cannot have two active instances.

The native definition uses one paused timeline per mounted instance and a
`buildReady` promise for loading. The effect has no autonomous playback, mouse
gravity or automatic theme detection. Each mount's theme is explicit.

## Validation

```sh
node --test runtimes/hyperframes/components/thinking-orbs/adapter.test.mjs
node runtimes/hyperframes/components/thinking-orbs/tools/verify.mjs \
  /tmp/orbs-gallery /tmp/orbs-results
templates/pure-kinetic/node_modules/.bin/hyperframes check \
  --json --samples 5 --budget 90s /tmp/orbs-gallery
```

The Node tests check 72 original upstream golden frames, every state's temporal
determinism, clock scaling, instance isolation, validation and source integrity.
Golden vectors use raw engine time. They are checked at that exact time because
a divide/multiply roundtrip can perturb sorting of equal-depth dots at machine
epsilon. Adapter speed and reverse seeking are tested separately.

The native verifier uses HyperFrames **0.9.19**, compares actual Canvas pixels
against a fresh rendering by the original engine, repeats backward seeks,
checks mount identity and options, and rejects runtime errors or external asset
requests. It writes three screenshots and `verification.json`.

## Source and size

`vendor/SOURCE.json` declares the upstream package and license.
`vendor/INTEGRITY.json` pins npm integrity, commit references and file hashes.
The engine entry and its chunk total **26,814 bytes**. Together with `orb.mjs`,
the effect is about **33 KB uncompressed**; the native bridge and demonstration
are additional small files. Existing GSAP and the demo font are separate.

The published engine is MIT, copyright Jakub Antalik. Its license is retained.
Only the public npm engine is included; the site's Studio exports and paid
presets were not used. The source fixture stays in the repository for testing
and is not part of a rendered project's runtime payload.
