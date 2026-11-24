# Spatial Type: native HyperFrames component

Use this kit for reflective extruded typography, travel through a field of
fragments, or letters split into moving slabs. It supplies a persistent
Three.js world. It does not choose the film's words, camera route or edit.

Install through the local component registry, then mount the returned HTML:

```html
<div id="spatial-scene" class="clip"
  data-composition-id="spatial-scene"
  data-composition-src="compositions/components/spatial-type/spatial-type.html"
  data-start="0" data-duration="6" data-track-index="1"
  data-width="1920" data-height="1080"
  style="position:absolute;inset:0"></div>
```

Keep every file's relative location after installation. The native entry
resolves its modules from the mount's definition URL, so custom components
directories work. The host owns start, duration and dimensions; update them
when changing the recipe. All files are local, including fonts and Three.js.

## Edit the recipe first

`recipe.mjs` is a neutral six-second FORM → IDEAS example in a blue studio.
Replace its words, colors, camera keys and timing. It is separate from the
generic engine in `lib/`. To mount different recipes simultaneously, use a
native `config` variable containing JSON (or a config object through the JS
adapter). It deep-merges over the recipe, replacing arrays. For example:

```html
data-variable-values='{"config":"{\"materials\":{\"face\":{\"color\":\"#edab7d\"}}}"}'
```

| Setting | Meaning |
|---|---|
| `duration`, `width`, `height`, `fps`, `pixelRatio`, `seed` | Scene clock, render dimensions, shutter/grain sampling, integer seed. Pixel ratio defaults to 1 and is limited to 2. |
| `words[]` | Each has `id`, `text`, `font` (`wide` or `compact`), `position`, `rotation` (radians), `scale`, optional fitted world-unit `width`, and `visible: [start,end]`. Cap height is one world unit before scale. |
| `word.geometry` | `depth`, `bevel`, `bevelSegments`, `curveSegments`, and world-unit `tracking`. Real extruded geometry, with holes retained. |
| `word.animate` | `position`, `rotation`, `scale` keyframe arrays. Each key is `{time,value,ease}`; vector values have three entries. Eases: `smooth`, `linear`, `in`, `out`, `hold`. |
| `word.assembly` | `{start,duration,stagger,offset:[x,y,z]}`; per-letter arrival derived directly from time. |
| `word.slices` | Up to two `{normal:[x,y,0],offset}` planes per glyph; one plane gives two slabs, two give three regions. |
| `word.fracture` | `{start,duration,separation,shear,depth,rotation,seed}`. Pieces coincide before the split; world-space clipping planes follow every transformed piece. |
| `word.emissive` | Numeric keyframe array for increasing light on letter faces and sides. |
| `materials.face`, `materials.side` | `color`, `metalness`, `roughness`, `env`, optional `pillow` and `lift` normal shaping. Each word can override with `word.materials`. |
| `environment` | Procedural studio `intensity`, RGB `tint`, `width` (default 1024), and `boxes`: `[azimuth,elevation,halfWidth,halfHeight,intensity]` in radians. Raster PMREM reflections, no downloaded HDR image. |
| `look` | `background`, `fog`, `exposure`, environment rotation speed `envRotation` in radians/second. |
| `camera.keys[]` | `{time,position:[x,y,z],target:[x,y,z],fov,roll,ease}`; lens in degrees, roll in radians. One camera persists through the whole move. `near` and `far` belong to `camera`. |
| `fields[]` | Seeded `count`, `bounds:[[xmin,xmax],[ymin,ymax],[zmin,zmax]]`, `scale:[min,max]`, `stretch`, `drift`, `spin`, `start`, `spread`, `fade`, `end`; optional `alphabet`/`font` makes extruded glyph fragments. Optional `burst:{origin,speed,tau}` adds an analytic outward burst. |
| `glints[]` | `{position,peak,width,size,intensity,color}`; Gaussian time envelopes, no random flashes at render time. |
| `lights[]` | `{position,color,intensity,distance,decay}`; intensity can be a number or keyframe array. |
| `beams[]` | `{position,rotation,length,width,color,intensity,animate:{position,rotation}}`; numeric intensity/keyframes and vector transform keyframes. |
| `rays[]` | `{position,size:[width,height],color,intensity}`; r8-derived additive radial shader behind a crack. Intensity can be keyed. |
| `post` | `bloom`, `radius`, `threshold`, `exposure`, `flash`, `wash` accept numbers or keyframes; `grain` and `aberration` are fixed strengths. |
| `motionBlur` | `{samples,shutter}`: 1–12 independently evaluated subframes, shutter in frame units. Default 1/0; use more only during moves that need it. |
| `transition` | `{start,color,durations:{bloom,hold,collapse,line,reveal}}`: white bloom → horizontal strip → colored line → opening bands. Words/UI after the transition remain your editable recipe/native compositions. |

Camera keys are authored positions and targets, not a label saying “fly-through”.
For a passage through a letter hole, inspect its actual glyph position and
size, aim through its aperture, and continue through the same world. Avoid
placing the target at the camera position. Match a reference's near/far
occlusion, path, speed, material variation and transition phases from short
consecutive windows. More bloom or more fragments do not automatically make
the result closer. The kit does not fix r8's excessive glare or choose its
original reference's motion for you.

## Direct API and inspection

```js
import {createSpatialType} from './lib/world.mjs';
import recipe from './recipe.mjs';
const world = await createSpatialType(canvas, recipe);
world.seek(2.4);  // repeated/reverse/out-of-order seeks are supported
world.resize(1280, 720);
console.log(world.inspect());
world.dispose();
```

`createSpatialType(canvas, config, {fonts})` also accepts named local Three
Font/typeface-data objects. The bundled `wide`/`compact` fonts are Anybody,
weight 800, width 150/130. All 528 Unicode glyphs from the bundled Latin and
Latin Extended subsets are included, not only letters from a sample film.
Unsupported glyphs fail clearly; use suitable licensed local geometry for
other scripts. Complex shaping/ligatures are not supplied by Three Font.

The native adapter registers its setup in `window.__hf.buildReady`, awaits
shader preparation, and draws from `hf-seek` time minus the host start.
Its paused GSAP timeline is a duration sentinel only. It uses no animation
loop, wall clock, unseeded randomness, external asset request or persistent
frame history. Each instance owns its scene, renderer and resources.

The mount DOM node exposes `root.spatialTypeInstance`: `{api,config,time,
dispose}`. `api.inspect()` reports exact local time, camera position/target/
lens/roll, scene ID, word vertices/pieces/materials, glyph centers, and shard
count. `dispose()` removes native listeners and GPU resources. This inspection
is a technical receipt; judge the rendered motion separately.

## Build and check a small proof

```sh
node build.mjs --out /tmp/spatial-type-demo
node build.mjs --out /tmp/my-spatial-demo --config /path/to/recipe.mjs
```

`buildProject(destination, config)` creates an empty-directory-only native
project, copies this self-contained kit and writes the editable recipe.
Then use the project's pinned HyperFrames CLI for `check`, native frames and
render. The library tests cover pure state, font geometry and safe builds;
Repository contributors run `node --test model.test.mjs` from the source kit
folder; that test file is not installed into a user's composition. Native
acceptance additionally checks pixels after reverse seeks/reload,
two simultaneous instances, nonzero starts and changed content/style/path.
Do not rebuild the world between phases just to change a word or camera.

Slice surfaces retain r8's clipping-plane method: sidewalls and bevels are
real geometry, but cut openings are not newly capped watertight solids. This
is a motion-graphics technique, not a mesh export/solid-modeling library.
Audio and HUD layout belong to the enclosing project.
