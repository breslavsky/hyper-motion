# Hyper Motion

A library of motion-design scenes and components for
[HyperFrames](https://github.com/heygen-com/hyperframes): HTML compositions
that render to video, every frame a pure function of time.

It was grown inside [Motion Fab](https://www.motionfab.app) and lives here on
its own.

## What is here

| Path | What |
| --- | --- |
| `kit/source/lib` | The kit: a film written as data (`film.json`: scenes of a type, their words, beats and look) compiled into native HyperFrames sub-compositions. 100+ scene types (kinetic type, charts, UI, Glass, Metal, Three.js, the lens wall), 43 looks, text measured so nothing overflows. `lib/scene.cjs` builds one scene for a film of your own. A project takes this folder whole. |
| `kit/source` | A film made with the kit, as a project: `film.json`, the page and compositions built from it. |
| `kit/AGENTS.md` | The writing guide for an agent that fills in `film.json`: every scene type with its fields and limits. |
| `kit/tools` | The kit's tests, acceptances and generators. |
| `components/` | Standalone components: `lens-wall` (an endless wall of your photos and videos under a lens), `spatial-type` (extruded 3D type), `thinking-orbs`, `metal`, `ui-world`, and five scenes of the kit as plain HyperFrames factories (`pure-kinetic`). |
| `storybook/` | A Storybook of every scene type with live controls, formats, materials and brand books. |
| `tests/` | The kit's tests under pytest. Every push runs the quick ones before the Storybook is published. |
| `catalog.json` | The catalogue of what can be installed, with a SHA-256 per file. |

Media a component needs beyond its code (example videos, sample backgrounds)
is loaded by link from a public CDN, never from this repository.

## Running it

Node 22.12 or newer, and Chrome for the browser checks.

```bash
npm run storybook          # install and open the Storybook on http://127.0.0.1:6006
npm run build:storybook    # a static build in storybook/storybook-static
npm test                   # the kit's node tests (nothing drawn in a browser)
kit/tools/test.sh quick   # the quick pytest set (python3 -m pip install -r requirements-dev.txt first)
kit/tools/test.sh         # everything, with the acceptances Chrome draws: hours
```

The acceptances draw in Chrome through the pinned HyperFrames (`0.9.19`) and
need the kit's own packages (`cd kit && pnpm install
--frozen-lockfile`).

## Projects that inspired this

Some of these gave code, some only an idea. What exactly was taken, from
which commit and under which licence is recorded in the `SOURCE.json` next to
each part.

- [HyperFrames](https://github.com/heygen-com/hyperframes) by HeyGen: the
  runtime all of this is written for, and its registry of blocks
  (Apache-2.0).
- [Kinetic](https://kinetic.launchloop.tech/) by LaunchLoop: the idea of a
  film as data (scenes of a type on a beat grid, a look as a separate layer)
  and the engine the kit's compiler and many scenes were rewritten from.
- [motionmaxxing](https://github.com/Tejashmakwana/motionmaxxing)
  (Apache-2.0).
- [Pixel UI](https://pixelui.dev) by Kislay: the `comic` text scene is a port
  of its Comic Glitch Text; its Poster Sphere was the idea behind the lens
  wall, which is written from scratch.
- [Libraries.dev](https://libraries.dev) by Jakub Antalik: Metal, Thinking
  Orbs and Distortion Waves (MIT).
- [Paper Shaders](https://github.com/paper-design/shaders): the liquid metal
  shader (Apache-2.0).
- [Radix Themes](https://github.com/radix-ui/themes): the design tokens the
  kit's spacing, radii and colour roles follow (MIT).
- [Three.js](https://github.com/mrdoob/three.js) (MIT) and
  [GSAP](https://github.com/greensock/GSAP) (Standard GreenSock License).
- [Lucide](https://lucide.dev) (ISC),
  [Phosphor Icons](https://github.com/phosphor-icons/phosphor-core) (MIT) and
  [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (MIT).
- [Kenney](https://kenney.nl/assets) interface and impact sounds (CC0).
- [Uppbeat](https://uppbeat.io/motion-graphics/asset/liquid-glass-infographic-list-12753)'s
  Liquid Glass Infographic List: a reference for the Glass steps scene, no
  code or media taken.
- Fonts under the OFL: Geist, Archivo, Instrument Serif, Onest, Lora, Cairo,
  Amiri, Anybody.
- [Storybook](https://storybook.js.org).

## Licence

The library's own code is under the [MIT License](LICENSE).

Parts taken from elsewhere keep their own terms, and the MIT License does not
replace them. Each is named, with its source and licence, in the `SOURCE.json`
next to it. Most are MIT, Apache-2.0, ISC, CC0 or the OFL (the fonts). Three
are not plain open-source licences:

- **GSAP** is under the [Standard GreenSock License](https://gsap.com/community/standard-license/).
- **The `comic` text scene** is a port of Pixel UI's Comic Glitch Text, whose
  licence is MIT with the Commons Clause and an attribution condition; it is
  here by its author's permission. Credit: [Pixel UI](https://pixelui.dev).
- **The plan compiler and the scenes rewritten from Kinetic** (LaunchLoop) are
  here by agreement with its author.
