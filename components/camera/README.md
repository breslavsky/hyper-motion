# Camera

The camera of the `ride` scene, taken out so that any page and any scene can
have it: one world, one transform, a way through stops, the hits of the
music, a hand's life and the blur of its own speed, every frame a pure
function of time. How to use it: [USAGE.md](USAGE.md).

- `camera.mjs`: the whole component. The pure part (`lookAt`, `travel`,
  `cameraPath`, `kick`, `drift`, `createCamera`) needs no page and is tested
  in Node (`kit/tools/camera.test.mjs`); `rectIn` and `mountCamera` are the
  page's side.
- The kit carries a byte copy (`kit/source/lib/components/camera/`), written
  by `kit/tools/sync-camera.cjs`; the test fails when they differ.

Ours, written from scratch (`SOURCE.json`).
