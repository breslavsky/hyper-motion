# Pure Kinetic's scenes in another film

This folder is the whole kit: the scenes of Pure Kinetic (liquid glass panels,
kinetic type, charts, a 3D phone and the rest), their compiler and their
fonts. One scene of it can stand in any HyperFrames film as a native
sub-composition. Nothing else of the Pure Kinetic template is needed, and
nothing is installed from the network.

The film keeps its own page, scenes and soundtrack. A scene of the kit is
one more clip on it.

## Build a scene

Run in the project's `source/` folder, where `index.html` is. `<kit>` is this
folder's path from there.

```sh
node <kit>/scene.cjs --list            # every scene, by family
node <kit>/scene.cjs --list search     # one scene: its fields and a recipe that works
node <kit>/scene.cjs recipe.json       # build it ("-" reads the recipe from stdin)
```

A recipe is a film of one scene:

```json
{"id": "glass-search", "aspect": "9:16", "style": "editorial", "material": "glass",
 "brand": {"name": "Nook"}, "start": 4.5, "track": 3,
 "scene": {"type": "glass-search", "beats": 6, "query": "Tuesday classes"}}
```

- `id`: the composition's name, lowercase letters, digits and hyphens. Two
  scenes of one film have different ids.
- `scene`: the scene, with the fields `--list <type>` shows. Its length is
  `beats`; a beat is `60 / bpm` seconds.
- `aspect`: the film's own, `9:16`, `1:1` or `16:9`.
- `start`, `track`: where the clip begins in the film, in seconds, and its
  HyperFrames track.
- `style` (the look), `material` (`glass`, `dark-glass`, `metal`), `brand`
  (`name`, `tokens` with the film's background, foreground and accent,
  `font`), `bpm`, `pace`: as in Pure Kinetic's film. Give the film's own
  colours in `brand.tokens` so the scene belongs to it.

A recipe the kit cannot draw is refused with the reason, and nothing is
written.

### A glass scene over the film's own footage

A film that already has footage on a track (a talking head, b-roll) lays a
glass scene over it as it lays any graphic: give the scene `"over": true`, no
`background`, and where its panel stands.

```json
{"id": "like", "aspect": "9:16", "style": "editorial", "material": "dark-glass",
 "brand": {"name": "Nook"}, "start": 12.5, "track": 3,
 "scene": {"type": "glass-like", "beats": 6, "over": true, "place": "bottom-right", "size": "small", "text": "Like"}}
```

The scene then draws only its glass on a clear frame: the footage plays on
under it, with its own sound, and is seen frosted through the pane. Put the
clip on a track above the footage. `dark-glass` reads best over a busy
picture. The glass does not bend the footage at its edge in this mode; that
needs the scene to be given the picture itself (`background`).

## Put it on the page

The command writes `compositions/pk-<id>.html` and the scene's emoji into
`assets/emoji.json`, and prints:

- `head`: two style sheets. Add them to the page's `<head>` once.
- `mount`: the host element. Put it among the film's clips as printed; the
  scene's settings travel in its attributes.
- `duration`: how long the clip is, with the half beat it rings out for.
- `sounds`: the scene's own cues (`click`, `type`, `whoosh`, `chime`...) with
  their times in the film. The kit plays nothing: give them to the film's
  soundtrack, or leave the scene silent.

The page must have GSAP as `window.gsap`, as HyperFrames films do. Build the
scene again after changing its recipe; do not edit the written file.

## What it does not do

- It does not check the film around it: text of the film's own scenes that
  the clip covers, or a clip that runs past the film's end, are the film's.
- A scene's sound is not mixed in.
- `background` pictures and videos of the glass scenes are paths from the
  page, so they must be files of this project.
