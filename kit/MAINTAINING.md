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
