# Maintaining the kit

For whoever adds or changes a scene of the kit, in this repository. It is not
part of the guide a film's writer gets (`AGENTS.md`, written by
`tools/kinetic/guide.py`): a writer who was told how scenes are added wrote
nine of their own into a project's copy of the kit instead of using the
hundred and twenty-four that are there. A film is written in `film.json`
alone; the kit is changed here.

Use one factory per component across looks and materials. Keep its layout,
typography, geometry and timeline together. When porting a component, replace
the old factory and point its existing Storybook examples at the shared one.
For 3D Liquid Glass components, follow the [optical glass rules](source/lib/components/README.md#optical-glass)
for card spacing, projected text, camera, brand defaults and materials.
When adding or changing any Glass scene, follow the [text sharpness rules](source/lib/components/README.md#text-sharpness)
and run their native pixel checks. Local effects keep lettering sharp outside their footprint.
Every scene type has a card in `source/lib/components/cards.json`, written with
the scene: `shows`, what the viewer sees, in one sentence with no fields or
limits, and `for`, two to five kinds of shot it is a start for, in the words
somebody planning a film would use ("a customer quote", "an end card"). A
search and a model choose scenes by the cards, so write them for a reader who
has not seen the scene.

## Where a scene's code lies

A scene of the Pure Kinetic section has a file of its own, `source/lib/components/scenes/<folder>/<type>.mjs`,
in the folder `components/folders.json` puts it in by what the viewer sees (words, sentences, screens,
controls, data, pictures, brand, shapes). The file exports `factory`, or `create(K)` for a scene built
over the kit's context. Its `family` in `catalog.json` is its folder. What several scenes use lies in
`scenes/_shared/`, named by what it is; what one scene uses lies in that scene's file. After adding or
moving a scene run `node kit/tools/scene-files.cjs --write`: the kit imports every scene at once, by
name, from the list that writes (`scenes/folders.mjs`), because a module asked for when a scene mounts
arrives a moment later. Glass, 3D, Kinetic Text and `ride` have files of their own kind and are not in
the folders.

A scene written from a community technique starts the same way: `tools/technique.py new <technique>
<scene> --into <folder>` writes its stub into the folder's own file and adds it to the folder, the
catalogue and the list. `node source/lib/scene.cjs --list` names the scenes as the folders do, and the
scenes outside them by their section.

To check a change that must not change a frame, render the scene alone, lightly
(`hyperframes render source -w 2 -q draft`), before and after: one scene on two workers is the same
file twice, a film of many scenes on eight workers is not.

## When the moments of a scene happen

A scene says **when** its moments happen in beats of the film and **how long**
a move takes in seconds. The moments it sounds on (a card lands, a word
changes, a hit) are reckoned once, and both its picture and its sounds read
them from there, so they cannot part:

- a scene with a definition of its own (`components/metadata.cjs`): in its
  `times(scene, len, beat)`, called by its `build` and its `sounds`;
- any other scene: in `components/scene-moments.cjs` (`MOMENTS`, or `marks`
  for parts that land in a row), read by the scene as `p.at` / `p.marks` and
  by its sounds in `compiler/plan.cjs` (`SOUNDS`, fourth argument).

`components/beat-grid.cjs` has the three ways to say a place on the beats
(`onBeat`, `nearBeat`, `lastBeat`). The accent of a scene goes on a whole or
half beat; a run of small things is a fraction of a beat apart; when the
accent is the end of a move, the end is on the beat and the move begins its
own length before. No number that says when something happens is written
twice, and nothing bends a scene's clock after the fact. The three `.cjs`
files have browser twins written by `tools/sync-*.cjs`; run them after a
change (the tests say so when a twin is stale), then
`node kit/tools/scene-clocks.cjs --write`, and rebuild the kit's own film
(`node source/lib/film.cjs fit` in `kit/source`, and its soundtrack) when a
scene it uses changed.

## Legacy

What the kit carries from before it was laid on music, to be cleaned before
more is built on it. Each has its measure, so the list shrinks on purpose.

**Scenes that do not keep the film's beat.** A film on a track has its beat
from the track, and `fit` begins its scenes on what the track does. A scene
whose own moments stand on beats then follows the music all the way through;
one whose moments stand on seconds follows it with its first frame only.
`tools/scene-clocks.cjs` measures it from every scene's sample at two tempos
(by the moments the scene sounds on, not by its pixels) and
`tools/scene-clocks.json` is the record, held by `scene-clocks.test.mjs`.
Fifty-one scenes were moved onto beats in one pass; what is left:

- the Glass scenes (11 of 16 measured off the beat): a film may say the beat of
  each of their actions (`timing`), and without it they run in seconds. Their
  default has not been decided.
- `laptop3d`: its two sounds come from frames of the hand's clip, which starts
  with the scene; putting the wake on a beat means starting the clip later.
- `underline` and `dot` are on beats and the measure calls them mixed: the first
  hits another half beat at another tempo, the second leaves a phase out in a
  short scene, so its moments are not the same count at both tempos.
- 29 scenes sound on nothing between their first frame and their last, and the
  measure says nothing of them.

**Scenes that draw a frame by what was drawn before it.** A render's workers
take frames in no order. `dot` kept the plate of its last phase over its word
when an early frame was drawn after a late one, a white rectangle nobody saw
while the scene was shorter than that phase. It is fixed; no test draws a
frame after a later one and holds it against the same frame drawn first, so
other scenes may do the same. That test comes before any scene is changed.
`drag` is one to look at: two renders of it from the same code differ in most
of their frames, by a little.
