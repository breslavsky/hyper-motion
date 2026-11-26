# Finish

The last layer of a film: what a lens, a film stock and a hand do to the
picture as a whole. Grain over everything, the colours standing a little
apart, darker corners, a white or black frame on a hit, the frame thrown about
for a quarter of a second, a warm light that wanders through. Use it when a
clean page looks too clean, and to make the hits of a track felt in the
picture itself.

It draws nothing of the film: it is laid over what the page already shows.

## On a page

`<kit>` is this folder's path from the page.

```html
<div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="6" data-fps="30">
  <div id="stage" data-finish style="position:absolute;inset:0;background:#10141a">
    <h1>Everything the film shows</h1>
  </div>
</div>
<script type="module">
  import {mountFinish} from './<kit>/finish.mjs';
  const tl = window.__timelines.main;            // the page's own paused GSAP timeline
  mountFinish(document.getElementById('root'), {
    width: 1920, height: 1080, fps: 30, duration: 6, seed: 3,
    grain: 0.1,
    vignette: 0.3,
    flashes: [{t: 1, frames: 2, kind: 'white'}, {t: 4, frames: 1, kind: 'black'}],
    shakes: [{t: 2, d: 0.25, amp: 0.012}, {t: 4.5, d: 0.25, amp: 0.02}],
    hits: [2, 3, 4.5],
  }).attach(tl, 0);
</script>
```

The element with `data-finish` (else the root's first child, or the `target`
option) is what shakes and takes the fringe: put everything the film shows
inside it, and give it a background of its own, so the colours part over a
whole picture. The grain, the leak, the vignette and the flash are laid over
the root, after everything else, and take no clicks.

Times are seconds from the layer's start. `flashes`, `shakes` and `hits` have
the shapes of the reference map's events (`flashes` `[{t, frames, kind}]`,
`shakes` `[{t, d, amp}]`, `hits` `[t]`), so a page passes them straight in.

## The parts

Each is there unless turned off with `false` or 0, except the three lists and
the leak, which are there when given.

- `grain`: how strong, 0.1 unless given. 0.1 is felt more than seen; 0.3 is
  heavy, a look of its own. Or `{amount, size, hold, blend}`: `size` the px of
  the frame one grain takes (2 at 1080 on the short side), `hold` the frames a
  grain stays (1; 2 for a film on twos), `blend` how it is laid on
  (`soft-light`, which leaves pure black and pure white alone; `overlay` is
  harder).
- `fringe`: how far the red and the blue stand from the green at rest, as a
  share of the width: 0.001 unless given, 1 px at 1080 wide. Or `{rest, hit,
  decay}`: on each of `hits` the distance grows by `hit` (0.003) and dies
  away in `decay` seconds (0.3). `{rest: 0}` is a fringe on the hits alone.
- `vignette`: how dark the corners are, 0.3 unless given (0.2 to 0.45). Or
  `{amount, inner, color}`: `inner` is how far from the middle the darkness
  begins, as a share of the way to a corner (0.45).
- `flashes`: `{t, frames, kind}`: `frames` whole frames (1 to 3; 1 unless
  given) of `white` or `black` from the frame `t` falls on. `amount` (1) for
  a flash that lets the picture through.
- `shakes`: `{t, d, amp}`: from `t`, for `d` seconds (about 0.25), the frame
  is thrown `amp` of its width at most (0.005 a tremble, 0.012 a hit, 0.03 a
  blow; a tenth is refused). The throw changes every frame, or every `step`
  frames (`step: 2`); how far it goes rises fast and dies away slowly, with
  no corner at either end. `cover` (true): the target grows just enough under
  a shake that its edges never come into the frame.
- `hits`: the moments the fringe swells. The key hits of the track, not every
  beat.
- `leak`: `{amount, color, rate, size, seed}`: a warm light that wanders
  slowly through the frame; `amount` 0.2 is plenty.
- `seed`: what the grain and the shakes are hashed from. Another seed,
  another grain; the same seed, the same film.

## What it gives back

`mountFinish` returns `draw(l)` (draw the finish of a moment by hand),
`at(l)` (its state: `frame`, `grain`, `fringe`, `shake` `{x, y, reach}`,
`flash` `{kind, amount}`, `vignette`, `leak`) and `attach(timeline, start)`.

It refuses, in words, a missing duration or size, a flash or a shake with no
time, a flash that is neither white nor black, a shake with no length or one
that throws the frame more than a tenth of its width, and a hit that is not a
time.

## With a camera

The finish moves its target with the element's own `translate` and `scale`
and sets its `filter`; the camera component owns `transform` and `filter` of
its world. Keep them on two elements: the finish's target outside, the
camera's world inside it.

```html
<div data-finish style="position:absolute;inset:0">
  <div id="world">…</div>
</div>
```

## What it does not do

- The fringe is one shift across the whole frame, not a lens that is sharp in
  the middle. The outermost pixels of the target lose a colour (2 px at rest
  at 1920 wide, more on a hit): let the target overhang the frame by a few px
  (`inset:-12px`) when its edge is light.
- The fringe and the shake are for one element. A `filter`, `translate` or
  `scale` the target already has is replaced.
- The fringe filters the whole target on every frame: the costly part.
  `fringe: false` when the film is heavy; the grain (one small canvas), the
  vignette, the leak and the flash cost next to nothing.
- No blur, no bloom, no colour grade, no scratches or dust. No motion blur of
  the shake.
- It adds no sound: a flash or a shake wants its hit in the track.

## In a scene of the kit

`finish.mjs` also has the pieces by themselves, with no page: `grainAt`
(the grey values of a frame's grain, for any painter), `shakeAt`, `flashAt`,
`fringeAt`, `leakAt`, `burst` (the envelope of a shake and of a hit) and
`createFinish`.

## Events from a reference video

A film made after a reference video takes that video's own flashes, shake
bursts and hits. `node <kit>/events.mjs <reference map .json> --start S
--duration D` prints them counted from the finish's start, in the shapes
`mountFinish` takes, from the map `harness reference-map --json` writes. A
shake larger than a finish allows comes back at the most it shakes.
