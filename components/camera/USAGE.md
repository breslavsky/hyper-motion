# Camera

One camera over a page that is one world. Everything the film shows lies on
one sheet, larger than the frame if it needs to be, and the camera is the one
transform of that sheet: it goes from one thing to the next without a cut,
closes in, stands back, turns a little, takes the hits of the music and blurs
by its own speed. Use it when a film is one place looked at part by part: an
interface, a board, a page, a map of ideas, a long line of text.

It is not a 3D camera: nothing has depth. A scene with real depth has its own
(Spatial Type, the Glass scenes).

## On a page

`<kit>` is this folder's path from the page.

```html
<div id="world" style="position:absolute;left:0;top:0;width:3200px;height:1800px">
  <h1 data-cam="title" style="position:absolute;left:240px;top:200px">One page. One camera.</h1>
  <div data-cam="chart" style="position:absolute;left:1700px;top:520px;width:620px;height:380px">…</div>
  <button data-cam="button" style="position:absolute;left:2500px;top:1250px">Export</button>
</div>
<script type="module">
  import {mountCamera} from './<kit>/camera.mjs';
  const tl = window.__timelines.main;            // the page's own paused GSAP timeline
  mountCamera(document.getElementById('world'), {
    width: 1920, height: 1080, duration: 8,
    stops: [
      {at: 0,   look: 'title',  fill: 0.7},
      {at: 2,   look: 'chart',  fill: 0.8, roll: -3},
      {at: 4,   look: 'button', fill: 0.35},
      {at: 7.4, look: 'all',    fill: 0.9},
    ],
    hits: [0.5, 1, 2.5, 3, 4.5, 5],
    life: {amount: 5, seed: 2},
  }).attach(tl, 0);
</script>
```

Lay the world out with plain positions (`left`, `top`, flex, grid). Do not
put a transform on the world itself: the camera owns it. Things inside may
have their own transforms and their own animations on the same timeline.

## Stops

A stop is where the camera is at a moment, `at` seconds from the camera's
start. It holds there until it must leave for the next one.

- `look`: what to look at. A name (`data-cam="name"` on an element), an
  element, a rectangle `{x, y, w, h}` of the world, or `'all'`: everything
  that has a name.
- `fill`: how much of the frame the thing takes, 0.8 unless given. The thing
  is always whole in the frame.
- `zoom`: a zoom given outright instead of `fill`. `x`, `y`, `zoom` without
  `look` is a pose given outright.
- `roll`: a turn in degrees. Small ones: 2 to 5.
- `move`: how many seconds the way to this stop takes. By default most of the
  time since the stop before, 1.2 s at most.
- `pull`: how far the camera stands back in the middle of the way, 0.1 of its
  zoom unless given; 0 for a straight push.

Every way speeds up and then slows down.

## What rides on the way

- `hits`: moments, in seconds, when the camera takes a hit: the zoom jumps by
  `punch` (0.04) and comes down in `decay` seconds (0.3). Give it the key hits
  of the track (`harness track-map`), not every beat.
- `life`: `{amount, rate, seed}`, the wander of a hand that holds the camera,
  `amount` in px (4 to 8 reads as alive, 0 is a tripod).
- `blur`: seconds of shutter, 0.0025 unless given: the faster the camera
  goes, the more the picture blurs; on a stop there is none. 0 for no blur.

## What it gives back

`mountCamera` returns `draw(l)` (set the camera for a moment by hand),
`at(l)` (the camera's state: `x`, `y`, `zoom`, `roll`, `speed`, `blur`),
`seen(state, x, y)` (where a point of the world stands on the frame) and
`attach(timeline, start)`.

It refuses, in words, a stop that names nothing on the page, a stop that is
not after the one before, and a thing with no size.

## In a scene of the kit

`camera.mjs` also has the pieces by themselves, with no page: `lookAt`,
`travel`, `cameraPath`, `kick`, `drift`, `createCamera`. The `ride` scene
takes its way between two controls from `travel`.
