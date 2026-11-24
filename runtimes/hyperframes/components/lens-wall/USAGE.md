# Lens Wall

An endless wall of the film's own photos and videos under a lens: whatever is
under the lens swells to three times its size, the rest curves away like the
side of a sphere. The camera crosses the wall on one of a few paths, and the
videos play in their tiles; it can also travel to the pictures the film names,
stop on each and open it to the full frame. Use it for a gallery, a trip, a
portfolio, a catalogue, "all of this year in one shot".

The wall has seven example videos of its own (a neon street, an arcade, old
screens, a city, a disco ball, a dance). A recipe with no `media` plays them.
The film's own files take their places one by one: three of the film's play
among four examples, and seven or more leave none. So give the wall every
file the user has for it, and do not tell the user the examples are theirs.

It is one more clip of the film: a native sub-composition on a canvas, drawn
from the scene's time alone, so it seeks backwards and renders the same every
time. It uses the page's own GSAP.

## Build a wall

Run in the project's `source/` folder, where `index.html` is. `<kit>` is this
folder's path from there.

```sh
node <kit>/build.mjs recipe.json       # "-" reads the recipe from stdin
```

```json
{"id": "trip", "width": 1080, "height": 1920, "duration": 12, "start": 4, "track": 2,
 "media": ["assets/photos/harbour.jpg", "assets/photos/market.jpg", "assets/photos/tram.jpg",
           {"src": "assets/video/surf.mp4", "from": 2}],
 "stops": [
   {"media": 2, "at": 2.2, "open": 2.4, "caption": "Saturday market"},
   {"media": 3, "at": 6.4, "open": 0},
   {"media": 4, "at": 8.6, "open": 3.4, "sound": true}
 ]}
```

It writes `compositions/lw-<id>.html` and prints JSON: `mount` (the element
to put inside the root composition as it is), `duration`, `examples` (the
wall's own videos it added, by their addresses), `stops` (when the camera arrives at each and
when each opens and closes, in the film's time) and `cues` (the moments worth
a sound: `travel` with its length, `arrive`, `open`, `close`). A recipe it
refuses writes nothing and says on stderr what to change. Build again after
any change to the recipe.

## The recipe

- `id`: the wall's name, lowercase letters, digits and hyphens. Two walls of
  one film have different ids.
- `width`, `height`: the film's frame. `duration`: the scene's length in
  seconds. `start`, `track`: where the clip begins in the film and its
  HyperFrames track.
- `media`: the film's files for the wall, as paths from `source/`, 60 at
  most, of them 8 videos at most. A path alone or `{"src", "from"}`. Left out
  or shorter than seven, the wall's examples fill the places left. The wall
  repeats its files without end. A video plays in its tiles, muted and in a
  loop, from `from` seconds (0 unless given).
- `stops`: where the camera goes, in order. Without stops it only drifts.
  - `media`: which file, by its number in `media`, from 1.
  - `at`: the second of the scene the camera arrives, centred on the picture.
    It leaves `travel` seconds earlier (1.2 unless given), so `at` minus
    `travel` cannot be before the stop before it has ended.
  - `hold`: seconds it rests before the picture opens (0.35).
  - `open`: seconds the picture stays open, the growing and the shrinking
    included (2.5). `0` only stops on it. A stop that ends with the scene
    stays open: the wall's last frame is that picture.
  - `fit`: `cover` fills the frame, `contain` shows the whole picture on the
    dimmed wall. Left out, a picture that would lose more than a quarter of
    itself to the frame is shown whole.
  - `sound`: `true` keeps an opened video's own sound. Otherwise it is muted.
  - `caption`: one line over the opened picture, 28 characters at most, in
    the page's font.
  - `close`: `false` leaves the picture open until the stop ends, with no
    shrinking back.
- `tile`: `{"width", "aspect", "gap", "radius"}`. `width` is a tile's width
  on the flat wall in pixels (about a tenth of the frame's short side);
  `aspect` is `2:3` unless given (`1:1`, `3:4`, `16:9`...). Every picture is
  cropped to it around its middle.
- `lens`: `{"x", "y", "radius", "magnify"}`. `x`, `y` place its centre as
  shares of the frame (0.5, 0.5); `radius` is its size as a share of the
  short side (0.22: a small lens on a wide wall; 0.4: a soft bulge);
  `magnify` is how much larger the centre is (3).
- `path`: how the camera crosses the wall while it goes to no stop: `drift`
  (a straight glide, the default), `orbit` (a circle), `wave` (a glide that
  sways), `eight` (a figure of eight), `zigzag`. A wall with no stops is only
  this movement, which is often all a scene needs.
- `drift`: `[right, down]` in tiles a second: the direction the path leaves
  in and its speed (`[0.22, -0.08]`). A camera going round (`orbit`, `eight`)
  wants more, about `[0.75, 0]`. `[0, 0]` stands still.
- `stagger`: `true` shifts every other column by half a tile.
- `dim`: how much the wall darkens away from the lens, 0 to 1 (0.5).
- `background`: the colour between the tiles, `#rrggbb`.

## What to know

- An opened video plays from `from` for `open` seconds, apart from its tile:
  the builder refuses a stop longer than its video.
- The examples are loaded from the component's public address
  (`https://motion-fab-share.b-cdn.net/components/lens-wall/`); the builder
  adds them itself. They are the only thing the wall loads from the network,
  and a wall of seven or more of the film's own files loads nothing.
- A stop's picture is under the lens's centre, so keep the lens where the
  frame is free: in a tall frame with words above, lower `lens.y`.
- The scene's first frame is the wall already full. Give the film's sound the
  `cues`: a soft whoosh on a `travel`, a click or a pop on an `open`.
- Check it as any scene: `harness check`, then frames at an `arrives`, in the
  middle of an opening and with a picture open.
