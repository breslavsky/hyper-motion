## Template guide: Pure Kinetic (HyperFrames)

A short motion-graphics film (a launch film, an ad, an announcement, an
explainer) written as data. You write one small file, `source/film.json`: a
look, and scenes of a type with their words and a length in beats. The kit
draws everything, sets every time and colour and writes the soundtrack. You
never write HTML, CSS or animation. Everything you need is on this page;
do not search `source/lib/` to discover parameters.

### Component maintenance when explicitly requested

Use one factory per component across looks and materials. Keep its layout,
typography, geometry and timeline together. When porting a component, replace
the old factory and point its existing Storybook examples at the shared one.
For 3D Liquid Glass components, follow the [optical glass rules](source/lib/components/README.md#optical-glass)
for card spacing, projected text, camera, brand defaults and materials.
When adding or changing any Glass scene, follow the [text sharpness rules](source/lib/components/README.md#text-sharpness)
and run their native pixel checks. Local effects keep lettering sharp outside their footprint.

### Keep the request intact

Before writing, identify the required words, actions, format, seconds,
font, colours and musical beats. Quoted copy stays exact. Choose scenes
for those actions; ready shapes are optional starting points. Never pad a
duration with repeated end cards, restated slogans or invented claims.

- Font: `brand.font`, exactly `"Geist"`, `"Archivo"`, `"Geist Mono"` or
  `"Instrument Serif"`; an uploaded font uses the object described below.
- Exact colours for the whole film: `brand.tokens` with `background`,
  `foreground`, `accent`, `accent2`, each a #hex. Example:
  `"tokens": {"background":"#101828","foreground":"#f7f7f2","accent":"#b9f24a"}`.
  Omit roles not requested. This keeps one background and exact accents.
  `brand.colors` plus `palette:"brand"` instead adapts a look's palette;
  it preserves the look's changing backgrounds and creates related tints.
- Exact duration: `seconds`. Start with `pace:"normal"`; at a supplied
  BPM, target total scene beats = `seconds * BPM / 60 - 0.5`, rounded.
  The extra half beat is the ending tail. Distribute that budget over the
  requested actions, within each scene's limits. Give complex actions more
  beats and the last card time to read. Do not add filler to meet the clock.
- Letter backs flipping into a line → `letterflip`; a circle changing
  into other shapes with echoes → `polar`; labels scanned into categories
  → `scan`; connected cards with travelling focus → `accordion`; a card
  separating into perspective layers → `explode`; a slider → `dial`.
  Use their fields in the library below. A `morph` changes UI controls,
  not geometric shapes.
- A final line held for two seconds needs its entrance time too: reserve
  at least 3.3 seconds for `endcard` at normal pace (6 beats at 108 BPM).
- A person typing a search query and submitting it → `search`. Supply the
  actual query. After submission, the field folds into a round button.
  Its spinner turns into a checkmark when the search completes.
- An AI assistant thinking, searching, listening or composing → `thinking-orb`.
  Choose its state to match that action; pair it with the user's exact words.
  It illustrates a process and does not prove a result. Do not add it to
  unrelated scenes as decoration. The older `orb` is a different abstract scene.
  Use it only if the project's `source/lib/components/catalog.json` lists
  `thinking-orb`; an older copied project needs a component/template upgrade
  before this type can be used. A refreshed guide alone does not install it.
- Keep one look, font and colour motif across the sequence. A transition
  should carry attention to the next action; do not change style just to
  make a scene different. Use exact supplied words as the visual proof.
- Liquid metal, polished reflective type, metallic rims or a premium metal
  finish ("металл", "жидкий металл", "металлический") → `style:"metal"`.
  Choose `metalVariant:"silver"` for cool silver/steel ("серебро", "сталь"),
  `"gold"` for warm gold ("золото"), or `"chromatic"` for iridescent colour
  ("переливы", "радужный металл"). Silver is the default. "Premium" alone
  is not a request for metal: compare Glass and the other calm looks too.
  Keep an explicit requested style and brand tokens as the base colours;
  do not turn a Glass brief into Metal because it mentions a silver product.
  Chrome remains the sharper Y3K look; Metal uses calm motion and soft sound.
  The Metal look adds animated material to supported headings and rims;
  the reflective finish overlays heading ink. Body/button text and the user's
  screenshots keep their original colours and readable content.
  Shared 3D panels display the finish on their existing surfaces.
  Use it only if the installed `source/lib/compiler/plan.cjs` lists `metal`
  in its exported looks and `source/lib/components/metal/metal.mjs` exists.
  Older copied projects need a template upgrade; a refreshed guide alone
  does not install the material.

### The whole job

1. **The brand.** The film is in the user's own colours and shows their own
   screens, so take them first:
   - A site address: `screenshot_page` with the address and `brand: true`.
     The answer is the brand card: the name, the colours by the job each
     does, the words of the page, and the picture of the page with its path.
   - Uploaded screenshots, photos and videos: open the contact sheet from
     `harness assets --sheet`. Match screens to the features they show,
     photos to the subject of a shot, and clips to the action in their frames.
     Choose the background for each Glass scene when writing the film.
     Follow any placement the user specifies. When a shot has no suitable
     upload, keep its component background.
     Set the chosen file on that scene, for example
     `"background":{"image":"media/<assetId>/original.png"}` or
     `"background":{"video":"media/<assetId>/original.mp4"}`.
     Use the actual filename reported for the upload and the listed SDR copy
     for HDR footage. Check each crop and the readability of the foreground.
   - A reference for the look (only when the user sends a Pinterest link or
     a picture "like this", or asks for references): `find_references` with
     the link or the look in words, `get_reference` for the one that fits,
     then `node source/lib/film.cjs palette <its path>` (any picture's path
     works, an upload's too). It prints `use`: the `style`, `"palette":
     "brand"` and `brand.colors` to write into the film. The picture itself
     never goes into the film: it belongs to its author.
   - A brand named with no address and no files ("a film for Adidas",
     "an ad for Notion"): take the brand's own site once. `screenshot_page`
     with the brand's main address as its name gives it
     (`https://adidas.com` for Adidas) and `brand: true`, then
     `node source/lib/film.cjs brand "<the name>" <the card's json path>`
     (the answer of `screenshot_page` names that path). It says whether the
     page is that brand's. `ok: true`: write its `use` into the film, take
     words from its `words`, and its `picture` is the page's picture for one
     scene that shows the product (`browser`, `laptop`). `ok: false`: put
     nothing of that page into the film, do not try a second address, and
     go on as below. Only for a brand whose name the user wrote; a film
     about an idea, a person or an event has no site to take.
   - Neither: go on with the user's words alone, and say in your answer
     that a site address or screenshots would put their colours and screens
     in the film.
2. Write `source/film.json`: **match the requested actions and words**.
   For an open brief, a ready shape below gives a useful beginning, proof
   and ending. For specified choreography, follow it directly. Short films
   may need only three scenes. Each additional scene must say or show
   something new. Never copy a sample's facts into another product's film.
   From the brand card: `brand.name` the product's name, `brand.url` the
   site, `brand.colors` the accent and one more of its colours (a button's
   fill, a surface) with `"palette": "brand"`, the words from the page's own. With pictures, take the
   shape "A product with its screens" when its scenes fit the brief.
3. Run this one command:

   ```bash
   node source/lib/film.cjs fit && harness audio source/music.py && harness publish -m "<what the film is>" && node source/lib/film.cjs book > derived/storybook.json && harness storybook set --file derived/storybook.json
   ```

   Run it as one ordinary command with a timeout of three minutes
   (`timeout: 180000`) and wait for it, never with `run_in_background`: it
   takes up to a minute, and a command cut off at the default half minute
   goes on in the background, where you would have to wait for it again.
   `fit` checks the film and sets its length, size and look, `harness
   audio` writes the soundtrack on the film's own cues, `harness publish`
   shows it to the user, and `book` writes the storybook from the film
   (harness rule 11: this template's tool keeps it, you never write it).
4. **Review once before finishing.** `fit` prints the resolved colours,
   copy and scene timings. Compare them with the request: exact words,
   every requested action, actual length, brand and the final reading hold.
   Run `harness check` once for the rendered layout/runtime diagnostics.
   If your model can see images, also inspect one contact sheet:
   `harness frames 0 <actual-seconds> --fps 1` (split films over 39 seconds).
   If your model cannot see images, use the text diagnostics and do not
   claim a visual review. After a successful publish, make at most one
   targeted repair-and-recheck cycle for a concrete mismatch that a
   supported `film.json` field can fix. Report any remaining warning.
   `first_frame_empty` and `rotation_pivot_drift` describe rendered motion;
   changing a scene's beats cannot set its initial glyph visibility or
   rotation origin. These need component work if no supported recipe field
   controls the cause. Do not repeatedly change beats or transitions to
   silence them, and never claim that such a change fixed the first frame.
   Do not rewrite a correct film just for a subjective script note.
5. Answer briefly in the user's language: describe what the actual film
   shows. Mention any requested feature you could not achieve; never claim
   a colour, exact duration or visual check that the output does not prove.
   Keep planning notes and tool instructions out of the answer. A sketch
   disclaimer applies while required work, stand-ins or approval remain.
   Once the requested recipe, audio, publication and check are complete,
   report the finished artifact and any concrete remaining limitation.
   Do not call a completed film a rough draft merely because its first
   publication was a sketch. Do not narrate an earlier font or JSON repair.

Do not ask the user to approve a plan or search for skills or implementation
files. Ask a question only when the message gives nothing to make a film
about. A successful publish proves the film runs; the review above checks
that it is the film the user requested.

### Workspace workflow

- Do not run `hyperframes preview`, `play`, `present`, `publish`, `cloud`,
  `lambda`, `cloudrun`, `auth`, `init`, `upgrade`, `tts` or `transcribe`,
  `npx hyperframes ...` or `npm run dev`. The harness owns the live preview;
  use `harness publish`. Render only through `harness export`.
- `source/film.json` is the only recipe file you write. A supplied brand font
  may be copied unchanged into `source/assets/fonts/`; no other code or style
  files are edited. `source/index.html` is set by `fit`; `source/lib/` and
  `source/music.py` are the kit: never edit them.
- Never invent a number, a customer, a price or a feature: the film says
  what the user said. A film that explains a topic says what everybody
  knows, in words and with no figure ("your body is mostly water", never
  "75%", never "within an hour"); a number, a share or a time goes in only
  when the user gave it. No scene that shows a figure (`counter`, `dial`,
  `chart`, `winner`, `tabs`, `overlay`, a `caption` chip with digits)
  without the user's own number.

### film.json

```json
{
  "aspect": "16:9",
  "style": "poster",
  "pace": "normal",
  "brand": { "name": "Motion Fab", "url": "motionfab.app", "colors": ["#c6f36b"] },
  "scenes": [
    { "type": "slam", "beats": 4, "lines": ["AN AI", "MOTION DESIGNER"] },
    { "type": "scatter", "beats": 6, "text": "Describe a *video* in chat" },
    { "type": "agent", "beats": 7, "name": "Motion Fab", "steps": ["Picks the fonts", "Animates the title", "Writes the sound"], "done": "Done. All yours." },
    { "type": "marquee", "beats": 4, "words": ["TYPE", "SHAPES", "SOUND"] },
    { "type": "endcard", "beats": 5, "cta": "motionfab.app", "tagline": "Ideas in motion" }
  ]
}
```

- `aspect`: `16:9`, `9:16` (stories, reels, vertical ads) or `1:1`.
- `lang`: the two letters of the language the texts are in (`"en"`, `"ru"`,
  `"ar"`); leave it out for English. Write every text in the user's
  language; Latin, Cyrillic and Arabic letters have their fonts.
- `style`: one look from the table below. It sets the colours, the type, how
  words arrive, the transitions and the music; pick the one that fits the
  product and the mood.
- `material`: choose `"glass"` for thick glass with a round edge that bends
  the picture behind it like a lens (a full-size glass scene with a `background`
  image or video shows it best), `"dark-glass"` for smoked, frosted glass whose
  text reads over any footage (the one for a small overlay),
  or `"metal"` for opaque metal. The finish applies to the 3D surfaces
  throughout the film, including scenes with their own `look`. Brand colours
  and typography come from `brand.tokens` and `brand.font`. Omit these overrides
  to use component defaults. Choose either `material` or `metalVariant`.
- `metalVariant`: with `style:"metal"`, one of `silver` (default), `gold`,
  `chromatic`. A scene with `look:"metal"` can set its own `metalVariant`;
  other Metal scenes inherit the film's choice. `brand.tokens` controls the
  base colours; the Metal finish overlays supported heading ink and rims.
  Body/button text keeps its exact foreground colour.
  Omitting `material` enables these legacy look and variant recipes.
- `pace`: `chill`, `normal` or `hyper`.
- `brand`: `name` always; `url` when the user gave a site; `colors` one or
  two #hex colours only when the user gave them or the brand card has them
  (else leave it out); `logo` the path of the user's own logo, an upload
  (`harness assets`), as seen from `source/`: the end card and the logo
  scenes (`logo3d`, `hive`, `web`) show it in place of the drawn mark. Only
  a file the user gave: never fetch a logo from the web, and never draw one.
- `app`: the product's own screen, for the scenes that draw one (`laptop`,
  `browser`, `phones`, `ui-float`, `callouts` and the like, when there is
  no screenshot): `{ "nav": ["Classes", "Waitlist"], "title": "This week",
  "stats": [["Booked", "92%"]], "rows": [["Yoga, Tue 18:30", "12 of 12
  booked"]], "status": ["Full", "Open"], "cta": "New class" }`, every part
  optional, in the film's language, from the brand card's own words or what
  the user said. A part left out is drawn as a grey bar: the kit never makes
  up a menu, a person or a figure.
- `brand.font`: one font for the whole film. Use `"Geist"`, `"Archivo"`,
  `"Geist Mono"` or `"Instrument Serif"`, or the user's uploaded brand font:
  first copy the supplied font from the path shown by `harness assets` into
  `source/assets/fonts/` unchanged, keeping its extension, then write
  `{ "family": "Brand Sans", "src": "assets/fonts/brand.woff2",
  "weight": 700 }`. `weight` is optional, from 100 to 900. The uploaded font
  may be WOFF, WOFF2, TTF or OTF. Leave it out for the look's own type.
- `brand.tokens`: exact global `background`, `foreground`, `accent`,
  `accent2` #hex colours. A scene's explicit `bg` or `fg` overrides the
  respective global role. Leave tokens out for the look's colour rhythm.
- `palette`: with `brand.colors`, write `"palette": "brand"` and the whole
  look is repainted in the brand's colours (its grounds and contrast stay).
  Leave it out for the look's own colours.
- `sparks`: dots fly out from behind a word where it lands hard (a slam,
  the end card). The loud and playful looks do it by themselves, the calm
  ones do not; write `"sparks": true` or `false` only when the user asks for
  more or less of it.
- `music`: leave it out and the look's own track and tempo play. To change
  it: `{ "track": "pulse" | "bounce" | "drive" | "air" | "space" | "none", "bpm": 120 }`.
  The sounds of the picture (taps, whooshes, hits) are the look's own kit; for
  other sounds add `"kit": "soft" | "punch" | "tech" | "play" | "cinema"`.
- `scenes`: as many as the requested story needs. A beat is 60/bpm seconds
  (half a second at 120). At normal pace, 30 scene beats plus the half-beat
  tail run 15.25 seconds. `chill` expands and rounds each scene's beats by
  1.2; `hyper` multiplies by 0.75. Use normal pace for precise beat timing.
- Each scene may have `sound`: `{ "gain": 0.7, "kit": "soft" }` changes
  only that scene's effects; gain is from 0 to 2. `{ "mute": true }` silences
  its effects while the music continues. `mapping` changes an effect or
  removes it: `{ "mapping": { "tick": "click", "whoosh": false } }`.
  Leave it out for the scene's usual sounds, timed to its visible actions.
- A `dial` slider can move between chosen musical beats:
  `"timing": { "slide": { "startBeat": 1, "endBeat": 3 } }`. It starts on
  beat 1 after this scene begins and lands, with its chime, on beat 3.
  Use `0 <= startBeat < endBeat`; the last beat must fit inside the scene
  at the chosen `pace`. Leave `timing` out for the usual motion.
- In Glass scenes, use `speed` for the rate of the component's motion
  (0.25–4, default 1). The scene keeps its slot. Faster actions can finish
  early and hold. Slower actions can still be in progress at the cut.
  Uploaded background video plays at its original rate.
- To land a particular action on the music, give its `timing` in beats from
  the start of that scene. Beat 0 is the cut. Fractions are allowed. At
  120 BPM and normal pace, this three-second scene opens at 0.25 s, types
  from 0.50 to 1.25 s, presses Send at 1.50 s and starts its reply at 2 s:
  `{"type":"ask","beats":6,"text":"Ready?","reply":"All set.","timing":{"open":0.5,"type":1,"typed":2.5,"send":3,"reply":4}}`.
  Specify just the actions that matter. Their order follows the component's
  choreography. Pinned actions keep their beats when `speed` changes.
  Between pins, the motion fits the interval. After the last pin, an
  explicit speed above or below 1 controls the remaining motion. The sound
  effects follow the actions. Use `fit` to check the recipe and rebuild the audio
  after an edit. The scene library lists the available actions for each type.
- `seconds`: when the user names a length, always write the number.
  `fit` checks the actual length and gives the beat difference if needed;
  it does not silently retime the music. Adjust beats within the listed
  bounds. Add a scene only when there is another meaningful action or fact.
- Pictures (`image`, `images`) are only the user's own: the page picture of
  `screenshot_page` (`derived/generated/screenshots/<name>.png`) and their
  uploads (`media/<assetId>/original.<ext>`), as paths from `source/`. With
  no picture, use scenes that need none and never write `stock:` or `shot`
  values.

### Ready shapes

For an open brief, adapt one of these. For explicit choreography, follow the
requested actions instead. These fictional examples are not product facts.
Replace every text with the user's own (their
product's name for Nook, what it does for the steps, their site for the
address), keep the texts as short as the ones here, and set `aspect`,
`style` (the table below) and `brand`. Plan beats from the requested length and reading time.

**A launch** (any product, no pictures): the pain, the name, the product at
work, before and after, three words, the end card.

```json
{ "aspect": "16:9", "style": "editorial", "brand": { "name": "Nook", "url": "nook.app" }, "scenes": [
  { "type": "caption", "beats": 4, "text": "Still filling classes [by hand]?", "sub": "Every week." },
  { "type": "title", "beats": 3, "text": "Meet *Nook*.", "sub": "Introducing" },
  { "type": "agent", "beats": 7, "name": "Nook", "steps": ["Posts the class", "Fills the waitlist", "Takes the payment"], "done": "Class full." },
  { "type": "compare", "beats": 5, "before": "Chasing people in chats", "after": "A waitlist that fills itself" },
  { "type": "marquee", "beats": 3, "words": ["FULLER", "CALMER", "NOOK"] },
  { "type": "endcard", "beats": 5, "cta": "nook.app", "tagline": "Explore Nook" }
] }
```

**A product with its screens** (the page picture of `screenshot_page`, or
uploads): the request typed into the product, the site opening, the screen with what matters called
out, a switch, a slammed line, the end card.

```json
{ "aspect": "16:9", "style": "mono", "brand": { "name": "Nook", "url": "nook.app" }, "scenes": [
  { "type": "pullback", "beats": 7, "text": "Show me what Nook can do" },
  { "type": "browser", "beats": 4, "url": "nook.app", "image": "<the picture's path>" },
  { "type": "callouts", "beats": 5, "image": "<the picture's path>", "title": "Everything in one place", "notes": ["Classes", "Waitlist", "Payments"] },
  { "type": "toggle", "beats": 3, "label": "Waitlist on", "kind": "switch" },
  { "type": "slam", "beats": 4, "lines": ["EVERY CLASS", "FULL"] },
  { "type": "endcard", "beats": 5, "cta": "nook.app", "tagline": "Explore Nook" }
] }
```

**A developer tool**: the command typed, the name and version, the tool at
work, what it prints, a slammed line, the end card.

```json
{ "aspect": "16:9", "style": "terminal", "brand": { "name": "Shipit", "url": "shipit.dev" }, "scenes": [
  { "type": "typewriter", "beats": 4, "text": "shipit deploy" },
  { "type": "title", "beats": 3, "text": "*Shipit*", "sub": "Deployment tool" },
  { "type": "agent", "beats": 7, "name": "Shipit", "steps": ["Builds the site", "Uploads the files", "Goes live"], "done": "Deployed." },
  { "type": "code", "beats": 5, "lines": ["$ shipit deploy", "building the site", "uploading files", "live at shipit.dev"] },
  { "type": "slam", "beats": 4, "lines": ["ONE COMMAND", "LIVE"] },
  { "type": "endcard", "beats": 5, "cta": "npm install -g shipit", "tagline": "Deploy in one command" }
] }
```

**A calm brand film** (a studio, a brand, a feeling; no features): three
quiet lines, the name last.

```json
{ "aspect": "1:1", "style": "minimal", "pace": "chill", "brand": { "name": "Bloom" }, "scenes": [
  { "type": "typewriter", "beats": 5, "text": "Every small cafe has a story." },
  { "type": "sentence", "beats": 4, "text": "We give it a face" },
  { "type": "append", "beats": 4, "base": "For", "words": ["signs", "menus", "cups"] },
  { "type": "title", "beats": 4, "text": "*Bloom*", "sub": "Identities for cafes" },
  { "type": "endcard", "beats": 5, "cta": "bloom.studio" }
] }
```

**A vertical ad** (stories, reels): the hook, the tools it replaces, a
switch, before and after, the end card.

```json
{ "aspect": "9:16", "style": "loud", "brand": { "name": "Nook", "url": "nook.app" }, "scenes": [
  { "type": "caption", "beats": 3, "text": "Your classes are [half empty]." },
  { "type": "dock", "beats": 4, "apps": ["💬", "📅", "📝", "💳", "📧"], "open": 1, "caption": "Five tools for one class" },
  { "type": "toggle", "beats": 3, "label": "Nook on", "kind": "switch" },
  { "type": "compare", "beats": 4, "before": "Copy, paste, remind", "after": "It fills itself" },
  { "type": "endcard", "beats": 4, "cta": "nook.app", "tagline": "Fill your classes" }
] }
```

**An app in liquid glass** (a premium product film; no pictures needed):
the request, what it turns on, the result, the line under a lens, the end
card.

```json
{ "aspect": "9:16", "style": "liquid", "brand": { "name": "Nook", "url": "nook.app" }, "scenes": [
  { "type": "ask", "beats": 6, "text": "Fill my Tuesday class", "reply": "The waitlist is ready." },
  { "type": "controls", "beats": 4, "title": "Autopilot", "toggles": ["Reminders", "Waitlist", "Payments"] },
  { "type": "island", "beats": 3, "title": "Class is full", "body": "Waitlist updated", "icon": "check" },
  { "type": "stack", "beats": 3, "words": ["FULLER", "CALMER", "NOOK"] },
  { "type": "lens", "beats": 4, "text": "Every class, full." },
  { "type": "endcard", "beats": 5, "cta": "nook.app", "tagline": "Explore Nook" }
] }
```

**Explaining a topic** ("why drink water", "how sleep works", a lesson; no
product): the question, the answer in one line, the reasons one by one, what
goes wrong without it, the one thing to remember. The brand's name is the
topic in a word or two. For 30 seconds add scenes like the middle ones (one
reason each), never longer ones.

```json
{ "aspect": "9:16", "style": "explainer", "brand": { "name": "Water" }, "scenes": [
  { "type": "typewriter", "beats": 5, "text": "How does water help?" },
  { "type": "orb", "beats": 6, "lines": ["Your body is mostly water.", "It runs on it."] },
  { "type": "steps", "beats": 6, "title": "What it does", "steps": ["Carries oxygen", "Cools you down", "Clears the head"] },
  { "type": "rundown", "beats": 5, "items": ["At your desk", "With a meal", "After a walk"], "punch": "Keep water nearby" },
  { "type": "checklist", "beats": 6, "title": "Make it easy", "items": ["A glass on waking", "A bottle on the desk", "A glass with every meal"] },
  { "type": "gather", "beats": 5, "word": "WATER" },
  { "type": "endcard", "beats": 5, "cta": "One glass now", "tagline": "Then one more" }
] }
```


### Looks

| `style` | What it looks like | Track, bpm |
| --- | --- | --- |
| `editorial` | Cream paper, a bold colour per beat, giant black type | pulse, 122 |
| `poster` | Street poster that moves: black, magenta, acid green, condensed type | drive, 128 |
| `keynote` | Dark graphite, luminous light, glass and depth | air, 110 |
| `blueprint` | Drafting table: blueprint blue, cream paper, grid lines, figure labels | air, 112 |
| `loud` | Cobalt, cream, pink and tangerine. Sunbursts, expanded type | bounce, 104 |
| `mono` | Dribbble-level UI motion: warm gray, black and white, one accent | air, 120 |
| `halftone` | Comic print: cream, primary red, yellow and blue, dots and slams | bounce, 118 |
| `terminal` | Dark tech: black, phosphor green, mono type that decodes, scanlines | drive, 126 |
| `glass` | Deep mesh-gradient light, frosted cards, soft depth | air, 108 |
| `metal` | Liquid metal: polished silver, warm gold or chromatic reflections; calm type, precise rims and soft depth | air, 106 |
| `minimal` | White space, black type, one red dot. Nothing extra | air, 116 |
| `riso` | Risograph zine: fluoro pink and blue ink on paper, serif type, misprints | bounce, 112 |
| `swiss` | International style: red, white, black, grotesk type and big numerals | pulse, 120 |
| `studio` | Premium dark: restrained type, a soft spotlight, real-looking UI in depth | air, 104 |
| `daylight` | Premium light: white canvas, soft blue light, calm type, crisp UI | air, 108 |
| `onetake` | One continuous camera move: scenes slide into each other, never a cut | pulse, 118 |
| `collage` | Paper cut-outs and halftone print, taped together on kraft paper | drive, 124 |
| `sketch` | Hand-drawn: ink outlines that boil like a cartoon, serif type | air, 112 |
| `neon` | Synthwave night: hot pink and cyan glow, a 3D grid floor, stars | drive, 124 |
| `cinema` | Film trailer: letterbox, teal and amber grade, light leaks, serif type | air, 96 |
| `explainer` | Maths-video look: dark slate, chalk type that writes itself, axes that draw on | air, 108 |
| `chrome` | Y3K liquid metal: chrome type, sparks, black and ice blue | drive, 126 |
| `play` | Candy pastels, bouncy vector shapes and confetti, elastic type | bounce, 116 |
| `haze` | Dreamy pastel haze: soft bokeh, glowing light, type that blurs into focus | air, 100 |
| `glitch` | Datamosh: black, white and signal red, RGB split on every beat | drive, 130 |
| `soft` | Modern SaaS: mint and pink mesh light, calm medium type, serif accents, artboard crosshairs | air, 104 |
| `sting` | Brand-agency cut: cream and acid lime, hard cuts on the beat, quiet type, a blue selection caret | drive, 120 |
| `toy` | Glossy pop: white stage, saturated colour rays, chunky bouncy type, shapes that pop | pulse, 120 |
| `scifi` | Moody sci-fi trailer: black scope, amber glow, a HUD, anamorphic flares, wide tracked type | space, 88 |
| `liquid` | Liquid glass: clear panels that bend the light behind them, bright rims, soft colour drifting under the glass | air, 106 |
| `frost` | Liquid glass by day: white light, pale blue depth, clear panels with bright rims | air, 108 |
| `ocean` | Deep navy and aqua: calm water light, white type, one coral spark | air, 108 |
| `sunset` | Warm dusk: plum, orange and rose light, soft type that comes into focus | air, 102 |
| `forest` | Deep green, cream and gold: quiet, natural, a serif headline | air, 104 |
| `sand` | Warm paper and terracotta: an editorial serif, soft shadows, slow moves | air, 110 |
| `mint` | Fresh mint and dark green with a coral accent: friendly product film | bounce, 112 |
| `grape` | Night violet with lilac and lime: a bold launch with a glow | drive, 124 |
| `ember` | Black with orange and amber: sparks, heavy condensed type that slams | drive, 126 |
| `ice` | Cold white and blue: clear, precise, thin light type | air, 110 |
| `candy` | Pink, yellow and sky blue: playful shapes and bouncy round type | bounce, 116 |
| `noir` | Black and white with one yellow accent: hard light, strict grotesk | pulse, 120 |
| `royal` | Navy and gold: a serif headline in a soft spotlight, slow and sure | air, 98 |
| `lava` | Magenta into orange on black: hot gradients, big type, a bloom | drive, 124 |
| `clay` | Muted terracotta, olive and cream: hand-made warmth, soft bounce | bounce, 112 |

### Scene library

Pick from these only: a type or field that is not here is refused by `fit`.
After each name are its fields (`?` may be left out,
`[2-5]` is how many items a list takes), what it shows, and its usual length
in beats. Text longer than a scene fits is refused by `fit` with the limit.
The kit writes no words of its own: every word on screen is one you wrote,
in the film's language. So give the optional labels when a scene should have
them (`compare`: `beforeLabel`, `afterLabel`; `drag`: `label`, `button`;
`morph`: `label`, `text`); left out, the scene shows none.

- prompt {text, placeholder?}: a chat box typing the request, cursor clicks send. Great opener. 4-6 beats.
- title {text, sub?}: giant display words, per-letter spring. sub = tiny mono label above ("INTRODUCING"). 2-3 beats. text <= 4 words.
- highlight {text, mark?, sub?}: a line of words; wrap ONE word in *asterisks* to get a marker swipe behind it. 3-4 beats. text <= 7 words.
- swap {lead, from, to, pill?}: "Not just" + from -> from slides out, a coloured pill with "to" springs in. 3-4 beats.
- fullbleed {text, variant?}: ONE word filling the frame on a flat colour. variant "repeat" = rows of outline type. 1-2 beats. text <= 10 chars, often CAPS.
- grid {words[3-6]}: typographic tiles popping on half-beats, reads as one sentence ("THE","FUTURE","IS","HERE"). 3-4 beats.
- wall {images?, words?}: zoom out from one card to a tilted 3D wall of many cards. Use when there are screenshots, or to show "everything you can make". 4-5 beats.
- ui-macro {image?, target?, typeText?, click?}: extreme crop on a screenshot region with typing + giant cursor click. target = {x,y,w,h} as 0-1 fractions of the image. 4-5 beats.
- ui-float {image?, caption?}: screenshot as a floating tilted card over its own blurred copy, caption above. 3-4 beats.
- counter {value, prefix?, suffix?, label}: a number counting up. ONLY with a real number the user gave. 3 beats.
- toggle {label, kind?}: a giant switch/checkbox/slider flipping on, cursor clicks it. kind: switch|checkbox|slider. 3 beats.
- logo3d {text?}: the logo as a spinning cube landing flat, name beside it. 3-4 beats.
- endcard {cta, tagline?}: logo + name assembling + a CTA pill (the URL). Always last. 4-6 beats.
- slam {lines[1-4], crumbs?[]}: poster stack, each line (<= 3 words) slams in on its own beat; the last line echoes. crumbs = tiny mono fragments (<= 18 chars) that decode around it. 1 beat per line + 1.
- morph {states[2-10], label?, text?}: ONE UI shape morphing through states, one per beat, a cursor clicking each change. states from: button, loader, check, toggle, slider, player, tabs, search, toast. label = the button's word, text = the toast/search text. beats = number of states (or 2x for calmer).
- steps {title?, steps[2-4]}: a progress ring filling as numbered steps land. "How it works". 5-7 beats.
- ticket {title, rows[[label, value] x1-4], stamp}: a ticket card types its rows, then a stamp (1-2 words: SHIPPED, APPROVED, LIVE) presses down. 4-5 beats.
- marquee {words[2-8]}: three ticker bands of big type sliding across the frame. A call to action or a list of what it does. 3-4 beats.
- phones {images?[], caption?}: three phones fanning out showing screens. For mobile apps or "on every feed". 4 beats.
- caption {text, sub?, image?}: a sentence with ONE inline chip in [square brackets] ("Your rival just hit [$100,412] in MRR."); a number in the chip rolls up. Hook opener. 4 beats.
- typewriter {text, erase?, then?}: typed on a blank page with a human rhythm. erase = characters to delete from the end, then = what gets typed next. 4-6 beats.
- sentence {text}: a big sentence (<= 8 words) landing word by word, every other word in a colour. 3-4 beats.
- append {base, words[1-6]}: a fixed word, the next one cycling on the beat ("Zero" + alignment / momentum / busywork). 1 beat per word + 1.
- countdown {from, label?}: 3, 2, 1 then the label (LIVE, NOW). 1 beat per number + 1.
- stat {value, prefix?, suffix?, label, trend?}: rolling digits with a trend line drawing under them. ONLY a real number from the brief. 3-4 beats.
- chart {kind, values[2-12], labels?, title?, unit?}: kind line|bar|pie|ring drawing in. ONLY real numbers. 4 beats.
- timeline {title?, items[2-6]}: a roadmap line with milestones landing in turn. 4-5 beats.
- pricing {name, price, period?, features[1-5], cta?}: a pricing card springs up, features tick in, the cursor clicks the button. Only a real price. 4-5 beats.
- globe {label?}: a dotted globe turning with arcs between points. "Used everywhere", "works offline anywhere". 4 beats.
- code {title?, lines[1-14]}: a code editor typing real-looking code (<= 70 chars per line). For developer tools or APIs. 5-6 beats.
- chat {messages[{me, text} x1-6]}: a chat thread, bubbles popping in with typing dots. A tiny story in 2-4 messages. 5-6 beats.
- notify {items[{app, title, body?} x1-5]}: notifications stacking on a dark lock screen. 4 beats.
- dock {apps[3-9], open?, caption?}: a macOS dock (emoji icons), cursor sweeps and magnifies them, clicks one and dives in. "Too many tools". 4-5 beats.
- chaos {text}: browser windows piling up around a phrase ("Twelve tabs later..."). The problem, before the product. 3-4 beats.
- laptop {image?, caption?}: a laptop with the screenshot; the camera dives into the screen. 4-5 beats.
- browser {url, image?}: a browser window, the URL types in, the page loads. 4 beats.
- callouts {image?, title?, notes[1-4]}: a screenshot with labelled callout pills popping out of it. 4-5 beats.
- compare {before, after, beforeLabel?, afterLabel?}: a before/after wipe dragged by the cursor ("Two weeks in After Effects" -> "Forty seconds"). 4-5 beats.
- inline {text, images?[], items?[]}: a sentence with [ ] where pictures open between the words and stack up ("Inspiration [ ] everywhere?"); with screenshots it ends by zooming into the last one until it fills the frame. items = up to 6 short words or emoji shown on the cards when there are no screenshots. 4-6 beats.
- bubbles {questions[3-8], answer?}: chat-input pills with the questions people keep asking float in depth over soft light, then fly away as the answer is typed in the middle. The problem, told as questions. 6-9 beats.
- retype {label?, from, to[1-3]}: one big value typed, then selected and typed over, like an editor ("Hourly rate": "$160" -> "$500"). Contrasts, prices, "edit anything". Only real numbers. 5-7 beats.
- orbit {text}: a calm sentence (<= 8 words) landing word by word inside thin line-art orbits with travelling dots. A big idea, a belief. 4-5 beats.
- checklist {title?, items[2-5]}: a to-do list types in and the cursor ticks every item. "How it works", or the busywork it removes. 5-7 beats.
- tiles {text}: a short word (<= 12 chars) on letter tiles that tumble from above and land in a row. A punchy name or a call ("SHIP IT"). 3-4 beats.
- mosaic {text, images?[], notes?[]}: the frame splits into panels of screenshots and product screens with crosshairs, one big italic word over it all. "Everything in one place". 4-6 beats.
- cards3d {titles?[], images?[]}: REAL 3D: thick glossy cards cascade in one by one, tilted in depth, lit like a product render. titles = 2-5 short labels (the pains, the features) when there are no screenshots...): the cards then carry real objects, like a product render. 4-6 beats.
- icon3d {text?}: REAL 3D: the brand's app icon as a glassy tile spinning in, glossy shapes orbiting it, the name landing below. A hero reveal or an ending before the endcard. 3-4 beats.
- phone3d {images?[], caption?}: REAL 3D: 1-3 phones swing round from the side to face you, screenshots on their screens. For mobile apps. 4-5 beats.
- roll {lead, words[2-6]}: a fixed lead and a last word that rolls vertically like a slot machine with selection handles ("Still answering" + tickets / emails / chats / DMs). The pile of small jobs. 4-6 beats.
- stream {text, images?[], items?[]}: a river of screenshots or picture cards pouring diagonally past one word in the middle ("Inspirations"). Abundance, "everything you make". 4-5 beats.
- photo {text, image?}: a full-bleed screenshot or photo slowly pushing in, captions word by word in the lower third; *word* goes bold italic. Only with an image. 4-7 beats.
- journey {text, wheel?[]}: the camera TRAVELS along one sentence as its words arrive, with motion blur, and the last word is a wheel that rolls through options ("You're still answering" + tickets / emails / chats / DMs), then pulls back to show the whole line. The most cinematic opener. *word* is accent. 6-8 beats.
- faces {text, images?[]}: real people floating at different depths (some out of focus) around a short line ("Ending up in just one inbox"). 4-5 beats.
- shuffle {from, to}: a sentence breaks apart and its words fly in arcs to form the next one; shared words travel, others blur away or arrive ("Your launch video takes weeks" -> "Your launch takes one prompt"). Before/after in one move. 5-6 beats.
- trail {text, warm?}: black frame, glowing neon light streaks sweeping round an input pill that types a short line ("Pay in one tap"). warm=false for cool streaks in the accent colour. A striking 2-second hook or a feature beat. 3-4 beats.
- dot {word, lead?, ring?[]}: ONE ball carries the whole scene, like a motion designer's film: the lead word's letters tumble away ("Reduce" Motion), a ball drops and bounces into place as the dot on the i (or a full stop), then rolls off, floods the frame in the accent, morphs circle -> square -> diamond -> pill and ends as a dot with ring[] words orbiting it in 3D. A signature moment, at most once per film. 7-8 beats.
- flip {lead, words[2-5], icons?[2-5]}: "Explore [card] history" (lead + each word must read as a natural phrase): a card in the gap of the sentence flips to a new face (an emoji or a picture) as the last word rolls to the next one, with doodle sparkles; then the cards fan out and swing together into a pinwheel mark. The range of what it does. 6-8 beats.
- pullback {text, chips?[]}: GIANT typing that fills the frame (an "@Name" gets a dropdown and turns into a coloured mention), then the camera pulls back to reveal it was typed inside the product's input box, chips[] land on top and the cursor clicks send. The best "how you use it" opener for AI products. 6-8 beats.
- between {lead, words[1-3], cta?, images?[], ground?}: "Book [phone] a table": lead + each of words[] must read aloud as a natural phrase ("Book a table", "Book a ride", "Book it all"), never lead "Open" + "a table". A phone lands in the gap of the sentence, the words slide out from behind it, a finger taps through the app (each tap pushes a new screen and rolls the last word: "a table" -> "a ride"), and the last tap folds the cta button into a check with a burst. For mobile apps. ground:true paints a soft gouache backdrop. 6-8 beats.
- drag {text, label?, button?, files?[3], images?[], ground?}: hands-on: files lie on the desk (names like "brief.pdf", "demo.mp4"; images = real photos), the cursor drags each into the product's drop zone, quicker each time, they upload and get checks, the cursor clicks the button and the line lands where the files were. For anything you feed files to. 7-8 beats.
- pack {word}: circles of every size pop in and pack the frame round one word in the biggest circle, then scatter outward. Abundance, "everything", a category word. 4-5 beats.
- swarm {text?, images?[]}: dozens of pictures (images = the user's photos or screenshots) hang in 3D at every depth while the camera pushes through, then fly out past the lens and the text lands in the clearing. Scale, "every idea", a community, a library. 5-7 beats.
- split {words[2-5], images?[], items?[]}: a coloured panel holds one big word that swaps ("Posters." "Covers." "Merch." "Motion."), beside it a grid of tiles reshuffles with each word (images = the user's photos or screenshots; items = emoji when there are none). Use cases, outputs, "everything you can make". 6-8 beats.
- montage {lines[1-5], images[]}: a brand film's rhythm: full-bleed photos (the user's photos, 2 per line) cut fast with a slow push on each, and between them each line set small on a plain card ("The charts keep moving." / "Which one are you *backing*?"). Emotional, cinematic, about people and the world. 7-10 beats.
- web {words[4-16], keys?[<=4]}: the product's mark in the middle, the words that describe it on rings around it, each joined by a hairline; the camera turns slowly in 3D and the keys light up in turn. "Everything it connects", features, an ecosystem. 6-8 beats.
- picker {items?[6-24 emoji], pick?, text?}: a big grid of icon tiles, close up; a selection ring hops tile to tile while the grid slides, then the pick lifts out, the rest dim and text lands under it. Choice, variety, "pick anything", emoji, templates, themes. 4-6 beats.
- palette {query, results[2-6], pick?}: a command bar (Raycast/Spotlight style): the query types into a big search bar, the results under it ("📋 Clipboard History", emoji + 2-4 words) filter live as letters arrive, the selection slides to the match, Enter opens it. For productivity tools, launchers, search and anything with commands. 6-7 beats.
- agent {name?, steps[1-5], done, result?}: the product at work: the product's name with a spinner and running dots, the tasks (<= 6 words each, real things the product does: "Categorizing transactions", "Reconciling accounts") arrive one under another and check off, then the header becomes the done line ("Financial statements ready.") and an optional result card slides up. THE scene for AI agents and automation. 6-8 beats.
- particles {text}: a constellation of drifting dots joined by faint lines flies in and settles into the line, then tightens into solid type. A big claim, an AI or "intelligence" moment. 5-7 beats.
- wave {text, label?}: a voice player: a live waveform in a pill, the transcript (text = what the voice says, <= 12 words) appears under it word by word, karaoke-lit; label = a small line above ("80+ voices, one tap"). Voice, audio, calls, assistants. 5-7 beats.
- arc {text, words?[≤3], images?[]}: a short line set small and high ("Your business is *different*", the *word* rolls through words[]), under it a strip of photos rides an arc, biggest in the middle, drifting sideways. images = the user's photos. Calm, human. 5-7 beats.
- orb {lines[≤3]}: a glowing sphere of the brand's colours, the colours turning inside it, breathing; short calm lines take turns under it ("It listens." / "It remembers."). The product as a presence: AI, voice, assistants. 5-6 beats.
- scatter {text, icons?[≤5]}: a sentence spread loose over the frame in small type, words arriving in reading order with little objects (emoji tiles) dropping into the gaps; then everything flies out except the *key* word, which glides to the centre and grows. Mark the key word with *stars*. 5-7 beats.
- knockout {word, text?, image?}: the AE zoom-through: the frame is the background with one giant word CUT OUT of it, the product (image = a real screenshot) shows through the letters, then the camera dives into a stroke until the product fills the frame and settles into a card with text above. A strong opener or reveal. 5-7 beats.
- assemble {word, text?, italic?}: a ransom-note word: each letter lands on its own paper scrap in a different typeface, flickers through two more, then the scraps drop and the letters glide into one quiet serif word ("Intelligence."). An editorial, crafted moment for a single big idea. 5-6 beats.
- hive {icons?[≤12], labels?[≤3], word?}: a honeycomb of empty slots opens around the logo, the product's tools (emoji icons) fly in and land in their slots, labels name a couple, then the hive pulls into the mark and the name lands beside it. "All your tools, one place." 6-7 beats.
- field {text, values?[]}: REAL 3D: a floor of rounded tiles to the horizon; a glowing bar sweeps across, the tiles ripple, a row rises into accent bars (values = real numbers, or leave out) and the camera cranes up over the whole field; the line sits lower left. A world, not a slide. 6-7 beats.
- overlay {image?, text?, cards[1-3]: {label, value, prefix?, suffix?}}: a full-bleed photo with 1-3 glass cards floating over it, each number rolling up ("Training cost", 1083, "$"). ONLY real numbers from the brief. Only with a photo the user gave. 5-6 beats.

Liquid glass and scenes of this kit. A glass panel keeps its own ground in
every look: a deep blue backdrop with light text, whatever `style` the film
has. Give it the user's photo or video with `background`, or the brand's own
colours, to change that; never pick a look for the sake of a glass scene.
A glass scene over the user's footage is an overlay: give it `background`
with their video or photo, and say where the panel stands with `place`
(top-left | top | top-right | left | middle | right | bottom-left | bottom |
bottom-right; middle unless said) and how large it is with `size` (normal |
small; small is six tenths, so keep its texts short).
Put the panel where the footage is quiet, not over a face. Over footage
set the film's `material` to `"dark-glass"`: it is frosted and its text
reads, while clear `"glass"` is all but transparent and a small panel of it
is lost on a busy picture. `place` and `size` are fields of `island`,
`controls`, `ask`, `search`, `glass-steps`, `glass-checklist`, `glass-like` and `glass-rating`; the other glass scenes fill
the frame and take neither:

- thinking-orb {state, title?, body?, orbSpeed?, size?, tint?}: the original Thinking Orbs particle motion for an AI assistant or process, with optional supplied title (48 characters) and body (100). Choose the semantic action: working = processing, searching = research, solving = reasoning, listening = voice input, connecting = linking, weaving = synthesis, composing = writing/music, breathing = idle/ready, shaping = creation. Use when that action belongs in the story, not as generic decoration or evidence that a task really ran. orbSpeed = 0-4 (default 1); size = .25-1 of available space (default 1); tint = palette name or opaque #RGB/#RRGGBB (default brand accent). 4-6 beats.
- island {title, body?, icon?, camera?, exit?, background?}: an optical glass capsule opens into a dimensional card; its editable title follows the surface. camera = orbit (default: gentle push and arc) or static. exit = hold (default) or collapse (fold to a capsule and leave the frame). Optional icon uses a monochrome SVG: check, info, alert, close, plus, star, heart, bell, sparkles, or arrow-right. Existing emoji input remains supported. Glass, Dark Glass and Metal share the same layout and camera. For continuous travel between two cards use glass-flow. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, opened, collapse, exit. 3-4 beats.
- glass-steps {items[2-4], title?, camera?, exit?, background?}: an optical glass panel explains a process: it grows out of a pill, its title comes in, then the steps one after another, each a numbered badge that pops and a line that settles under it ("Upload your footage", "Pick a style", "Export in 4K"). items: what happens at each step, a short phrase of up to 48 characters and 8 words, in order; the numbers are drawn for you. Columns in a wide frame, rows in a square or tall one, and rows too when the phrases are long. camera = orbit (default) or static. exit = hold (default) or collapse (the steps hop in a wave and the panel folds away). Keep a step to a few words: every step must be read before the scene ends, about a beat for each two words after the last step comes in, and a scene too short for its steps is refused with the beats it needs. Over a photo or a video of the user's it is a slide of a presentation or an overlay for b-roll. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, title, items[], wave, collapse. 6-12 beats.
- glass-checklist {items[2-5], title?, done?, camera?, exit?, background?}: an optical glass panel ticks a list off: it grows out of a pill, its title comes in, then the items one after another, each an empty box, a line read word by word and a tick drawn into the box ("Brief approved", "Footage uploaded", "Captions checked"). items: what is done, a short phrase of up to 40 characters and 7 words each, in order. done = how many of them are ticked, from the top (default: all); the rest keep an empty box, for a list still in progress. camera = orbit (default) or static. exit = hold (default) or collapse (the rows go and the panel folds away). The scene is as long as its list: about a beat an item plus a beat for the last tick, and a scene too short for its list is refused with the beats it needs. For a process in numbered steps use glass-steps. Over a photo or a video of the user's it is a slide of a presentation or an overlay for b-roll. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, title, items[], ticks[], leave, collapse. 6-12 beats.
- glass-like {text, icon?, camera?, exit?, background?}: an optical glass button is pressed: a pill grows out of a round seed with an icon and a word, a pointer comes up and clicks the icon, a ripple runs the pill and the icon fills with colour. text = the word on the button, up to 12 characters ("Like", "Follow", "Subscribe", "Save"); it does not change when pressed. icon = like (default: a thumb), heart, star, bell, save (a bookmark), plus or check; pressed, it takes the brand's accent, or a clear green without one. camera = static (default) or orbit. exit = hold (default) or collapse (the pill folds back into its seed and goes). Over a video of the user's it is the call to like, follow or subscribe laid on the footage: say where it stands with place and size. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, reach, click, collapse. 4-8 beats.
- glass-rating {title?, stars?, caption?, camera?, exit?, background?}: an optical glass panel gives a rating: it grows out of a pill, its question or name comes in, then five stars fill with gold one after another up to the rating, and a line under them says it in words. title = what is rated or the question asked, up to 40 characters ("How was your stay?", "Nook for iPhone"). stars = the rating, 0 to 5 in whole or half stars (default 5; 4.5 fills the fifth star to its middle). caption = one line under the stars, up to 36 characters, for the number and where it is from ("4.8 out of 5 from 1,240 reviews"); state only a rating the user gave you. camera = orbit (default) or static. exit = hold (default) or collapse (the panel folds away). The stars take the brand's accent when the film has one. Over a photo or a video of the user's it is a review laid on the footage: say where it stands with place and size. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, title, stars[], caption, collapse. 4-8 beats.
- widgets {items[{label, value} x2-4], title?, background?}: glass tiles, each a label and a big figure that counts up ("Bookings" "1,240", "Rating" "4.9", "Faster" "3x"). ONLY real figures the user gave. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports items[], settled. 4 beats.
- controls {title?, toggles[2-4], slider?, camera?, background?}: an optical glass control panel whose switches turn on one after another and whose slider fills. Its title, labels and controls follow the same 3D surface, with the shared card typography, padding and gaps used by island and glass-flow. camera = orbit (default: gentle push and arc) or static. Glass, Dark Glass and Metal use the same control geometry and timing. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, toggles[], slider, sliderEnd. 4 beats.
- sheet {title, rows[2-4], cta, background?}: a glass sheet rises from the bottom with a title, a few rows that tick themselves and a button that is pressed ("Book a class", "Pick a time", "Pay in one tap", cta "Confirm"). A flow in one screen. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, rows[], press. 4-5 beats.
- ask {text, reply?, camera?, background?}: a round icon opens into a 3D prompt bar. The request types, the send button presses and the same panel expands below the prompt for an optional reply. Both texts follow the panel. The camera defaults to orbit and can also be static. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, type, typed, send, reply. 5-6 beats.
- lens {text, sub?, camera?, background?}: a lens glides across the fitted headline. Glass and Dark Glass refract the lettering. Dark Glass adds a smoked tint. Metal covers the lettering as it passes. camera = static (default) or orbit for a gentle changing angle. Copy stays editable through the component fields. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports sweep, sweepEnd. 3-4 beats.
- search {query, placeholder?, background?, speed?, timing?}: use when a user enters and submits a search query. The empty field displays "Search..." until typing begins. Set placeholder to your own hint or to an empty string to leave it blank. The cursor clicks the field, types the query and clicks Enter (↵) inside its right edge. Each click sends a light wave through the field that bends its glass and the text under it. A wave runs for up to 1.2 seconds: the first has left by the search beat and the second by checked, so pinning those sets its pace. A spinner turns while the field folds into the round button. Pin collapse to the start of the fold, collapsed to its end and checked to the beat when the spinner becomes a checkmark. The checkmark holds through the end of the scene. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports focus, type, typed, search, collapse, collapsed, checked. 4-8 beats.
- send-prompt {text, chips?[], background?, speed?, timing?}: a user types and sends a prompt. The camera tracks the caret and pulls back to reveal the glass composer. An @mention in the prompt is highlighted once it is typed. Use chips for up to three author-supplied context labels above the prompt, such as the sections covered by a report. Omit chips to show just the prompt and controls. Pin pull and landed to music beats to set the duration of the camera move. The send beat launches a distortion wave from the button. The wave clears the composer by sent. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports type, typed, pull, chips[], landed, send, sent. 6-14 beats.
- glass-flow {title, body?, nextTitle, nextBody?, background?}: two optical glass cards in one persistent 3D world. A capsule opens into the first card, the camera pushes in with a small orbit and flies through its glass toward the second card. Both editable titles follow their surfaces. A continuous two-message reveal; use instead of joining separate island scenes when a single camera must travel between cards. Optional speed (0.25–4×) and action positions in local beats from 0. timing supports open, opened, title, titleShown, flight, cross, land, nextTitle, nextTitleShown. 14-20 beats.
- stack {words[2-4]}: big single words stacked down the frame, one per beat; as each lands the ones above dim, so only the newest is lit ("FASTER", "CALMER", "FULL"). Three values, verbs or steps as a triad. 3-4 beats.
- beatwords {words[3-6]}: one word a beat, each alone and filling the frame, the ground flipping on every cut and each word with another entrance ("NO", "MORE", "EMPTY", "CLASSES"). A hook or a slogan said one word at a time. One beat a word: 3-6 beats.
- underline {text, tag?}: ONE word, huge; its letters rise from behind the baseline one after another and an underline draws under it; tag = a small label in brackets above it ("FULL", tag "every class"). The one-word punch after a build. 2-3 beats.
- rundown {items[2-5], punch}: a list builds one line a beat, each new line the only lit one, then the whole list steps back and a big punch line lands under it ("Chasing invoices", "Copying numbers", "Fixing typos" then "All gone."). The busywork a product removes, or what comes in the box, with the verdict. 4-6 beats.
- winner {title, value, options[3], pick?}: a card counts its figure up and draws its curve, then three options rise under it and the product picks one: two fade, the winner lifts with a tick (title "Best time to post", value "9:40", options "Mon 8:00", "Wed 9:40", "Fri 18:00", pick 2). The product compares and chooses. ONLY a real figure. 5 beats.
- connect {sources[2-4], target}: pills on the left (what goes in) each joined to one tile on the right (the product) by a dotted curve that draws itself, with a light running along it ("Instagram", "WhatsApp", "Email" into "Nook"). Everything flows into one place. 4-5 beats.
- chips {text, chips[5-12]}: a headline with labelled chips all around it at different depths; they come into focus one by one, then fly past the camera and clear the frame ("All of it, handled", chips "Bookings", "Waitlist", "Payments", "Reminders", "Reviews"...). Everything at once around one line. 4-5 beats.
- tabs {items[{label, value} x3]}: a card with three figures in a row; a lit panel hops from one to the next, each figure counts up as it is reached and the chart under them bends into another shape ("Booked" "92%", "Waitlist" "38", "Saved" "6h"). Three numbers of a product in one shot. ONLY real figures. 5-6 beats.
- dial {label, value, unit?, timing?:{slide:{startBeat,endBeat}}}: a slider whose knob is dragged to a value out of 100 with a bubble above it counting as it moves; the ticks it passes light up (label "Classes full", value 92, unit "%"). timing.slide stretches the same gesture between musical beats counted from this scene's start; its arrival chime lands on endBeat. Without timing the original gesture is unchanged. One share or score, shown as something moved. ONLY a real figure, 1-100. 3-4 beats.
- gather {word}: some fifteen hundred dots drifting over the frame fly together and become ONE big word ("IDEAS", "Nook"), it holds solid, then bursts: the word swells and every dot is flung clear of the frame. The name, or the one word the film is about; as an opener or right before the end card. One word, two short ones at most. 4-5 beats.
- impact {text, lead?}: the drop. A ring of speed lines flies outward and the word slams in behind it, overshoots small and springs to rest ("SHIPPED", "50% OFF", the name). lead: a small line that waits before the drop ("Introducing", "And now"); without it the slam is the first thing seen. One or two words. As the opener, or for the one thing the film announces. 3-4 beats.
- polar {shapes?[circle|triangle|star|square x2-5], label?, satellites?}: one springy shape morphs through a sequence with turning echo outlines and smaller orbiting copies. A change of state or an abstract product identity. Optional label is the user's message; satellites defaults to true. 3-5 beats.
- letterflip {text}: a short headline reveals letter by letter, each turning 450 degrees in perspective and flashing the accent on its back before landing flat. The brand font is preserved; joined scripts turn as whole words. A punchy opener or feature name. 3-4 beats.
- accordion {items, images?}: 3-5 named picture cards breathe like an accordion: a travelling focus enlarges each card, then a staggered wave moves the stack. Dashed bounds and curved tethers follow the real card handles. items: short feature or process names, up to 24 characters; optional local images replace the abstract artwork in order. A horizontal row in landscape, a vertical stack with side labels in square and portrait. 5-7 beats.
- explode {layers, title?}: one flat card tilts into depth and separates into 3-5 named planes, turns slowly while held apart, then closes into one card again. Flat labels and fine leaders explain each plane without tilting the words. layers: short names of actual parts or stages, up to 24 characters; title: optional heading. 5-7 beats.
- scan {items[{label, category?} x3-6], categories[2-4], image?, title?, scanning?, complete?}: a luminous band scans a sheet of objects; a label and corner brackets appear exactly when the band crosses each object, then the crops lift and fly into category cards, filling their badges. category is a 1-based index into categories; omit it to distribute objects in order. image is an optional supplied sheet/photo divided into the same object crops; without it, the objects are brand-coloured geometry. scanning and complete are optional user-written status lines. Use short 1-2-word item labels. At normal pace, allow more time for longer labels, longer status lines or faster music, and check readability after changing the timing. 7-9 beats.
- before-after-wipe {before, after, images?[2], split?, title?}: one sine-eased divider reveals the supplied after image over the before image and holds at split (10-90%, default 50). Labels remain readable outside the wipe. Without images, shows abstract brand geometry, not a product screenshot. Use real matched before/after assets. 5-7 beats.
- screen-flow-carousel {screens[{label} x2-5], images?, title?}: screen rail throws to the next screen and catches gently; neighbours recede. Labels are outside screen crops. images are supplied local screenshots, one per screen; omitted images use abstract brand geometry. One action per screen; allow time to read each label. 7-12 beats.
- chart-story {chart?: bars|line|donut|progress, items[{label,value} x2-5], unit?, title?, emphasize?}: chart builds, labels arrive, then one exact figure settles. emphasize is a 1-based item index, default last. Values are finite 0-1000000; donut requires a positive total. ONLY numbers supplied by the user; never invent proof. 7-10 beats.
- testimonial-proof-card {quote, name, role?, company?, emphasis?, image?}: measured quote lines rise through masks; author appears as they land, then a drawn underline marks emphasis. emphasis must occur verbatim within quote. image is an optional local portrait. Use only an actual supplied quote and attribution; do not invent endorsements. Long quotes need more time or separate excerpts. 8-12 beats.
- modal-morph {title, body, cta, eyebrow?, register?: calm|snappy}: a compact card expands into a panel with persistent keyed content; child counter-scaling preserves text while the surface morphs. Body and action arrive in the last part of the expansion. This is one continuous shared-element move, not a second camera. 6-9 beats.
- ride {stops[{kind, label, value?} x2-6], title?}: ONE white ball rides through real controls in one continuous camera move, never a cut: it drops in, becomes the thumb of a switch and flips it, hops to a slider and drags it to its value with a counting bubble, lands on a button and presses it, ticks a checkbox, bounces a stepper up to its number, then the camera pulls back and every control is seen in its new state under the title. kind is switch | slider | button | check | stepper; label is the control's own short name ("Focus mode", "Brightness", "Start"); value is the slider's target out of 100 (default 80) or the stepper's count 1-9 (default 3). Every landing is on a beat when the scene has the beats (with fewer it still plays, squeezed and off the beat, and fit says how many it needs): give it stops + the units of its actions + 3 (a slider is 2, a stepper of 9 is 5, of 7-8 is 4, of 5-6 is 3, of 3-4 is 2, anything else 1; three stops with one slider need 3+4+3 = 10 beats). For a product's settings, a setup in a few taps, "it is this easy". 8-24 beats.
- lens-wall {images?[1-24], videos?[1-7], path?, tiles?}: an endless wall of pictures and videos under a lens: whatever is in the centre is three times larger and the rest curve away like the side of a sphere, while the camera crosses the wall and the videos play in their tiles. The wall has seven example videos of its own (a neon street, an arcade, old screens, a city, a disco ball, a dance) and plays them when the scene names no files. images and videos: the user's own files take the examples' places one by one, so three of theirs play among four examples and seven or more leave none; give every file the user has for it. path: how the camera moves, drift (a straight glide, default) | orbit (a circle) | wave (a glide that sways) | eight (a figure of eight) | zigzag. tiles: portrait (default) | square | landscape, the shape every file is cropped to. No words: put the line before or after it. Use for a gallery, a portfolio, a trip, "everything you made this year". 4-12 beats.
- comic {text}: a paragraph (4-28 words) glitches in word by word like a comic still on the press: each word flickers through tilted colour panels with a patch of red halftone dots and torn slices of itself in cyan, magenta and yellow, stands bold with its colours out of register, then settles into the line; now and then a word that has settled glitches again. It moves in steps, 24 a second. For a quote, a manifesto line, a punchy statement that should be read whole; not for a headline of two words. Two words a beat read well, three at most: 4-10 beats.

COMMON FIELDS on every scene: type, beats (1-32), bg? (palette name or a hex colour like "#ffffff"), fg? (text colour, palette name or hex), plain? (true = no style decoration behind it: a clean background), in? (transition into this scene), look? (a style id for this one scene; rarely: one scene that should stand apart).
Usually OMIT bg and in: the chosen style already sets a colour per beat and its own transitions. Set bg only for a deliberate emphasis.
PALETTE names for bg/mark/pill: paper, ink, lime, sage, peach, electric, coral, sky, lilac, butter, brand, brand2.
TRANSITIONS: cut, whip (fast sideways blur), circle (reveal from centre), zoom (zoom through), wipe (diagonal bar), push (vertical), glide (carousel slide), scan (scan line), iris (camera aperture), flood (liquid colour fill), halftone (dot dissolve), glitch (torn signal bands), shutter (slats opening), flip (3D card flip), flash (lens flash to white), dots (particle sweep), pixels (the frame breaks into square blocks that switch to the next shot, accent blocks on the seam), open (the next shot opens out of the old one like an app from its icon).
3D HALFTONE: the real-3D scenes (cards3d, icon3d, phone3d, field) take halftone: true, which prints the 3D object as a one-colour dot screen (a duotone print). Use it in graphic, poster-like or retro films, never in every 3D scene.

### Rhythm

- Hit the target length at the given bpm. Fast: most scenes 2-4 beats; something new every 1-2 seconds.
- Open with a hook in the first second (prompt, title or slam). End with endcard (logo3d before it is optional).
- Alternate type-led scenes with UI scenes. Use every picture the user uploaded at least once.
- Give the film ONE or TWO signature moments, the scenes a motion designer would remember (pullback, dot, knockout, hive, orb, between, drag, field, flip, assemble, scatter, arc), placed where the story turns. Never more than three: the big ones need simple scenes around them to land.
- Never the same scene type twice in a row, and no type more than twice in a film (fullbleed punches excepted).
- At most 60% of scenes may be type alone on a colour (title, highlight, slam, sentence, append, fullbleed, grid, marquee...). The rest show an object, the product, people or a world.

### Words

- Every line a complete thought. Display lines <= 6 words. One idea per scene.
- Plain, concrete words about what the product does. No buzzwords (revolutionary, seamless, leverage, unlock, supercharge, game-changer).
- Never invent numbers, users, customers or awards. No counter scene unless the brief has a real number.
- Never mention writing, editing, exporting or rendering videos, templates or scenes unless the product itself is a video tool. The film is about THEIR product.
- Show the product early (by the second or third scene) and keep story beats to at most two scenes; when the brief says "just show the app/product", it is mostly UI scenes with tiny captions.
- Write the copy in the language of the brief (Spanish brief, Spanish film; Arabic brief, Arabic film).
- A thin brief (a name and a few words) stays thin: write about what it says and how it feels, never invent features, integrations or prices to fill the film.
- Talk to one person ("you"), present tense, confident, short.

### Films that are not a product launch

- A story, cartoon or video for kids: tell a small tale in scenes (chat, sentence, typewriter, cards3d, tiles, countdown), bright and bouncy, short happy lines, a character named in the copy.
- An educational or explainer video, even a long one: one idea per scene, in order (title as the question, steps, timeline, checklist, code, chart only with real numbers, sentence, highlight), with a recap near the end. Long films have more scenes, each at its usual length.
- A manifesto or "typography only" request: type scenes only (slam, sentence, append, fullbleed, marquee, tiles, assemble).
- A requested length is a hard target: match it with the number of scenes.

### Changes the user asks for

Edit `film.json` and run the same one command again:

- **Another look**: change `style`. The words stay.
- **Other words, another order, a scene more or less**: edit `scenes`.
- **Length**: write `seconds` and add or remove scenes until `fit` passes;
  `pace` for the same film faster or calmer.
- **Frame**: `aspect`.
- **Language**: write every text in the user's language.
- **Music**: `music.track`, or `"none"` for the sounds of the picture alone;
  `music.kit` for other sounds on the picture.
- **Export**: `harness export`; `--quality draft` for a quick look,
  `--resolution 4k` for 4K.
