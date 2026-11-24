# Pure Kinetic components for HyperFrames

Five isolated scene factories, native HyperFrames sub-compositions and an offline
project builder. This is a migration pilot, not a replacement for Pure Kinetic's
film planner or its other scenes. The existing template and `core/` are unchanged.

## Build and preview

From the repository root, with the Pure Kinetic template's pinned dependencies installed:

```sh
node runtimes/hyperframes/components/pure-kinetic/build.mjs \
  runtimes/hyperframes/components/pure-kinetic/example.json /tmp/pk-components-demo
templates/pure-kinetic/node_modules/.bin/hyperframes lint /tmp/pk-components-demo
templates/pure-kinetic/node_modules/.bin/hyperframes preview /tmp/pk-components-demo
```

The destination must not already contain `index.html`. Set `aspect` to `9:16`,
`1:1` or `16:9`; each scene accepts `duration` from 2 to 8 seconds. The default
placement is sequential. An explicit `start` can create overlapping native hosts.
Every host has a unique `id`; `main` is reserved. Same-kind instances of the same
duration reference **one composition HTML file**, with different native variables.

Generated projects run independently of this repository: they contain only the
selected scene modules, a small shared adapter, GSAP, fonts and (for the phone)
Three.js. Installation copies local assets and makes no network request. Asset
provenance travels with the project. The builder reads the existing template's
font/Three.js library at installation time; it does not ship or execute its film
engine, planner, globals or draw loop.

## Contract

`catalog.mjs` is the source of truth for content fields, declared limits, styles
and native variable roles. The builder and browser adapter use the same validator.
Array content becomes JSON strings only at the native HyperFrames variable
boundary, and is restored and validated before reaching a factory.

| Component | Content | Scope |
| --- | --- | --- |
| `title` | `text`, `sub` | Grapheme rise, `*accent*` runs, subtitle typewriter |
| `stack` | `words` (2–4) | Successive lines, earlier lines dim, final accent |
| `chart` | `title`, `labels`, `values`, `suffix` | 2–6 nonnegative bars; rows when columns cannot fit |
| `controls` | `title`, `toggles` (2–4), `slider` | Glass panel, spring switches, optional slider |
| `phone3d` | `caption`, `appName` | Real Three.js geometry and projected screen-text audit |

`content` has role `content`; the validated style object has role `style`; duration
has role `timing`. Styles provide bundled fonts, weight, tracking and colors. The
included presets are Editorial and Loud. Editorial's text accent is slightly
darker than the original coral to meet the native contrast check.

Factories have one interface:

```js
export default function create(context, content) {
  return { draw(localSeconds), events, audit, dispose };
}
```

Only `draw` is required. `events` uses `{time, kind, target?}` in local seconds;
it describes sound cues but does not play or generate audio. `audit()` exposes
projected canvas text that a DOM audit cannot see. `dispose()` releases private
resources. Factories may finish initialization asynchronously.

The context supplies the root, size, safe area, type scale, validated style,
duration and measured text helpers. `design/norms.json` supplies the shared size
and safe-area rules; the builder embeds its current contents. The 1080-short-side
minimum is 39.6 px in portrait and 36 px in square/landscape. Fit uses loaded fonts
and refuses impossible text instead of shrinking below that floor. Character
limits are input guards, **not a promise that every possible string of that
length fits**. The acceptance fixtures record what was actually measured.

Each instance owns its DOM, content, context and local clock. The paused GSAP
timeline drives a property setter, so seeking with callbacks suppressed still
draws the frame. Async mount returns `{timeline}` because returning a GSAP
thenable itself would wait forever. Runtime identity comes from the native host,
not the shared definition's authored ID. The phone shares only its GPU renderer
and environment; every instance owns its scene, camera, textures and output canvas.

Change duration through the builder so host duration, inner clip and timeline stay
equal. Changing only the native duration variable is explicitly rejected. The
pilot does not yet offer a complete film composer or automatically generated panel.

## Verification

```sh
node --test runtimes/hyperframes/components/pure-kinetic/tests.mjs \
  runtimes/hyperframes/components/pure-kinetic/tools/audit.test.mjs
node runtimes/hyperframes/components/pure-kinetic/tools/accept.mjs /tmp/pk-acceptance
node runtimes/hyperframes/components/pure-kinetic/tools/check-cli.mjs /tmp/pk-cli
node runtimes/hyperframes/components/pure-kinetic/tools/audit.mjs /tmp/pk-acceptance/results/native
node runtimes/hyperframes/components/pure-kinetic/tools/summarize.mjs /tmp/pk-acceptance /tmp/pk-cli/cli-results.json
```

Acceptance compiles real native HyperFrames projects with the pinned **0.9.19**
compiler and seeks them with its capture API. It checks three formats, 2/4/8-second
clips, two style presets, longer Russian content and repeated uses of the same
definition, plus a film containing all five components. It blocks external HTTP requests, checks local clocks and variable
isolation, captures early and late text, measures safe areas and projected phone
text, checks complete content and intersections between different text fields,
and compares pixels after forward/backward seeks. Exact hashes are reported;
the equivalence limit is identical measured state and at most **1/255 per RGB
channel**, accounting for Chrome's final antialias quantization. Larger differences
fail. Output includes raw measurements, PNGs and standalone projects. A regular
expression in the third argument selects cases for a focused rerun.

Native lint and full `hyperframes check --json --samples 9 --budget 90s` are also
run on each of the 15 baseline projects. Intentional blank entrance frame warnings
and absent-audio information are recorded separately from runtime/layout/contrast
errors. Hardware warnings are retained. The committed acceptance summary identifies
the environment and tested source revision; it is not certification of other GPUs
or workers.

## Boundaries

- Chart migration covers bars, including zero; line/pie/ring and signed axes are
  separate designs and are rejected rather than silently mapped to bars.
- The phone currently accepts a generated UI with `appName`. Arbitrary screen
  images need their own text annotations and are not accepted by this pilot.
- The two presets, EN and Russian fixtures are tested. A general font loader,
  every language, audio placement, transitions and production picker integration
  are outside this change.
- Original scene gestures are retained, while layout, size and some timing change
  to respect reading space. Comparison frames are not claimed to be pixel copies
  of Pure Kinetic. Kinetic's proprietary provenance and the owner's existing
  permission remain in `SOURCE.json`.
