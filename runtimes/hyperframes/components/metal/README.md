# Metal material for HyperFrames

The `metal-fx` 2.0.11 liquid-metal material, hosted as a deterministic Canvas2D
output with a WebGL2 shader underneath. All three upstream presets (`silver`,
`gold`, `chromatic`) and their light/dark tunings are retained. The original
Paper Shaders 0.0.80 vertex and fragment strings are unchanged; source hashes,
MIT and Apache-2.0 licenses are in `vendor/`.

The port has no React or npm runtime dependency. It loads only two local
vendor modules. It does not start animation, timers, observers or input
listeners: HyperFrames calls `draw(seconds)` explicitly, including reverse
seeks. A document shares one ref-counted GPU pipeline. Each draw selects its
own complete preset and time, while equal frames reuse the material sheet.
The visible canvas retains its pixels after the shader draws another preset.

```js
import {createMetal} from './metal/metal.mjs';

const material = createMetal({
  canvas,
  width: 480,
  height: 120,
  preset: 'gold',
  theme: 'dark',
  kind: 'ring',
  radius: 60,
  ringWidth: 3,
});
material.draw(localSeconds);
// When the host is disposed:
material.dispose();
```

`kind: 'fill'` produces a full material sheet suitable for CSS text clipping,
texture backgrounds, or the optional `mask(ctx, width, height, pixelRatio)`
alpha painter. The mask context uses backing-store pixels; it can paint
multiple shapes or lines. The compositor applies their combined alpha.
Keep semantic text in native HTML when its text shaping, accessibility and
existing animation should remain intact.

Other options:

- `speed`: 0–4, defaults to 1, multiplies absolute time and upstream speed.
- `strength`: 0–1, defaults to 1, multiplies upstream shader opacity.
- `pixelRatio`: explicit 0.25–4, defaults to 1; independent of browser DPR.
- `shaderScale`: 0.01–8, defaults to upstream ring zoom 1.6 or fill zoom 1.
- `resize(width, height, {radius, ringWidth})`: updates backing size and shape.
  Draw again after resizing. Omitted shape values retain their current value.
- `options`, `canvas`, `width`, `height`, `time`, `disposed`: read-only state.

Dimensions, radius and ring width use logical canvas units. Draw times must be
finite and nonnegative. Creation fails clearly when WebGL2 is unavailable.
`dispose()` is idempotent; later draw/resize calls reject accidental reuse.
The last disposed instance releases the WebGL program, buffers, texture and
context. A lost context can rebuild on the browser's context-restored event.

This imports the **material**, not the upstream interactive React wrapper.
Cursor light, spring-driven cursor bending, neighbour reflections and its
observer/animation scheduling are not imported. Their clocks and interactions
do not define a fixed video frame. The original shader opacity also remains:
silver/dark is 0.88 and gold/dark is 0.92, so the host supplies the backdrop.

## Maintained template copy

Edit this canonical directory, then run:

```sh
node templates/pure-kinetic/tools/sync-metal.cjs
node --test runtimes/hyperframes/components/metal/adapter.test.mjs
```

The sync tool copies the renderer, vendor modules and license receipts into
`templates/pure-kinetic/source/lib/components/metal`. The template carries the
effect into a standalone project without a network fetch.

## Verification

```sh
node runtimes/hyperframes/components/metal/tools/verify.mjs
```

This uses the browser tooling already installed with pinned HyperFrames.
Set `CHROME_BIN` if Chrome is outside its usual location. It tests all three
presets in light/dark mode, filled/ring shapes and multiple times, reverse
seeks, independent instances, resize, text and multi-shape masks, 30 concurrent
instances, disposal and the absence of background scheduling. A gallery and
JSON report go to `qa-artifacts/metal-material` by default.

For independent upstream pixel comparison, also supply:

```sh
METAL_SOURCE=/path/to/Libraries.dev/packages/metal-fx \
PAPER_SHADERS=/path/to/unpacked/paper-design-shaders-0.0.80/package \
node runtimes/hyperframes/components/metal/tools/verify.mjs
```

The verifier checks pinned upstream source hashes, bundles the original
renderer and compositor with a test-only explicit clock, and compares decoded
PNG pixels. The port passed 36/36 exact comparisons (three presets × two
themes × two shapes × three times), plus reverse-seek and lifecycle checks.
This verifies material output; themed scene layout and typography are tested
by Pure Kinetic's native and Storybook acceptance checks.
