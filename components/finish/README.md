# Finish

The look of the picture as a whole, laid over a page and driven by time: film
grain, a chromatic fringe that swells on the hits of the music, a vignette,
flashes of a frame or two, bursts of camera shake and a slow light leak. Every
part is optional and every frame is a pure function of time, so a still equals
the render and two renders are the same file. How to use it:
[USAGE.md](USAGE.md).

- `finish.mjs`: the whole component. The pure part (`grainAt`, `shakeAt`,
  `flashAt`, `fringeAt`, `leakAt`, `burst`, `createFinish`) needs no page and
  is tested in Node (`kit/tools/finish.test.mjs`); `mountFinish` is the
  page's side.

Ours, written from scratch (`SOURCE.json`).
