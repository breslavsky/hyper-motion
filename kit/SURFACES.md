# Shared component surfaces

Cards, fields and badges use the same local design unit as the Radix Themes
3.3.0 typography and spacing ladder. The semantic recipes are Pure Kinetic's
adaptation for video; they are not a claim that Radix specifies this exact
component composition. Colour, material, shadow and choreography remain scene
choices. Brand fonts inherit through the existing text roles.

The Metal look is an optional shared finish applied after native construction:
the original liquid-metal texture is clipped to supported headline glyphs and
card/badge/button rims. It leaves these spacing and radius recipes intact.
Glass panel bodies become neutral metal housings; body text and branded control
centres retain their own paint. Media/device frames and supplied artwork are
not automatically coated. See `source/lib/components/metal-material.mjs` and
the component README for the material boundary and deterministic clock.

Values below are design units, before the format/presentation/local-UI scale.
Padding is horizontal × vertical. All dimensions scale together, including
typography inside a miniature interface.

| Surface | Density | Padding | Gap | Radius |
| --- | --- | --- | --- | --- |
| Card | compact | 12 × 12 | 8 | 12 |
| Card | normal | 16 × 16 | 12 | 16 |
| Card | comfortable | 24 × 24 | 16 | 16 |
| Field | compact | 8 × 6 | 4 | 6 |
| Field | normal | 12 × 8 | 8 | 8 |
| Field | comfortable | 16 × 12 | 12 | 12 |
| Badge | compact | 8 × 4 | 4 | 6 |
| Badge | normal | 12 × 4 | 4 | 8 |
| Badge | comfortable | 12 × 8 | 8 | 8 |

Rounded, pill and square are explicit shapes. A nested frame uses
`max(0, outerRadius − inset)`. The inset is the nearest structural edge;
a content section may start farther down below a header. Real device bezels
with unequal geometry are not automatically called concentric nested frames.
An ordinary control inside a card retains its own control recipe.

## Text overflow

A label designed as a single line keeps its typography and uses an ellipsis
when its allocated width is exhausted. Apply `K.design.truncateLine(node)`
after the text role, on a bounded block, inline-block or flow-root text leaf.
Flex/grid wrappers need `min-width: 0`; keep icons, padding and control geometry
on the wrapper. Applying `text-overflow` to the flex container itself does not
produce a native ellipsis. The helper never chooses a smaller font or slices
the source string. Keep the full DOM copy; an optional `title` must match that
full copy for inspection in the editable preview. A rendered video shows the
shortened visible label.

`tools/ellipsis-scope.json` accounts for all 106 catalog types and lists affected
fields and preserved content: 37 adopt the rule directly, 7 inherit it only
through mockUI, 1 retains the existing drag-filename rule, and 61 preserve their
scene typography. The eight mockUI callers include `between` and `knockout`;
`between` also changes its own CTA. `montage` uses photo/gradient plates, not
mockUI. Shared UI changes apply to drawn interfaces; supplied screenshots stay
intact. The conditional global HUD brand label is inventoried separately from
scene fields, including when it appears in `montage`.

Compact names, navigation, status, chart labels and bounded action labels opt
in. Animated hero text, full narrative sentences, quotes, descriptions,
deliberately multiline controls and metric digits retain complete copy and
their own wrapping/fitting rules. Immutable multiline typing keeps its final
line layout; genuine scrolling inputs keep their latest-glyph/caret behaviour.
Ellipsis does not fix competing status animations: status text must also be
mutually exclusive in time.

Raster labels use `K.design.truncateCanvasLine(context, copy, maxWidth)` after
setting the shared role's canvas font and tracking. It measures candidate text
with that actual context, includes the ellipsis in the width, and returns
`{text, fullText, width, truncated}`. It preserves grapheme clusters, including
combining marks and emoji sequences, and rejects invalid widths or a width
smaller than the ellipsis. `cards3d` title textures and the `phone3d` screen
header use it at the fixed label role. Canvas receipts retain original and
painted copy separately; the audit checks the intercepted draw, measured width
and unchanged typography. Image textures and numeric values are not shortened.

## Usage

```js
const box = K.design.surface(card, 'card', {density: 'normal'});
// Use flex/grid for multiple children so the recipe's gap actually works.
K.design.surface(field, 'field');
K.design.surface(badge, 'badge', {shape: 'pill'});
K.design.surfaceGap(group, 3); // shared space-3, not an arbitrary pixel gap
```

`layout: 'flow'` applies padding and gap. `layout: 'absolute'` uses no CSS
padding, because positions already own layout; register real content elements
with `surfaceContent` and place them inside the returned padding plus border.
`layout: 'frame'` is reserved for media, a device shell or a window frame and
requires its purpose. It is not an escape hatch for a text card without padding.
`surfaceContent(parent, child, {apply: true})` can position a descendant inside
the recipe inset. Sibling content above a scrim can be measured explicitly.

Declare both nested frames, position the inner frame, then call
`nest(inner, outer, {inset})`. Animated radius/scale changes use
`surfaceRadius`, which compensates both axes to retain the intended physical
radius. An animated nested layout must update its derived radius when needed.

`tools/surface-scope.json` accounts for all 106 public types: 58 directly use
semantic surfaces, 1 inherits the shared mock interface, 2 use shared layout
gaps, and 45 contain typography, physical objects, controls or illustrative
geometry without a card/field/badge. Existing button rules remain in force.
Arbitrary spheres, masks, charts and phone hardware are not rounded rectangles
merely because their implementation contains a radius.

## Verification scope

The native HyperFrames gate measures computed padding, both gaps, all four
corner radii, real content bounds, nested insets and local scale. Flow children
are checked in their resting structural layout; absolute content anchors keep
their child layout transforms. Camera and entrance transforms do not redefine
the structural recipe. Glyph fit, visible text, collision and frame checks
remain separate and inspect rendered animation samples.

Canvas UI intercepts actual `roundRect` arguments to verify frame geometry and
radius; its content inset receipt is a declared contract, not independent
measurement of every painted text/avatar/bar. Typography is separately checked
against intercepted text drawing. These tests do not prove every possible
3D occlusion or arbitrary user-provided content length.

Native negative controls alter CSS while preserving metadata, then require
the audit to reject the change and accept exact restoration. The full catalog
uses five animation samples and backward seek in each format. Dedicated typing
gates additionally sample every key. The two genuine single-line scrolling
inputs have separate latest-glyph/caret visibility checks; they do not exempt
arbitrary clipped text from the general audit.

Reproduce from this template directory, always with fresh output directories:

```sh
node --test tools/*.test.mjs
node tools/surface-design-native.mjs --out /tmp/pk-surfaces-canary
node tools/catalog-design-native.mjs --out /tmp/pk-surfaces-normal
node tools/catalog-design-native.mjs --long --font Archivo --out /tmp/pk-surfaces-max
node tools/typing-builtin-native.mjs --out /tmp/pk-surfaces-typing-builtin
node tools/typing-motion-native.mjs --out /tmp/pk-surfaces-typing-motion
node tools/typing-ui-native.mjs --out /tmp/pk-surfaces-typing-ui
node tools/ellipsis-fitter-native.mjs --out /tmp/pk-surfaces-ellipsis
node tools/canvas-ellipsis-native.mjs --out /tmp/pk-surfaces-canvas-ellipsis
node tools/catalog-design-gallery.mjs BEFORE AFTER OUTPUT --surfaces
```

The inventory contract test verifies exact catalog coverage, unique types,
shared-renderer references and reasons for every preserved field policy.
`tools/ellipsis-catalog-native.mjs --types <comma-separated-types> --out
/fresh/directory` checks an explicit affected scope in all three formats using
maximum-length copy by default (`--normal` selects ordinary copy). It measures
real one-line height, full DOM retention and optional title consistency,
typography and available
ellipsis width across motion samples and exact reverse seeks. This focused
gate complements the full catalog's surface, clipping and collision checks;
an inventory entry alone is not evidence of a successful native test.

Receipts record the actual tested source hash and whether source remained
unchanged throughout the run. The before/after gallery keeps copy, font,
brand and animation time identical. It includes unchanged non-UI components
so the complete catalog can be reviewed rather than only favourable examples.

## Motion comparison

`tools/surface-motion-demo.json` is a fixed eight-scene comparison recipe.
Its chapter file records the exact baseline and current revisions, timings,
and sound-event parity. The selected scenes exercise expanding surfaces,
nested menus, multiline typing, scrolling single-line input, dragged cards,
badges, nested miniature screens, and a scaling selection card. This motion
reel complements the full 105-type catalog gate; it does not replace it.

Both revisions are built from isolated `git archive` source trees. Only the
aspect differs between the three formats. Run each tree's `film.cjs fit`,
verify identical plans/sound marks, generate the matching native soundtrack,
then use the pinned HyperFrames 0.9.19 CLI for checks and full-resolution
30 fps rendering. Do not modify the baseline to hide its layout defects.

Given the six native exports named `before-9x16.mp4`, `after-9x16.mp4`, and
likewise `1x1` and `16x9`, generate the comparisons and portable viewer:

```sh
python3 tools/surface-motion-compare.py --media-dir /path/to/motion \
  --source-receipt tools/surface-motion-acceptance.json
node tools/surface-motion-gallery.mjs --manifest /path/to/motion/manifest.json
```

Comparisons place complete, uncropped frames together in one video stream,
with one copy of the shared soundtrack. The viewer has chapter navigation,
half-speed playback, and separate full-resolution before/after views that
retain the current time. Links accept `?format=9:16&view=after&t=16.5`.
Serve the output directory with HTTP byte-range support for reliable seeking.
The output `REVIEW.md` and integrity receipts state the actual verification
scope and remaining visual limitations.

The source receipt must identify both source hashes and bind all six originals
to their SHA256 hashes. A new render needs its own receipt; an older receipt
cannot silently label different video bytes as the original revision.

`tools/surface-motion-regressions-native.mjs` specifically checks single-line
filename truncation, original text retention and visible bounds/gaps during
the drag animation, and mutually exclusive scan status text.
It samples each encoded-frame time and the scan handoff at finer intervals,
then repeats the same seeks backwards. Run it with `--out /fresh/directory`;
`--source` can target a frozen earlier revision to demonstrate that the same
checks reject the original defects. These focused checks complement surface
tokens and sampled catalog tests, which alone did not catch both problems.

The ellipsis fitter gate also rejects fake overflow markers, wrapping, hidden
second lines and flex containers where the browser does not paint an ellipsis.
It preserves the complete label footprint for camera fitting; ancestor clipping
and off-frame placement remain visible to the audit. Short and long filename
fixtures must produce the same scene fit, without reducing the shared font size.

The catalog-wide delivery receipt is `tools/ellipsis-acceptance.json`. It binds
the 45-type, three-format normal/maximum matrices, dense motion/reverse checks,
typing, canvas and HUD canaries to their tested source hashes. The final chart
and dense pricing corrections have scoped native reruns; unchanged files and
functions are checked byte-for-byte, rather than relabeling earlier reports as
tests of a later source. The gallery records each image's actual source and
retains original images when a scoped correction replaces a frame.
