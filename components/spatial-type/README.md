# Spatial Type

A portable, editable native HyperFrames kit for extruded reflective words,
deterministic fragment fields, perspective camera travel and moving letter
slabs. Start with [USAGE.md](USAGE.md) and edit [recipe.mjs](recipe.mjs).

The implementation extracts successful mechanisms from the independently
reviewed r8 nine-second spatial reconstruction: procedural reflection studio,
bevelled glyph geometry, shaped chrome normals, plane-clipped letter pieces,
instanced shards, additive flares/rays, deterministic subframe accumulation
and bloom/grade. It replaces film-specific constants with a pure configurable
model. It contains no reference footage/audio or hardcoded benchmark words,
source timestamps, HUD or complete nine-second preset.

- `lib/model.mjs`: validation, keyframes, seeded fragment data and pure poses.
- `lib/geometry.mjs`: glyph meshes, cap-height layout and moving clipped slabs.
- `lib/materials.mjs`: r8-derived reflective studio and material/flare helpers.
- `lib/world.mjs`: instance-owned scene, camera, field and postprocessing;
  `createSpatialType()` returns `seek`, `resize`, `inspect`, `dispose`.
- `native.mjs`, `spatial-type.html`: native seek adapter and installable definition.
- `recipe.mjs`: different words, blue style, six-second timing and camera path.
- `build.mjs`: standalone native proof builder; never overwrites existing work.
- `model.test.mjs`: CPU tests. Native visual acceptance is separate and is
  recorded by the repository's probe/acceptance workflow.
- `assets/type`: full bundled subset geometry, original WOFF2, OFL notice,
  source and generation hashes. `tools/font_geometry.py` reproduces it.
- `vendor`: pinned Three.js 0.170.0 with MIT license, GSAP 3.14.2 with retained
  upstream notice; nested SOURCE.json files identify borrowed code/assets.

One world persists across continuous phases. The engine derives every pose
and shader value from explicit scene time; no autonomous clock or previous
frame is required. The neutral example proves reuse, not reference parity.
Its lighting, density, blur and path still need art direction for each brief.
