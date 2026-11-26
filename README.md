<div align="center">

<img src="storybook/src/icon.svg" alt="" width="72" height="72">

# Ultimate Hyper Frames<br>Components Pack

**Your AI agent can do HTML to video.** Free & Open Source.

120+ motion-design scenes for [HyperFrames](https://github.com/heygen-com/hyperframes) films, each one a recipe an agent can write: its fields, its limits and its sound cues are checked by code.

<br>

[![Storybook](https://img.shields.io/badge/storybook-live-FF4785?style=flat-square&logo=storybook&logoColor=white)](https://hyper-motion.dev/)
[![Status](https://img.shields.io/badge/status-beta-orange?style=flat-square)](#status)
[![Renders with HyperFrames](https://img.shields.io/badge/renders%20with-HyperFrames-4f46e5?style=flat-square)](https://github.com/heygen-com/hyperframes)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**Follow [@AntonBreslavsky](https://x.com/AntonBreslavsky) on X** for what comes next.

Developed with &nbsp;[<img src="https://www.motionfab.app/brand/motionfab-logo.svg" alt="Motion Fab" height="22" align="center">](https://www.motionfab.app)

[Storybook](https://hyper-motion.dev/) &nbsp;·&nbsp; [What it is for](#what-it-is-for) &nbsp;·&nbsp; [The four kinds](#the-four-kinds) &nbsp;·&nbsp; [What is here](#what-is-here) &nbsp;·&nbsp; [Running it](#running-it) &nbsp;·&nbsp; [Status](#status) &nbsp;·&nbsp; [Licence](#licence)

</div>

<br>

Hyper Motion is a library of scenes and components for HyperFrames: HTML
compositions that render to video, every frame a pure function of time. It
was grown inside [Motion Fab](https://www.motionfab.app) and lives here on
its own.

## What it is for

- **A free After Effects alternative** for motion graphics an agent writes as code: titles, kinetic type, charts, interface animation and glass overlays, with no timeline to drag. It is not a compositor for footage.
- **AI motion graphics.** Your AI agent picks a scene, fills in its fields and gets motion design that was drawn and timed by hand.
- **HTML to video, HTML to MP4.** Every scene is HTML, CSS and JavaScript; HyperFrames renders it to MP4 or WebM.
- **A Remotion alternative** if you render with HyperFrames rather than React: plain HTML compositions and nothing to install from npm.
- **Claude Code, Codex, Cursor.** Works with any agent that can run a command.

## The four kinds

| Kind | What it is |
| --- | --- |
| **Apple Glass** | Thick optical glass that bends the picture behind it: search, prompts, messages, calls, ratings, steps, and rides that pass from one to the next on one drop of glass. |
| **3D** | Real objects under a real camera: a laptop a hand opens, a machine two hands play, phones, cards, a wall of pictures under a lens. |
| **Flat Motion** | Kinetic type, charts, interface mock-ups and transitions in forty-three looks: the scenes a launch film is cut from. |
| **B-Rolls** | The same glass laid over your own footage, a talking head or b-roll, bending the video under it. |

See every one of them play in the [Storybook](https://hyper-motion.dev/).

## Status

Beta. The scenes work and are tested, but their names and fields may still
change.

## What is here

| Path | What |
| --- | --- |
| `kit/source/lib` | The kit: a film written as data (`film.json`: scenes of a type, their words, beats and look) compiled into native HyperFrames sub-compositions. 100+ scene types (kinetic type, charts, UI, Glass, Metal, Three.js, the lens wall), 44 looks, text measured so nothing overflows. `lib/scene.cjs` builds one scene for a film of your own. A project takes this folder whole. |
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
