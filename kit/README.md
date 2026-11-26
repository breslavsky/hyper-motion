# The kit

A film is written as data and compiled into native HyperFrames compositions.
You write `source/film.json`; the kit lays every scene out, measures its text
so nothing overflows, and writes the page HyperFrames renders.

## A film in three commands

Node 22.12 or newer. From this folder:

```bash
pnpm install --frozen-lockfile                              # the pinned HyperFrames (0.9.19)
(cd source && node lib/film.cjs fit)                        # check film.json, then write index.html and compositions/
node_modules/.bin/hyperframes render source -o film.mp4     # the video
```

`node_modules/.bin/hyperframes preview source` opens the same film in the
HyperFrames studio.

`source/` here is a film of seven scenes: start from its `film.json`.

## film.json

```json
{
  "aspect": "9:16",
  "style": "poster",
  "music": {"bpm": 128},
  "scenes": [
    {"type": "slam", "beats": 4, "lines": ["AN AI", "MOTION DESIGNER"]}
  ]
}
```

- `aspect` is `9:16`, `16:9` or `1:1`; `style` is one of the 44 looks.
- A scene has a `type`, a length in `beats` (at the film's tempo) and the
  fields of its type: its words, numbers, pictures.
- `brand` gives a film its own name, font and colours.

What a film may hold, scene by scene, with every limit:

```bash
node source/lib/scene.cjs --list                 # the scene types by family
node source/lib/scene.cjs --list glass-steps     # one type: its fields and a recipe that works
```

`node lib/film.cjs` without a command checks the film and says what is wrong
in words: the scene, the field and the limit it broke. `fit` does the same
and then builds. A film that fails its check is not built.

## One scene for a film of your own

A HyperFrames film made by other means can take a single scene of the kit as
a sub-composition:

```bash
node source/lib/scene.cjs recipe.json            # writes the composition, prints how to mount it and its sound cues
```

## A project of your own

`source/lib` is the whole kit and needs nothing outside itself. Copy it into
your project's folder beside your `film.json` and run `node lib/film.cjs fit`
there. Pictures and videos a film names are paths inside that folder.

## What else is here

- `AGENTS.md` is the writing guide for an agent that fills in `film.json`:
  every scene type in one line each, and the rules of a good film. It is
  written for Motion Fab's agent, so its commands for sound and publishing
  (`harness ...`) are that product's; the parts about `film.json` hold
  anywhere.
- `source/music.py` writes the demo's soundtrack with Motion Fab's sound
  library and does not run without it. The kit itself says when each sound
  belongs: `node lib/film.cjs plan` prints the film's length, tempo and sound
  cues as JSON, and any mixer can use them.
- `tools/` holds the tests and acceptances (`tools/README.md`).
- `MAINTAINING.md` is for whoever adds or changes a scene here: one factory a
  component, the Glass rules, a card for every scene. A film's writer never
  gets it.
- `MIGRATION.md` and `SURFACES.md` are design notes: how the scenes became
  native compositions, and how the surfaces of the UI scenes are built.
