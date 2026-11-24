# Lens Wall for HyperFrames

An endless wall of a film's own photos and videos under a lens, with a camera
that travels to the pictures the film names and opens each to the full frame.
Ours, written from scratch (`SOURCE.json`): no third-party code.

Agents find it in the shared catalogue as the kit `lens-wall`
(`references/hyperframes/registry_search.py --install lens-wall`) and build a
wall from a recipe with `build.mjs`; `USAGE.md` is their guide and says what a
recipe holds.

## How it is made

- `wall.mjs` is the whole component. `plan(recipe)` checks a recipe and lays
  out the camera's route; `stateAt`, `tilesAt` and `openRect` say, for a time
  of the scene, where the camera is, where every tile stands under the lens
  and what rectangle an opened picture takes. They are pure and run in Node.
  `mount` paints that on one canvas from a GSAP clock's setter, so a seek in
  either direction draws the same frame.
- The lens is a radial map of the wall: a point `u` pixels from its centre
  lands `u + (m - 1) r (sqrt(pi) / 2) erf(u / r)` pixels from it. Each tile is
  drawn under the map's Jacobian at the tile's centre, so tiles neither
  overlap nor leave gaps, and the source picture is sampled at the size it
  is shown: the centre is sharp.
- A video plays in its tiles. HyperFrames plays only media that is in the
  markup, which is why the wall is a kit with a builder and not one fixed
  composition: `build.mjs` declares one muted `<video>` input per video for
  the whole scene, and `wall.mjs` paints its frame into a canvas of the
  tile's shape (`videoSource`): from the element in a preview, from the image
  HyperFrames puts beside it in a render, repainting on `hf-seek`. A stop
  that opens a video has a `<video class="clip">` of its own for its time;
  the builder refuses a stop longer than its video (ffprobe).
- The wall's seven example videos are loaded from our public CDN: the
  component is handed to others, so what it needs beyond its code comes by
  address (`PUBLIC`, `EXAMPLES`, `PLACES`, `examplesFor` in `wall.mjs`:
  `https://motion-fab-share.b-cdn.net/components/lens-wall/a1.mp4` ... `a7`).
  The files are in the share bucket (`motion-fab-share`, a Bunny zone with a
  pull zone; uploaded by hand, settings outside the repository). They are 720
  px on the short side, six seconds, H.264, no sound, a keyframe a second. A
  film's own files take the examples' places one by one; seven leave none.
- Captions follow `design/norms.json`: body size, a tenth larger in a tall
  frame, above what the app draws over the bottom of one.

## After a change

```sh
node --test components/lens-wall/model.test.mjs
python components/lens-wall/tools/catalog.py     # the kit's sums in the catalogue
uv run pytest -q tests/test_lens_wall.py
```

A kit whose sums are behind is left out of the catalogue, and
`tests/test_lens_wall.py` fails.
