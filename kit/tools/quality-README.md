# Native quality probes

Run these from the template directory. They use the pinned HyperFrames 0.9.19
renderer through `migration-browser.mjs`, copy source before a run, and block
external requests. Every report includes the tested source hashes. Reports
retain failures and exact inputs; screenshots are diagnostics, not golden images.

```sh
node tools/quality-layout.mjs --self-test --out /tmp/pk-quality-measurement
node tools/quality-fonts.mjs --out /tmp/pk-quality-fonts
node tools/quality-cards.mjs --out /tmp/pk-quality-cards
node tools/quality-layout.mjs --scenes between,arc,slam,icon3d,scatter,flip --out /tmp/pk-quality-copy
node tools/quality-wide-copy.mjs --out /tmp/pk-quality-wide-copy
node tools/quality-contrast.mjs --out /tmp/pk-quality-contrast
node tools/quality-on-accent.mjs --out /tmp/pk-quality-on-accent
node tools/quality-sky-contrast.mjs --out /tmp/pk-quality-sky
node tools/quality-append.mjs --out /tmp/pk-quality-append
```

`quality-layout.mjs` also accepts `--aspects`, `--font`, `--look`, and
`--content sample|max`. Maximum-copy fixtures keep icons as icons and preserve
an active replacement word in marked text. The default run covers twelve
families; it is a diagnostic matrix, not a promise that every possible input
in the complete catalogue passes.

## What is measured

- Font size is measured after scene fitting, camera scale and native transforms.
  An untransformed specimen of the same loaded font calibrates each DOM Range.
  The floor is the plan's label size: 36px on a 1080px short side, 39.6px in
  portrait. The measurement tolerance is 0.5px.
- Canvas glyph ascent/descent and an actual baseline marker turn reserved font
  rectangles into painted-ink rectangles. Tall font metrics alone are neither
  collisions nor clipped content. The native self-test proves this and also
  proves a real collision is caught.
- At least 98% of each visible text's ink area must survive rectangular clipping;
  frame and safe-boundary measurements allow 1px. Distinct label ink overlaps
  greater than 2px in both axes are reported. Deliberate glyph kerning within
  one text block is excluded; collisions across glyph-based blocks are checked.
  Explicit
  component-local `data-over` annotations are respected. Native
  `data-layout-allow-overlap` annotations are ignored here: the inherited DOM
  helper emits them on every node, so they do not prove overlap is intentional.
- A persistent defect is the same DOM text node at two distinct sampled times,
  not two labels with equal copy in one frame. All individual findings remain
  in the report. Explicitly hidden pages and low-opacity entrance/exit states
  are excluded from the settled-copy assertion.

The text walker excludes declared decoration/echoes, SVG artwork, rolling digit
strips, and miniature mock/device-screen UI. It does not certify device-screen
CTA legibility or text painted into Canvas/WebGL assets. Opacity below 0.75 is
treated as a transition/secondary state. Collision geometry uses per-line
rectangles; it is not per-pixel intersection of arbitrary rotated glyph shapes.

## Regression scope

`quality-cards.mjs` checks 42 scene cases: three formats, two fonts, and seven
instances (connect with two/three/four sources, winner, tabs, steps, endcard).
It verifies real Geist Mono metrics, copy visibility, reverse-seek DOM and
geometry, connection-arrival sound events, sibling clock isolation and private
SVG identifiers.

`quality-fonts.mjs` compares native glyph width and ink metrics with a direct
FontFace from the corresponding bundled file. Its 21 cases cover four families,
Latin/Cyrillic/Arabic, and weights 400/700 where supported. Font-file hashes are
included. `document.fonts.check()` alone cannot detect composite-face fallback.

`quality-wide-copy.mjs` checks native content overrides at the full written
between/flip bounds: three formats, two looks, two real fonts, ordinary Cyrillic
phrases and unbroken wide letters (48 cases). Saved film fixtures remain English.
The report explicitly tests the audio-rebuild signal for native copy edits;
these typography probes do not certify an unchanged mixed soundtrack.
This proof replaces the former 9-character `between.lead` and 4-character
`flip.words[]` non-Latin limits; both now use their written 16/18-character
bounds. Other measured field limits remain unchanged.

`quality-append.mjs` checks every rolling word after its entrance, including
descenders, in three formats with the default font, Geist Mono and Archivo.
Its 18 cases cover sample and maximum copy, whole font line boxes inside the
mask, ink bounds, readable type, and exact reverse-seek DOM/geometry. The
six-word maximum fixture supplies 14 beats so each word has a settled hold;
this does not certify six long words as readable in the sample's four beats.

The pytest wrappers are in `tests/test_pure_kinetic_quality.py`. These probes add
edge coverage to existing native acceptance; they do not replace its clock,
render or complete-film checks. Sampled geometry does not certify reading time,
contrast, every animation frame, or overall motion-design quality.

The separate contrast probes measure native composited surfaces. `quality-contrast`
covers glass and endcard materials; `quality-on-accent` covers dark/white ink
selection (including the real coral regression), native reuse and CTA shine;
`quality-sky-contrast` covers implicit text on a sky gradient, explicit scene and
brand colors, native style/token edits and token removal in three formats.
Explicit low-contrast user choices remain explicit and visible in the receipts.
