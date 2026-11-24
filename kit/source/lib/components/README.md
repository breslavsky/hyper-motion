# Pure Kinetic components

Each factory mounts an independent component. HyperFrames owns its
visibility and clock through one paused GSAP timeline per native composition.
`runtime.mjs` mounts one instance; `presentation.mjs` supplies film-level camera
handoffs, transitions and overlays. There is no whole-film scene player here.

`createComponentLibrary(K).get(type)` resolves a factory. The factory accepts
`{p, root, cam, fg, accent, palette, bg, K}` and returns
`draw(localSeconds, durationSeconds)`. It constructs its own DOM, camera content
and visual state. Calls at arbitrary times must produce the same frame, including
backward seeks. Unknown types fail instead of silently substituting a title.

`K` is private to an instance: dimensions, safe area, brand, palette, typography,
emoji handling, image handles, fitting and motion helpers. `K.uid(role)` gives
SVG definitions a host-specific identifier. `K.defer(promise)` registers assets
needed before readiness; `K.onDispose(fn)` releases instance resources.

The native host exposes `content`, `style`, `brand` and `app` JSON variables.
Identical component source files may therefore mount with different content and
styles. Scene duration is declared by the native composition; changing duration
requires rebuilding its host bounds.

Each component has one implementation across all looks. Theme and material
settings belong in that factory's material/style inputs, never in an alternate
factory, legacy renderer or duplicated layout and animation. Ports replace the
superseded implementation for every look, including the existing theme stories.

`material` accepts `"glass"`, `"dark-glass"` and `"metal"` for the shared
[optical glass](#optical-glass) surfaces independently of the look and brand. Explicit
Metal uses the original Libraries.dev `chromatic` shader preset, retaining its
colour separation (`neutral: false`). Brand ink stays intact and the quiet
panel centre receives a subtle brand tint. Omitting brand colour and font
overrides preserves the component's native defaults.

The legacy `style: "metal"` look remains supported: the film's `metalVariant`
selects `silver` (default), `gold` or `chromatic`; a scene can override it with
its own `metalVariant` and `look: "metal"`. Explicit `material` cannot be combined
with these variant fields. The compiler resolves both paths into `look.material`,
which the native `style.look` variable also supports. A material change in
`content` is rejected as compiled style.

For the legacy `style: "metal"` look, `metal-material.mjs` lazily loads the
original Paper liquid-metal shader and Libraries.dev presets from `metal/`.
This separate legacy look remains available; selecting explicit 3D material
does not activate its DOM decoration. The adapter drives one private texture from the
scene's logical seconds; CSS clips that texture to native headline glyphs and
semantic card/badge/button rims. Text wrapping, shaping and entrance motion
stay native. Body copy, button labels, images, logos and footage keep their
normal paint. The finish composites over the heading's declared ink; exact
brand colours remain the base colours rather than flattening the reflections.
The DOM material adapter does not replace Canvas/3D artwork or recolour supplied
media. Elements can opt out with `data-metal-exclude`; branded controls retain
their centre colour and contrasting label.

The shared 3D surfaces use the same canonical `createMetal` shader source.
Each world owns one fixed 140 × 40 canvas texture, shared by all its cards;
only absolute timeline changes redraw it. A rounded-rectangle distance field
clips the shader to a thin rim, with a quiet flat centre and a soft halo driven
by the same texture. The ring samples the original shader colours directly,
without adding a second lighting model. The shader follows the changing mesh
dimensions throughout a morph. The same opaque metal finish covers faces and bevels,
including the moving lens, switch housings and slider thumb.

The hosted renderer has no React or npm runtime dependency. Its original
shader/preset mathematics and MIT/Apache notices are pinned in
`metal/vendor/SOURCE.json`. The source of truth is
`components/metal`; run `tools/sync-metal.cjs` after edits.
Interactive cursor bending and neighbour reflections are outside this video
material port. `tools/metal-native.mjs` checks all three legacy-look finishes in
real title/card/CTA scenes, three formats and two backgrounds, including reverse
seeks and independent disposal. Storybook's Glass/Metal comparisons use the
shared 3D Liquid Glass components. Its toolbar exposes format, optional
brandbook and 3D material; **Default** leaves native colours and typography
in place.

Native content edits recalculate local marks and click times inside that fixed
slot. Changing the type, duration, transition or sound configuration requires a
rebuild; look and per-instance colour edits belong in the `style` variable. Changed content or
semantic brand/app data exposes `instance.rebuildRequired` and
`window.__pkFilm.rebuildRequired`: visuals are current, but the mixed audio and
film-level hit effects need `film.json` to be updated and rebuilt. A native text
edit does not silently regenerate the audio track.

`brand.font` selects a bundled family (`Geist`, `Archivo`, `Geist Mono`,
`Instrument Serif`) or a local `{family, src, weight?}` font. Custom fonts load
before construction and fitting. Asset-specific private family aliases let two
instances use distinct files with the same public family name.

All catalog components share `K.design`: pinned Radix Themes 3.3.0
font/leading/tracking pairs, semantic roles, restricted fitting steps,
spacing/radius tokens and the size-2 button recipe. Use `fitSize`, `fitLine`
or `fitGroup` with a named role; the previous `K.fit`, `K.fitLine` and DOM
nearest-size snapping are retired. Short labels never expand to fill a box.
`forSurface(scale)` scales an embedded interface as one system. Code retains
its explicit mono family; other semantic text follows `brand.font`.

Factories receive the final letterbox scale before capturing tokens. Dense
content gets measured rows/columns or event-driven pages; it cannot fall below
its role's minimum font size. Canvas and 3D text use the same type recipes.
Geometry and intentional artwork remain owned by each component. The pinned
upstream source and MIT license are in `upstream/radix-themes/`; full-catalog
acceptance is documented in `docs/HYPERFRAMES_CATALOG_DESIGN_SYSTEM.md` at the
repository root.

`brand.tokens` supplies exact optional `background`, `foreground`, `accent` and
`accent2` #hex roles. Background defaults to the requested role across scenes;
`scene.bg` and `scene.fg` override global roles. Without an explicit foreground,
the compiler chooses readable text for the background. An exact accent replaces
the look's chromatic aliases; a second accent owns its warm aliases. The older
`brand.colors` / `palette: "brand"` mode still retints the look while preserving
its paper and ink, so use tokens when a brief requires exact colours.

Native brand token edits update each component's resolved palette and colours
without changing audio. Values deliberately changed in a native `style` variable
win over the new brand defaults. Removing tokens restores the compiled look.
`brand-tokens.cjs` is canonical; `node tools/sync-brand-tokens.cjs` generates the
matching browser module, and `tools/brand-tokens.test.mjs` checks the pair.

The native background policy chooses readable implicit ink on a `sky` gradient.
Component material metadata can also declare a local surface (`glass` or `sky`).
The factory chooses readable on-surface ink only when the foreground was implicit;
explicit scene/brand ink and changed native foreground values remain authoritative.
`film.cjs review` preserves the default `foreground` and also exposes
`surfaceForeground` for sky backgrounds and local materials. Native instances and their audit expose
the same actual local role. Dark glass has a ground-tinted layer beneath its sheen
so moving lights cannot wash out white labels. The contrast probe measures the
composited pixels and reports incompatible explicit colours without replacing them.

The code editor keeps a readable font size, wraps long source lines and advances
between pages of complete rows as typing progresses. Inactive pages are hidden;
all supplied lines remain reachable by native seeks. Dense code still needs
sufficient scene time or shorter excerpts for a viewer to read it.

The primary drawing implementations are listed in `catalog.json`: 95 DOM/SVG,
4 Canvas (`trail`, `particles`, `gather`, `thinking-orb`) and 9 WebGL. Look decorations can also
draw a canvas. Canvas/WebGL callbacks are driven by the same native seek clock;
they do not start render loops. Three shares only its renderer and environment
cache to avoid one GPU context per scene. Scene objects and output canvases stay
private and their geometry, materials and textures are disposed with the host.

`metadata.cjs` is the canonical metadata for the 30 component definitions owned
by Pure Kinetic: fields, examples, guides and shared visual/sound event times. Run
`node tools/sync-component-metadata.cjs` from the template directory after editing
it; `metadata.mjs` is its generated browser equivalent. The compiler imports the
same metadata through `compiler/definitions.cjs`.

Every new or imported component also belongs in the component Storybook.
Its story is generated from this catalogue, its canonical `sample`, `fields`
and `guide`, and renders this production factory with the native HyperFrames
player. Keep an editable default example and validate it in all three formats.
For meaningful enum modes, declare `previewVariants: ['fieldName']` in the
component definition: Storybook generates named examples from that field's
values. `thinking-orb` uses `['state']`, covering all nine states. Do not
maintain a second list of modes or a separate imitation renderer in Storybook.
Add browser smoke coverage for the new examples, controls and seeking; rebuild
the preview assets after changes. An effect still under investigation belongs
in research notes until its native implementation and examples are ready.

`dial` optionally accepts `timing.slide: {startBeat, endBeat}`. These are musical
beats from the scene start. Both its gesture and sound scheduler use the same
`times(scene, logicalDuration, logicalBeat)` function; the final chime lands on
`endBeat` regardless of BPM or pace. Omitting `timing` preserves the original
gesture and sound schedule.

## Optical glass

The 3D group comprises `ask`, `island`, `controls`, `glass-flow`, `glass-steps`, `glass-checklist`, `glass-like`, `glass-rating`, `send-prompt`, `search` and `lens`.
Catalog membership in the broader `glass` family also covers DOM scenes such as
`widgets` and `sheet`. Apply these rules to the optical group.

- Each Glass scene can supply its own background, for example
  `"background":{"image":"media/<assetId>/original.jpg"}` or
  `"background":{"video":"assets/river.mp4"}`. Choose one source per scene.
  Images (including screenshots) and muted video fill the frame with a centred
  cover crop. Omit the field to use the component's default.
  The Three.js components feed the source into their transmission pass.
  The widget grid and sheet apply their existing translucent surfaces over it.
- A Glass scene does not follow the film's look. Whatever the film's `style`,
  it stands on the family's own ground (`glass/ground.mjs`: the deep blue
  backdrop, the light ink and the accent of the `glass` look), because that
  is the ground it was drawn and checked on; a look's paper or sky gave it a
  backdrop and an ink nobody had looked at. The runtime puts the ground in
  before the scene is mounted (`runtime.mjs`), for the optical group and the
  DOM scenes alike. Chosen colours are kept: the scene's own `bg` or `fg`,
  the brand's colour tokens (a brandbook), a style edited on the native
  host. A `background` photo or video is the backdrop and leaves the ink the
  family's. `tools/glass-ground.test.mjs` holds the ground to the `glass`
  look's own colours. A look still sets the film's type and its decorations.
- All Glass scenes accept `speed` and `timing`. Set individual actions in musical
  beats from the start of the scene. For example, `"timing":{"send":3}`
  places the Ask press and its click 1.5 seconds into the scene at 120 BPM.
  Define action positions once in the component's metadata. The factory and
  the sound scheduler use opposite directions of the same time map.
  Keep background media on the playback clock when retiming the action.
- All Glass components use 7% side margins for their layout in 9:16.
  Wider authored safe margins take precedence. Measure the expanded card,
  widget grid, sheet or lens text area before camera projection. The camera
  controls the visible margin during an orbit or fly-through.
- One scene can be built for a film that is not Pure Kinetic's:
  `node lib/scene.cjs recipe.json` (see `lib/USAGE.md`). It writes the scene's
  composition and prints the host element, the style sheets and the sound cues.
- Mount one shared Three.js world per component through `glass/world.mjs`.
  The scenes in `glass/components.mjs` are built from the parts of
  `glass/scene-parts.mjs`: the world and its card, the copy on a card, the
  camera (`orbitCamera`), and what a typed field needs (`caretOf`,
  `actionSlot`, `pointerOf`, `typedCount`, `revealer`, `pulse`). A new scene
  names these parts instead of writing its own caret, pointer or camera.
  A wave or a ripple bends the lettering of its card, which a shader cannot
  see on the page: `glass/lettering.mjs` draws it on a canvas from what the
  scene names (`glyphs` of typed text, `text`, `box`, `icon`, `caret`), the
  one way for Search and Send-prompt. Nothing is captured from the page as
  a picture.
  All three materials share one factory, geometry, camera path and choreography.
  Input fields use the same optical surfaces as the panels. The action of Ask,
  Send-prompt and Search is one quiet button: a glyph printed on the pane in
  the ink of the text, with no lens and no colour of its own, and a soft
  circle under it when the pointer is over it or as it is pressed. In Search
  the Enter glyph matches the leading magnifier's size and inset.
  Glass and Dark Glass transmit and refract the scene. Metal surfaces are opaque and
  occlude anything behind them throughout the animation.
- Glass and Dark Glass (`glass/liquid.mjs`) draw no polygons for a panel. A quad in
  the panel's middle plane traces each pixel through the formula of a rounded
  rectangle pulled out to both sides with a fully rounded edge: the ray bends
  where it enters, crosses the volume and bends again where it leaves, one exit
  angle per colour. The picture seen is the world's backdrop: all but clear
  for Glass, softened by a pixel or two, and frosted for Dark Glass.
  The back wall mirrors the studio light once more as a second, fainter
  highlight. A slab is 13% of its shorter side thick from its middle, up to 30
  design pixels, so only the edge of a low field is a lens. The quad follows
  the card's size every frame and so every morph. The lens of `lens` is the
  same slab, clear, as thick as its card is deep, with flat faces and a
  bevelled edge; it looks at the backdrop together with the lettering plane
  behind it, which the world draws into a target of its own each frame. The
  casing and the thumb of a switch and of the slider are traced the same
  way: the casing a thin clear slab over the finished pane, the thumb a deep
  lens over its rail and disc, which stay polygons. A card with controls is
  drawn into the pane target first, and the casing, the rail and the disc go
  into the target the thumb looks at. A deep part is a few pixels across, so
  it is traced with four rays a pixel. The polygons of a traced part stay as
  its measure and place, undrawn, under a stand-in material that holds
  nothing: a glass finish gives the slab only the tint of smoked glass
  (`finish.tint`). A pane casts a soft
  shadow and leaves a faint pool of plain light under its lower edge. Dark
  Glass is the same slab, smoked: it multiplies what it shows by its tint
  and carries the strip light, the grain and the glints below. A sheet that
  grows or folds (`fixedOptics`) keeps that light where the whole sheet had
  it. Metal is polygons throughout. Over the procedural backdrop, which holds scene light, the slab maps
  what it shows to the screen as the renderer maps the backdrop itself, and
  a clear pane is a faint veil lighter than what it stands in front of; over a picture or a video it shows both as they
  are. A film with its own brand has no colour split at the edge. It needs a
  backdrop with detail to show.
  A ripple is part of the shape (`slab.ripple`, the world's `addRipple`): the
  slab swells in a ring, and lettering handed in as a picture lies in the
  glass and slides with the tilt of the swelling face while the ring runs.
  Search sends one from each click; on Metal it lays the light send-prompt
  wave over the polygon field instead. A wave runs for up to 1.2 seconds,
  less when the beats it lies between are closer.
- Dark Glass reflects a narrow strip light against a black studio environment.
  The outer pane catches it on the upper-left bevel. A raised inner button
  catches a second reflection along its lower-left lip. Sparse grain and
  highlights follow the glass during camera moves. The panel filters colour
  more strongly than the control lenses. A lighter tint keeps dark brand
  lettering legible on light backgrounds. In Storybook's **Materials / References /
  Dark Button Glass**, switch the backdrop from black to stripes and move them
  behind the stationary meshes to inspect transmission and edge refraction.
  [Visual reference](https://liquidglassdesign.com/gallery/dark-button-glass)
- Use the normal `K.design.surface(..., 'card')` recipe for expanded panels.
  Its padding is 16 design units on each side and its gap between content
  blocks is 12. Use the shared `cardTitle` and `body` roles where appropriate.
  Fit complete copy before animation, allow long words to wrap, and use the
  same leading guide for related text. Centre a leading icon on the first
  text line. Zoom and orbit scale the complete layout together.
- Project each panel's editable text and controls onto its 3D face through
  `world.addCard`. In `lens`, the type sits on a plane behind the moving lens.
  Drive camera, geometry, text reveals and sound cues from the component's
  local timeline so seeking back to a time reproduces the same frame.
- Let an optional brandbook supply colours and font. Omitted overrides use
  the component defaults. The default dark backdrop uses blue, violet, coral
  and cyan. Explicit brand colours and scene backgrounds take precedence.
- Keep Storybook on the production factory. Verify wrapping, insets and
  alignment in the card's local coordinates before projection. Check that
  the text stays attached in rendered frames and on backward seeks.

### The grid

Every Glass scene lays its panel out by one grid, `glass/grid.mjs`:
`glassGrid(K)` gives the measures by name, in render pixels of the frame, and
`GLASS_UNITS` the same in design units. Every one is a step of the design
system (the Radix space, radius and type ladders; the card recipe), which
`tools/glass-grid.test.mjs` holds. A scene writes no bare number or
multiplier for a length: it names a token, and a measure the grid lacks is
added to the grid, with its reason, for the next scene to use.

| Token | Units | What it is |
| --- | --- | --- |
| `card.paddingX`, `card.paddingY` | 16 | the panel's inset (the `card` recipe) |
| `card.gap`, `gap.block` | 12 | between the panel's blocks: a title and what follows, row and row |
| `card.radius` | 16 | the expanded panel's corner |
| `gap.hair` | 4 | between a label and its own value |
| `gap.item` | 8 | inside an item: a mark above its text |
| `gap.group` | 16 | between rows of a list that should breathe, and a row's mark and its text |
| `gap.section` | 24 | between a title and what it heads |
| `gap.column` | 32 | between columns |
| `row` | 32 | a single-line row; with the block gap rows pitch at 44 |
| `mark.size`, `mark.radius`, `mark.stroke` | 32, 8, 4/3 | a leading mark: a step's number, a status; its outline is 4 px in a 1080 frame |
| `icon` | 24 | a glyph beside a title, the title's own size |
| `move.settle`, `move.hop`, `move.rise` | 4, 8, 12 | how far a part travels as it settles, hops or comes up |

`width` is the panel's width (86% of a 9:16 frame, else 90% of the safe area
up to 1280) and `content` what stands inside its insets; `column(n)` is one
of `n` equal columns, `beside()` the width left beside a leading mark, and
`firstLine(lineHeight)` what to add above a text so its first line is centred
on a taller lead. `wide` says whether the frame has room for columns
(`W >= 1.2 H`); a square or tall frame stacks its parts as rows, and so does
a wide one whose text does not fit columns at a size its role allows.

A Glass scene is also an overlay for footage (b-roll over the film's own
`background` photo or video), so the film says where the panel stands and
how large it is: `place`, one of nine (`top-left`, `top`, `top-right`,
`left`, `middle`, `right`, `bottom-left`, `bottom`, `bottom-right`;
`GLASS_PLACES`), and `size`, `normal` or `small` (`GLASS_SIZES`: 1 and 0.6).
It is done once for the family: `glassPlacement` says the scale and the
offset that put the first card's box against the edges of the safe area, and
the world scales and moves its whole picture after projection
(`world.mjs` `place`), so the glass, its optics, the lettering over it and
every camera move stay together, and no scene has code for it. The backdrop
is not moved. A panel as wide as the safe area cannot go left or right and
stays centred, as a normal one in a 9:16 frame does.

The fields belong to a scene that is one panel under a camera at rest:
`island`, `controls`, `ask`, `search`, `glass-steps`, `glass-checklist`, `glass-like`, `glass-rating`. The others have
neither (`placed:false` in their metadata), each for its reason: `widgets`
and `sheet` are laid out by the page; in `lens` the headline is the page's
own type behind the lens, so only the lens would move; `send-prompt` stands
close on the caret and pulls back, and a moved picture is cut by the frame;
`glass-flow` flies from one card through to the next. A new scene gets the
fields by being such a panel, and is looked at in a corner at small size
before it keeps them.

Clear Glass is not changed over footage: it stays all but transparent, and a
small panel of it is hard to see on a busy picture. The agent's guide says
to use Dark Glass, which is frosted, for an overlay (the owner's choice over
frosting the glass by itself when a scene has a `background`).

A small panel is the whole panel at six tenths, type included, laid out as
the normal one: nothing runs off in it that does not run off at full size.
Body text is then 29 px in a 1080 frame, and a label (a chip, a caption) 22
px, whatever its length. A scene may give measured limits for a small panel
(`small` in its metadata; `glass-steps`: three steps of 32 characters, a
title of 24; `glass-checklist`: four items of 28), and only those are refused: a general rule that shortened
every text by a third refused the family's own samples and is gone. Every
placed scene's sample is a valid film in both sizes
(`tools/glass-grid.test.mjs`).

A panel is `airy` when its content has room at its own size and `dense`
when the airy one would have to be scaled down to fit the frame:
`density(name)` gives the gaps by what they separate (`section`, `rows`,
`lead`, `columns`, `stack`), each one gap token smaller in the dense panel
(`GLASS_DENSITY`). A scene lays its panel out airy, measures it, and lays it
out dense only if it must: type keeps its size before air is given up.

`type` names the roles of a panel's text and how many lines each may take
before it is set a step smaller: `title` (`cardTitle`, 3), `body` (`body`,
5), `item` (`body`, 3), `label` (`body`, 2), `mark` (`cardTitle` at its
smallest step, 1: a figure in a box, five eighths of the mark).
Related text is fitted together (`design.fitGroup`), so a list is set in one
step. Text on a panel is left-aligned; a row of columns is centred, each
column under its mark and the title over them.

`time` holds the seconds of the family's shared moves before a scene's own
retiming: `open` 0.42 (a panel out of its pill), `pop` 0.3, `fade` 0.26,
`between` 0.34 (one item after another), `hop` 0.32, `stagger` 0.07.

Nothing leaves its panel and no panel leaves the frame. Text is fitted to
its lines before the scene plays; text that does not fit them at its role's
smallest step keeps that step and takes the lines it needs, the panel grows
with it, and `fitToFrame` scales the whole panel to the frame. A field's
length limit is what keeps that last case from happening with ordinary
text: it is set by measurement, in the frame shape with the least room (for
rows, the square one), so that the longest allowed list is still at or above
the readable 28 px. A scene also refuses a length too short for its text to
be read (`needs` in its metadata).

`glass-steps` and `glass-checklist` are written on the grid. The scenes written before them use the
same values, which is where the tokens were taken from, but spell them as
design-system calls (`recipe.gap`, `K.design.space(6)`); they move to the
tokens as they are next touched.

### Text sharpness

Keep readable text, including chips and control labels, in the live DOM
throughout every Glass scene. Storybook can reduce the resolution of the 3D
surface and backdrop independently. Project the live type with its surface
so it follows zoom and orbit at the resolution of the composition.

When an effect bends letters, use a second copy as optical input. Match the
loaded font, line breaks and camera projection to the live type. Composite
the distortion only where the wave or lens currently covers the letters.
Keep the underlying DOM visible everywhere else, including the frame when
the effect starts and the frame when it clears. Confine backdrop blur to
the background behind foreground controls.

For each new Glass scene or change to an optical effect, check the same
frame with the effect on and off. Compare glyph edges outside its footprint
before, during and after the motion, then seek backwards and repeat. Inside
the footprint, check that the glass bends lettering or that opaque metal
covers it. The [foreground pixel test](../../../tools/glass-copy-focus-native.mjs)
checks its list of cases against the catalogue. Add a sample of visible text
when registering a new Glass component. The native tests exercise Storybook's
0.5× optical scale and the export scale of 1×. Run them from the repository root.

```sh
PURE_KINETIC_TESTS=1 uv run pytest -q tests/test_pure_kinetic_glass.py
```

### Component behaviour

- `ask {text, reply?, camera?}` opens a round icon into a prompt on a 3D panel.
  The prompt types, the send button presses, and an optional reply opens below
  it on the same surface. Prompt, caret, send button and answer follow the
  camera together. The default camera orbits during typing and settles before
  the reply opens. Use `static` for a fixed view. While the sheet expands, the
  backdrop, studio light and glass thickness stay fixed. The moving bevel
  refracts the scene along its new contour.
  The 32-unit round send button uses Phosphor's Arrow Down Bold in an 18-unit icon box: the answer opens below.
  The arrow is printed on the pane in the ink of the text, with no lens and
  no colour of its own; a soft circle comes in under it as it is pressed.

- `island {title, body?, icon?, camera?, exit?}` opens a capsule into a card.
  `camera: "orbit"` (default) gives a gentle push and arc; `"static"` holds
  the view. `exit: "collapse"` folds and flies out; `"hold"` is the default.
  Optional `icon` accepts `check`, `info`, `alert`, `close`, `plus`, `star`,
  `heart`, `bell`, `sparkles`, or `arrow-right` for a genuine Lucide SVG that
  follows the text colour. These icons come from `lucide-static 1.77.0`;
  `upstream/lucide-static/` preserves the selected upstream assets, pinned
  receipt and ISC license, including the upstream Feather MIT notice.
  Existing emoji input remains supported. The
  canonical sample uses `icon: "check"`.
  The editable DOM content follows the glass surface through a projective matrix.
- `search {query, placeholder?}` shows the cursor clicking a Liquid Glass
  field. The empty field displays `Search...` by default. Set `placeholder`
  to your own hint or to `""` to leave the field blank. The first typed
  character replaces the hint beside the magnifying glass. The cursor presses
  the inline Enter glyph (↵) on the right, which changes to a spinner in
  the same place. Both glyphs use the active switch's green by default or
  the supplied accent. After a short hold, the field folds into a solid
  round button of that colour. The spinner keeps turning during the fold,
  then changes to a checkmark that holds through the end of the scene.
  Pin `timing.focus`, `timing.type`, `timing.typed` and `timing.search` to
  place both clicks and typing on musical beats. Set `timing.collapse` to
  start closing the field, `timing.collapsed` to finish the fold and
  `timing.checked` to show the checkmark.
- `send-prompt {text, chips?[]}` shows a user typing and sending a prompt.
  The camera follows the caret, then arcs backwards until the entire
  composer and its Send button are in view. The prompt remains on
  one projected surface. Set `"timing":{"pull":3,"landed":6}` to time the
  camera move from beat 3 to beat 6. The optional `chips` row displays up to
  three authored context labels above the prompt. Each chip fits its label
  and can move to the next row. A label wider than the card's content area
  wraps inside the chip. The sample uses “Sales”
  and “Subscriptions” for the sections of a requested report. Omit `chips` to
  leave that row out. An @mention in the prompt is typed like the rest and highlighted once whole.
  Pressing Send launches a wave up the composer, bending the surface and
  its labels as it passes. The lens and arrow keep their ordinary material
  during the press. A transparent canvas on the card shows the wave over the
  live labels in their native resolution. The button's projected silhouette
  keeps its rim clear. The wave starts
  on `timing.send` and clears the card by `timing.sent`. At 100 BPM, setting
  these to 5 and 13 gives the wave 4.8 seconds to travel and settle. The
  renderer comes from [distortion-waves 0.1.0 by Jakub Antalik](https://libraries.dev/waves).
  The source revision, license and checksums for the six GLSL programs are
  recorded in [the vendor receipt](../vendor/distortion-waves/RECEIPT.json).
- `lens {text, sub?, camera?}` moves across the fitted headline and optional
  caption. The live type and the copy sampled through the lens share the same
  projection. Glass refracts lettering within the lens outline. Metal covers
  it there. `camera` defaults to `"static"`, with `"orbit"` also available.
- `controls {title?, toggles[2-4], slider?, camera?}` opens an optical control
  panel. Its switches turn on in sequence and its optional slider fills on
  the existing sound-cue schedule. Each switch occupies a 52 × 26 unit slot.
  Both states use the same fixed-size housing and round thumb. The white off
  indicator measures 60% of the thumb diameter. It sits beneath the Glass face
  or on the Metal face. As the thumb travels right, the indicator shrinks away
  and the green or brand-accented rail fills. The model draws on Allan Langer’s
  [Liquid Glass Mode: On](https://dribbble.com/shots/26248404-Liquid-Glass-Mode-On).
  The slider uses the same 3D housing, rail and surface finish. Its
  round, 24-unit thumb follows the fill from 12% to 82%. The active rail
  shares the switch’s green or brand accent and the remaining rail is neutral grey.
  A disc matching the active rail stays centred in the slider thumb throughout
  its travel. It uses the same 60% diameter and placement as the switch indicator.
  `camera: "orbit"` (default) gives a gentle
  push and arc; `"static"` holds the view. The editable title, labels and
  controls travel together on the projected surface. Dense panels fit as a
  whole inside the safe height, preserving text, control and spacing proportions.
- `glass-flow {title, body?, nextTitle, nextBody?}` keeps two cards in one world
  for a continuous push, orbit and flight through the first card toward the
  second. Its usual length is 14–20 beats; the sample is 16. Both titles follow
  their respective surfaces. Semantic sound cues use its normalized schedule.

At 1920 × 1080, the default card scale gives a 72/90 px title, 48/72 px body,
48 px padding and 36 px gaps before projection. The common card width is
capped at 1280 px. Island's icon slot is one fitted title em wide, followed
by a 12-unit gap. The body aligns with the title. Glass-flow's two cards share
the larger required height while keeping the same top inset on both.

Individual `island` scenes retain independent clocks and cameras. Use
`glass-flow` for this continuous two-card choreography; placing two independent
island clips next to each other does not join their worlds. Metal changes the
surface material in this same renderer: explicit material uses the original
chromatic shader, while the legacy Metal look retains Silver, Gold and Chromatic
variants. Neither path replaces component layout, typography or choreography.

Storybook derives the camera and exit examples from canonical enum metadata.
The `glass-flow` preview uses the same production factory and exposes both
messages through ordinary controls, with format, brandbook and material in the
toolbar. The brandbook supplies its font and colours together; **Default**
restores native component defaults.
Storybook passes `options.previewScale: 0.5` to reduce the optical buffer to
half the width and height while retaining logical layout and projected DOM
text at full resolution. Exported compositions default to `1`. The renderer
resizes its pooled canvas only when the required buffer dimensions change.
In the harness's live preview (`window.__harnessPreview`, `K.live`) the
default is the stream's share of the frame instead (`liveScale`: 1280 of
1920 is two thirds), which the 2D canvases of `trail` and `particles` follow
too, and a scene draws only the frames of the film's grid.

## Community components

Five techniques from the live community library are now native component
factories. Their UUIDs and recipe pages are recorded in `tools/techniques.json`
and `SOURCE.json`; downloaded example code remains in the ignored
`tools/techniques/` research folder. Each factory uses the film's fonts, colours,
safe area and logical clock. Its `times(scene, logicalDuration, logicalBeat)`
schedule also supplies its sound hooks, so changing the tempo or pace keeps the
visible actions and their cues together.

| Component | Content contract | Usual duration |
| --- | --- | --- |
| `polar` | Optional `shapes`: 2–5 entries from `circle`, `triangle`, `star`, `square`; defaults to those four in that order. Optional `label`: 1–28 characters. Optional `satellites`: boolean, defaults to true. The main outline morphs with a spring, turning echo outlines and delayed orbiting copies. | 3–5 beats |
| `letterflip` | `text`: 1–36 characters. Each grapheme turns 450 degrees and shows the accent on its back before landing flat; joined scripts turn as complete words to retain shaping. | 3–4 beats |
| `accordion` | `items`: 3–5 labels of 1–24 characters. Optional `images`: 3–5 local image paths, matched to cards in order. Focus enlarges each card, then the stack follows a wave; tethers and dashed bounds follow the card handles. Landscape uses a row; square and portrait use a vertical stack with side labels. | 5–7 beats |
| `explode` | `layers`: 3–5 labels of 1–24 characters. Optional `title`: 1–36 characters. A card tilts, separates into named planes, holds with a slow turn and reassembles. Labels remain flat and readable. | 5–7 beats |
| `scan` | `items`: 3–6 objects with `label` of 1–18 characters and optional `category`, a 1-based index into `categories`. `categories`: 2–4 labels of 1–24 characters. Optional `image`: a local path up to 300 characters; `title`: 1–48; `scanning` and `complete`: 1–32 each. Omitted categories distribute items in order. The scan band reveals brackets and tags, then the crops fly into category slots and fill their badges. | 7–9 beats at normal pace |

Scan tags stay visible through the lift, until flight starts. Prefer short one-
or two-word labels; longer labels/status lines and faster music need more time
and a readability check. Font fitting does not guarantee enough reading time.

These limits are input contracts, not promises that every font has the same
metrics. Native fitting still measures the chosen font before readiness. A supplied
scan image is divided into the component's fixed object cells; the component does
not detect objects in an arbitrary photo. Without images, scan and accordion draw
brand-coloured abstract artwork.

`tools/technique.py accept <name>` checks the definition, validates its sample,
runs five looks in all three formats with repeated seeks, regenerates the guide
and writes the provenance record. The five additions have no pre-migration
engine implementation; their acceptance is native-only, with the same clock,
state, geometry, fit and content checks. The historical migration receipt still
describes its original 95-component scope.

The preserved visual source and licence provenance are in `SOURCE.json`.
`tools/native-components.mjs` records the one-time mechanical conversion; do
not rerun it over maintained component sources. Acceptance uses the native
HyperFrames bundler, loader and seek API, including three aspect ratios, backward
seeks and independent text measurements. Generic layout-allow annotations in the
preserved drawing helpers are not proof that text is readable.

Run `node --test tools/native-timing.test.mjs` for compiler/native local-time
equivalence and fixed-slot edit rules, and `node tools/native-variables.mjs`
for native edits, future-clip fitting, complete readiness and bundled/local fonts
in three aspect ratios, CSS isolation and disposal. The typewriter's canonical
`typewriter-timing.cjs` schedule supplies both visible typing/erasing and audio
events; run `node tools/sync-typewriter-timing.cjs` after editing it. Typing events
do not alter the film's visual hit cues. The wider catalogue and raster comparisons live in
`tools/native-accept.mjs`; Canvas/WebGL isolation is checked by
`tools/native-portability.mjs`.

`node tools/native-typewriter-audio.mjs` runs the actual `music.py` in isolated
native projects for short/long text, erasing with replacement, emoji, and mute. It seeks
each visible key action, checks the scheduled and mixed cue times, decodes the
M4A outputs, and verifies that changed text invalidates the previous soundtrack.
Typing and erasing count Unicode codepoints, so an astral emoji is one action and
never exposes a lone surrogate. Dynamic emoji use the same bundled Fluent SVG
assets as static text; the probe checks their semantic values and stable SVG nodes.
The mixer preserves its existing minimum gap between key sounds; scheduled keys
can therefore outnumber audible clicks. It writes the tracks and a JSON report
to `/tmp/pk-typewriter-audio` (override with `--out`).

Typewriter line breaks are resolved from the complete copy before playback.
Original and replacement variants share one measured grid cell; glyph nodes
remain in place while their ink changes. The caret uses measured local offsets
outside the inline flow. This prevents both whole-word rewrapping and kerning
changes caused by rebuilding a typed prefix on every frame. Composed Fluent
emoji remain atomic and appear once their complete codepoint sequence arrives.
An intentional switch to replacement copy may change that variant's line breaks;
typing within either variant does not. The shared timing/audio schedule is unchanged.

Run `node tools/typewriter-layout-native.mjs --out /tmp/pk-typewriter-layout`
for every key boundary and fade in seven Latin/Cyrillic fixtures, four brand
fonts and three formats. It checks actual painted glyph coordinates, caret attachment, fitting,
full-copy reservation and exact reverse seeks. The Python native gates run by
hand only (`tools/test.sh`), every time, when packages and Chrome are available.

The shared `typing.mjs` helper now owns immutable typed layouts in `title.sub`,
`prompt`, both `ui-macro` input paths, `morph.search`, `ticket`, `code`, `browser`,
`ask`, `trail`, `palette`, `bubbles`, `checklist`, `retype`, and `typewriter`.
`pullback` already reveals fixed glyphs and retains that implementation. Chat
waiting dots, word reveals and rolling counters are separate mechanisms.

Call `createTyping(K, host, {text, caret, unit, id})`, fit the complete host using
`K.design`, then call `measure()` before applying animation transforms. Each draw
calls `reveal(count)` using the component's existing clock. The host supplies its
font and constrained width; the helper supplies no design tokens or timing. Pass
original `text` for ordinary copy so semantic SVG emoji survive. For syntax-
coloured code, build raw text runs first and omit `text`, with `emojify:false`.
The final scene-wide emoji pass must not replace these already measured runs.
The default count unit is UTF-16 for legacy clocks; `ask` and `typewriter` opt into
codepoints. Neither policy reveals half a surrogate or part of a composed SVG.

The browser address bar and explicit `ui-macro` target are scrolling single-line
inputs. Each viewport stays within its surface and follows the insertion point
horizontally. Scene fitting uses visible intersections for these named viewports;
other clipped labels retain ordinary overflow checks. Their per-key gates require
the caret and newest glyph to remain in view, and deliberately disabling scrolling
must fail the viewport check. Distinct typing hosts still undergo collision checks.

Run `tools/typing-builtin-native.mjs` (27 cases), `tools/typing-motion-native.mjs`
(18 cases), and `tools/typing-ui-native.mjs` (42 cases) with `node` and `--out` to
a fresh directory. All use the actual HyperFrames timeline in three formats,
painted text and measured glyph geometry, forward and reverse. The UI matrix adds
two brand fonts, Unicode, code pagination, and scrolling URLs. The builtin/UI
gates include deliberately displaced visible glyphs; motion's equivalent is
`node tools/typing-motion-native.mjs --self-test --out /tmp/pk-typing-canary`.
Pytest wrappers are in `tests/test_pure_kinetic_typing.py`.

The [maintenance entrypoints](../../../tools/README.md#maintained-test-entrypoints)
cover all Node contracts and the current native ellipsis/typing gates. Native QA
has a deliberately pinned private-vendor adapter, documented in
[native acceptance](../../../tools/native-README.md); it is outside the shipped
components and is not a second playback engine.

Collapsed Ranges inside text nodes supply logical caret edges. At a bidirectional
boundary, the caret uses upstream affinity: the trailing edge of the character
just typed. Preformatted hosts ending in a newline reserve the final empty line
before fitting with a text-free `<br>`; supplied copy, logical character counts
and sound events stay unchanged.

Run `node tools/typing-edge-native.mjs --out /fresh/directory` for 12 cases:
Arabic and Hebrew mixed with Latin/numbers, plus short and wrapped copy ending
in a newline, each in three formats. The native gate compares with an independent
unsplit text node, checks every key and reverse seek, and rejects a displaced
caret or removed final-line reservation. Its pytest wrapper is
`tests/test_pure_kinetic_typing_edges.py`. This is bounded coverage of those cases,
not a claim of complete international typography or vertical-writing support.

## Glass steps

`glass-steps` (`glass/components.mjs`) is the first of the Glass scenes that
explain rather than act as an interface: a panel grows out of a pill, its
title comes in, then two to four numbered steps one after another; with
`exit: collapse` the steps hop in a wave and the panel folds away. It
follows the look of a stock template's preview (`SOURCE.json`), built on the
family's own card (`cardSurface`, `updateCard`), so Glass, Dark Glass and
Metal, a photo or video behind it and authored `timing` work as in the other
Glass scenes. The steps are columns in a wide frame and rows in a square or
tall one; phrases too long for columns at a readable size are stacked as
rows too (`data-steps-layout` on the surface says which), and every step is
set in the step the longest one needs. Every measure is a token of the
family's grid (`glass/grid.mjs`, "The grid" above). The name `steps` belongs
to the older flat scene.

Its limits are measured: a step is 48 characters and 8 words at most, the
title 32 characters, two to four steps. At those limits ordinary text stays
at or above 28 px in the three frame shapes (`hyperframes check` on worst-
case films: four full steps, a title of three lines); a list of the widest
capitals still fits its panel but is set smaller than that in a square
frame. The scene needs half a second and three tenths a word after its last
step comes in, and a film that gives it fewer beats is refused
(`tools/glass-steps.test.mjs`).

## Glass checklist

`glass-checklist` (`glass/components.mjs`) ticks a list off: the panel grows
out of a pill, its title comes in, then two to five items one after another,
each an empty box that pops, a line lit word by word as it would be read,
and a tick drawn into the box, which fills with the family's active colour,
when the line is said. `done` says how many
items are ticked, from the top; the rest keep an empty box. With
`exit: collapse` the rows go one after another and the panel folds away. It
follows the look of a stock template's preview (`SOURCE.json`) on the
family's own card, like `glass-steps`, and shares its parts: the box is the
grid's mark, the tick the icon set's own check as a mask in the text's ink,
the gaps the airy and dense densities. A checklist is always rows.

Its limits are measured in the native browser at the worst case of each
frame shape: five items of 40 characters and a title of 32 stay in the first
step of their role (48-53 px items, 72-79 px title) and take two lines at
most; in a small panel four items of 28 characters and a title of 24 do. An
item is seven words at most. The scene needs its last tick and six tenths of
a second after it, and a film that gives it fewer beats is refused
(`tools/glass-checklist.test.mjs`).

## Glass like

`glass-like` (`glass/components.mjs`) is a button somebody presses: a glass
pill grows out of a round seed with an icon and a word, a pointer comes up
and clicks the icon, a ripple runs the pill from the click as in `search`,
and the icon fills with colour. The word stays as it is. The pill is the
design system's field in its pill shape, the word a scene title (the grid's
`action`), the icon the word's size. A word is twelve characters at most
and is set a step smaller only when the pill would be wider than the safe
area. Icons: `like`, `heart`, `star`, `bell`, `save`, `plus`, `check`, from
the vendored Lucide set, outlined before the click and filled after. With
`exit: collapse` the pill folds back into its seed. Over footage it is the
call to like, follow or subscribe, placed by `place` and `size`
(`tools/glass-like.test.mjs`).

What is on, pressed or done has one colour across the family
(`activeColor` in `glass/components.mjs`): the brand's accent, or a clear
green when the film has none. A switch's rail, a pressed icon and a ticked
box of the checklist take it; the stars of a rating are gold.

## Glass rating

`glass-rating` (`glass/components.mjs`) gives a rating in five stars: the
panel grows out of a pill, a question or a name comes in, the stars fill
with gold one after another up to `stars` (whole or half: a half star is
filled to its middle), and an optional `caption` under them says the rating
in words. A star is the vendored Lucide star, filled, as an alpha mask:
faint in the text's ink when empty, in gold (or the brand's accent) over it
when filled, uncovered from its left. It is the grid's mark in size, with
the item gap between stars; the panel is the family's card, centred. With
`exit: collapse` the panel folds away. The guide tells the writer to state
only a rating the user gave (`tools/glass-rating.test.mjs`).

## Comic

`comic` (`scenes/text.mjs`) is Pixel UI's Comic Glitch Text, ported with its
author's permission (`SOURCE.json`: the commit, the file and what was kept):
a paragraph glitches in word by word through tilted colour panels with a
shard and a hatch, a patch of red halftone dots, torn slices of the word in
cyan, magenta and yellow, and bold type out of register, 24 frames a second.
The original runs a timer and draws its shapes with `Math.random`; here the
frame is the scene's time and every number comes from the word and the frame
(`comicFx`, `comicEnter`, `comicIdle`, a seeded generator), so any seek draws
the same picture. Its colours are the effect's own and do not follow the
look; only the type's colour does. Styles of a word are set through `set`,
which remembers what it set: a style written past it is not written again.

## Lens wall

`lens-wall` is the shared Lens Wall component
(`components/lens-wall`, ours, written from scratch) as a
scene: an endless wall of the film's pictures and videos under a lens,
crossed by a camera on one of five paths (`drift`, `orbit`, `wave`, `eight`,
`zigzag`). The component's `wall.mjs` is carried here as a byte copy in
`lens-wall/`; edit the canonical file and run `node tools/sync-lens-wall.cjs`,
never the copy (`tools/lens-wall.test.mjs` compares them).

`scenes/lens-wall.mjs` only translates: `images` and `videos` become the
wall's files, the look's background its ground, `path` the camera's way.
The wall has seven example videos of its own, loaded from our public CDN
(the definition's `public`, the component's `PUBLIC`). `film.cjs fit` gives
the plan's scene as many as the film's own files leave of seven places, after
its videos (`wallExamples`, the definition's `filled`); film.json is not
changed, and any other address in it is refused. The component Storybook
fills its story the same way. The nine abstract pictures in the look's
colours are what a scene mounted without that step draws. The scene has no words and opens no
picture; stops that open a picture to the full frame are the component's own
builder (`build.mjs` of the `lens-wall` kit in the shared catalogue).

A video plays in its tiles. It is a texture, as a Glass background is: the
film's page declares one muted `<video>` per file of `scene.videos`
(`pk-video-<scene>-<n>`, `build.cjs`), which is what HyperFrames decodes
offline, and the scene asks for it in the size it draws
(`K.videoSource(index, width, height)`, `glass/background.mjs`
`loadVideoSource`). Six videos a scene at most: each is decoded for every
frame. A still taken by `snapshot` shows a video one seek behind (the frame
is injected after the still's own seek); a render does not.

## HyperFrames registry adaptations

Five upstream registry components extend the catalog: `before-after-wipe`,
`screen-flow-carousel`, `chart-story`, `testimonial-proof-card`, and `modal-morph`.
They use the same instance contract above. `upstream/hyperframes-registry-01/`
preserves their pinned repository receipt and Apache license. Exact original
source and manifests live in `tools/upstream/hyperframes-registry-01`, outside
the renderable project. Only the adapted
`scenes/registry-*.mjs` factories execute. Registry names are not MotionFab
technique UUIDs and do not enter `tools/techniques.json`.

See `../../../tools/REGISTRY.md` for fields, retained mechanisms and acceptance.
