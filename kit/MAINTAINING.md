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

To check a change that must not change a frame, render the scene alone, lightly
(`hyperframes render source -w 2 -q draft`), before and after: one scene on two workers is the same
file twice, a film of many scenes on eight workers is not.

## Legacy

What the kit carries from before it was laid on music, to be cleaned before
more is built on it. Each has its measure, so the list shrinks on purpose.

**Scenes that do not keep the film's beat.** A film on a track has its beat
from the track, and `fit` begins its scenes on what the track does. A scene
whose own moments stand on beats then follows the music all the way through;
one whose moments stand on seconds follows it with its first frame only.
`tools/scene-clocks.cjs` measures it from every scene's sample at two tempos
(by the moments the scene sounds on, not by its pixels) and
`tools/scene-clocks.json` is the record, held by `scene-clocks.test.mjs`:

- on beats (30): the standard. A new scene is written so.
- on seconds (24): `notify`, `faces`, `overlay`, `knockout`, `assemble`, `hive`, `scatter`, `pack`, `tiles`, `mosaic`, `glass-island`, `glass-ask`, `glass-steps`, `glass-checklist`, `glass-rating`, `glass-call`, `connect`, `chips`, `cards3d`, `icon3d`, `before-after-wipe`, `chart-story`, `testimonial-proof-card`, `laptop3d`.
- mixed (40), some moments on beats and some not: `steps`, `append`, `timeline`, `chat`, `callouts`, `journey`, `shuffle`, `between`, `drag`, `arc`, `orb`, `particles`, `wave`, `agent`, `palette`, `picker`, `web`, `split`, `swarm`, `inline`, `bubbles`, `retype`, `roll`, `dot`, `pullback`, `glass-widgets`, `glass-controls`, `glass-ride`, `glass-stepper`, `glass-like`, `glass-message`, `glass-follow`, `underline`, `winner`, `tabs`, `dial`, `gather`, `thinking-orb`, `modal-morph`, `comic`.
- on a share of its length (1): `flip`.
- 29 scenes sound on nothing between their first frame and their last, and the
  measure says nothing of them.

To clean one: give its moments in beats of the film (`p.beatLen`), as the
scenes on beats do, run `node kit/tools/scene-clocks.cjs --write`, and commit
the record with the scene. A moment that is physics (a ball's fall) stays in
seconds and its landing is put on a beat.

**Scenes that draw a frame by what was drawn before it.** A render's workers
take frames in no order. `dot` kept the plate of its last phase over its word
when an early frame was drawn after a late one, a white rectangle nobody saw
while the scene was shorter than that phase. It is fixed; no test draws a
frame after a later one and holds it against the same frame drawn first, so
other scenes may do the same. That test comes before any scene is changed.
`drag` is one to look at: two renders of it from the same code differ in most
of their frames, by a little.
