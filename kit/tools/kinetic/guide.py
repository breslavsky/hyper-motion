"""Writes the template's guide, AGENTS.md, from its parts: the hand-written steps and film.json's
shape below, the ready shapes (shapes.md), the looks (source/lib/compiler/looks.cjs) and the scene library Kinetic gives its own
writer (scene-library.txt, a line a scene), without the scenes a project here cannot use and with
the user's own pictures where it speaks of stock photos. Run it after changing any of them:

    python3 kit/tools/kinetic/guide.py

tests/test_pure_kinetic.py fails when AGENTS.md is not what this writes.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parents[1]
# Scenes of Kinetic's library that are not in the engine here (extract.py leaves their fields out).
LEFT_OUT = ("freestyle", "clip", "props3d")

def font_library() -> str:
    """The font library's families as the guide names them: each with what it is for."""
    families = json.loads((TEMPLATE / "source/lib/fonts/library.json").read_text())["families"]
    return ", ".join(f'`"{family["family"]}"` {" ".join(family["tags"][:2])}' + ("" if "cyrillic" in family["scripts"] else ", Latin only") for family in families)


HEAD = r'''## Template guide: Pure Kinetic (HyperFrames)

A short motion-graphics film (a launch film, an ad, an announcement, an
explainer) written as data. You write one small file, `source/film.json`: a
look, and scenes of a type with their words and a length in beats. The kit
draws everything, sets every time and colour and writes the soundtrack. You
never write HTML, CSS or animation. Everything you need is on this page;
do not search `source/lib/` to discover parameters.

### Keep the request intact

Before writing, identify the required words, actions, format, seconds,
font, colours and musical beats. Quoted copy stays exact. Choose scenes
for those actions; ready shapes are optional starting points. Never pad a
duration with repeated end cards, restated slogans or invented claims.

- Font: `brand.font`, exactly one of the bundled families listed under
  `brand.font` below; an uploaded font uses the object described there.
- Exact colours for the whole film: `brand.tokens` with `background`,
  `foreground`, `accent`, `accent2`, each a #hex. Example:
  `"tokens": {"background":"#101828","foreground":"#f7f7f2","accent":"#b9f24a"}`.
  Omit roles not requested. This keeps one background and exact accents.
  `brand.colors` plus `palette:"brand"` instead adapts a look's palette;
  it preserves the look's changing backgrounds and creates related tints.
- Exact duration: `seconds`, at `pace:"normal"`. Give every scene the beats
  it usually takes and stop there: `fit` shares the film's beats out among
  the scenes to make it that long, inside each scene's usual length, and
  says what it set. Never work beat counts out yourself and write no script
  that tries them. If `fit` says the scenes cannot be that long, add or take
  out a scene as it says. Do not add filler to meet the clock.
- Letter backs flipping into a line → `letterflip`; a circle changing
  into other shapes with echoes → `polar`; labels scanned into categories
  → `scan`; connected cards with travelling focus → `accordion`; a card
  separating into perspective layers → `explode`; a slider → `dial`.
  Use their fields in the library below. A `morph` changes UI controls,
  not geometric shapes.
- A final line held for two seconds needs its entrance time too: reserve
  at least 3.3 seconds for `endcard` at normal pace (6 beats at 108 BPM).
- A person typing a search query and submitting it → `glass-search`. Supply the
  actual query. After submission, the field folds into a round button.
  Its spinner turns into a checkmark when the search completes.
- A process of five to ten steps, or how far along somebody is in one →
  `glass-stepper`; two to four steps read at once → `glass-steps`.
- Somebody asking a question and getting an answer → `glass-ask`.
- Two such moments that belong together, one after the other with no cut
  (somebody searches, then asks) → one `glass-ride` whose `steps` are those
  scenes, instead of two scenes with a transition between them. A ride takes
  only the scenes its line below names; its `beats` are the steps' beats and
  two beats of travel between each two.
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
- `material`: the glass scenes are `"dark-glass"` unless you say otherwise:
  smoked, frosted glass whose text reads over any picture. Choose `"glass"`
  for clear thick glass with a round edge that bends the picture behind it
  like a lens (a full-size glass scene with a `background` image or video
  shows it best), or `"metal"` for opaque metal. The finish applies to the 3D surfaces
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
  `"Geist Mono"` or `"Instrument Serif"`, a family of the font library
  (@@FONT_LIBRARY@@), or the user's uploaded brand font:
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
  A track of the user's, or one a tool made, is `{ "file": "<its path>" }`
  and nothing else: the film takes that track's tempo, starts where its music
  comes in, and `fit` lays the scenes on it: it moves a scene's length by a
  beat or two so that scenes begin where the music comes in, where it stops
  and comes back, and on its key hits, and says which. Write the beats each
  scene needs and leave the rest to it; `"lay": false` keeps the lengths as
  written. The same one command lays the track under the picture. `harness
  assets` gives an upload's path; `"from": <seconds>` starts later in the
  track, `"bpm"` only when `fit` says the track has no steady tempo. A track
  the user asks you to have made is `generate_music`'s file, mapped once with
  `harness track-map <its path>` before `fit`. Never
  cut, measure or mix a track yourself, and write no sound script of your own.
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
  `{"type":"glass-ask","beats":6,"text":"Ready?","reply":"All set.","timing":{"open":0.5,"type":1,"typed":2.5,"send":3,"reply":4}}`.
  Specify just the actions that matter. Their order follows the component's
  choreography. Pinned actions keep their beats when `speed` changes.
  Between pins, the motion fits the interval. After the last pin, an
  explicit speed above or below 1 controls the remaining motion. The sound
  effects follow the actions. Use `fit` to check the recipe and rebuild the audio
  after an edit. The scene library lists the available actions for each type.
- `seconds`: when the user names a length, always write the number.
  `fit` makes the film that long by sharing its beats out among the scenes
  and says which lengths it set; it does not retime the music. Add a scene
  only when there is another meaningful action or fact.
- Pictures (`image`, `images`) are only the user's own: the page picture of
  `screenshot_page` (`derived/generated/screenshots/<name>.png`) and their
  uploads (`media/<assetId>/original.<ext>`), as paths from `source/`. With
  no picture, use scenes that need none and never write `stock:` or `shot`
  values.

### Looks

| `style` | What it looks like | Track, bpm |
| --- | --- | --- |
'''

LIBRARY = r'''

### Scene library

Pick from these only: a type or field that is not here is refused by `fit`.
After each name are its fields (`?` may be left out,
`[2-5]` is how many items a list takes), what it shows, and its usual length
in beats. Text longer than a scene fits is refused by `fit` with the limit.
The kit writes no words of its own: every word on screen is one you wrote,
in the film's language. So give the optional labels when a scene should have
them (`compare`: `beforeLabel`, `afterLabel`; `drag`: `label`, `button`;
`morph`: `label`, `text`); left out, the scene shows none.

'''

OWN = r'''

**Glass scenes.** A glass panel keeps its own ground in
every look: a deep blue backdrop with light text, whatever `style` the film
has. Give it the user's photo or video with `background`, or the brand's own
colours, to change that; never pick a look for the sake of a glass scene.
A glass scene over the user's footage is an overlay: give it `background`
with their video or photo (or, in a film that already plays the footage on a
track of its own, such as a talking head, `over` = true and
`background.clip` = the id of that footage's `<video>`: the scene then draws
only its glass, which bends the footage under it), and say where the panel stands with `place`
(top-left | top | top-right | left | middle | right | bottom-left | bottom |
bottom-right; middle unless said) and how large it is with `size` (normal |
small; small is six tenths, so keep its texts short).
Put the panel where the footage is quiet, not over a face. Over footage
keep the default `"dark-glass"`: it is frosted and its text reads, while
clear `"glass"` is all but transparent and a small panel of it is lost on a
busy picture. `place` and `size` are fields of `glass-island`,
`glass-controls`, `glass-ask`, `glass-search`, `glass-widgets`, `glass-steps`, `glass-checklist`, `glass-like`, `glass-rating`, `glass-message`, `glass-follow` and `glass-call`; the other glass scenes fill
the frame and take neither.
'''

TAIL = r'''

### Changes the user asks for

Edit `film.json` and run the same one command again:

- **Another look**: change `style`. The words stay.
- **Other words, another order, a scene more or less**: edit `scenes`.
- **Length**: write `seconds`; `fit` shares the beats out, and says so if a scene must be added or taken out;
  `pace` for the same film faster or calmer.
- **Frame**: `aspect`.
- **Language**: write every text in the user's language.
- **Music**: `music.track`, `music.file` for a track of their own, or `"none"` for the sounds of the picture alone;
  `music.kit` for other sounds on the picture.
- **Export**: `harness export`; `--quality draft` for a quick look,
  `--resolution 4k` for 4K.
'''


def _ours(line: str) -> str:
    """A line of Kinetic's library in the words of a project here: the user's own pictures."""
    line = re.sub(r' Use stock portraits \("stock:[^"]*"\) for the people the product serves\.', "", line)
    line = re.sub(r" ?\(stock:\.\.\., 2 per line\)", " (the user's photos, 2 per line)", line)
    line = re.sub(r'images = stock photos of the people the product serves \("stock:[^"]*"\)', "images = the user's photos", line)
    line = line.replace("images = stock photos or screenshots", "images = the user's photos or screenshots")
    line = line.replace("Pair with a stock photo of the people or place.", "Only with a photo the user gave.")
    line = re.sub(r" props\? = one 3D object per card from the props3d list[^.]*\.", "", line)
    line = line.replace("(cards3d, icon3d, phone3d, props3d, field)", "(cards3d, icon3d, phone3d, field)")
    line = line.replace("props3d with the mascot/astronaut/rocket, ", "")
    line = line.replace("the scenes a motion designer would remember (pullback, dot, knockout, hive, orb, between, drag, field, flip, assemble, scatter, arc)",
                        "the scenes the library lists first")
    # The header is the name and running dots: the kit writes no "working" of its own.
    line = line.replace('"<name> working..." with a spinner', "the product's name with a spinner and running dots")
    line = line.replace("only when the DIRECTION asks for it", "rarely: one scene that should stand apart")
    return line.replace("Use every screenshot you are given at least once.", "Use every picture the user uploaded at least once.")


def _section(lines: list[str], title: str) -> list[str]:
    start = next(i for i, line in enumerate(lines) if line.startswith(title))
    out = []
    for line in lines[start + 1:]:
        if not line.strip():
            break
        out.append(line)
    return out


def scenes(lines: list[str]) -> list[str]:
    """The library's scene lines the guide carries."""
    return [line for line in lines if line.startswith("- ") and "{" in line.split(":")[0] and not line.startswith(tuple(f"- {name} " for name in LEFT_OUT))]


SIGNATURE_HEAD = (
    "**Signature moments**, the scenes a viewer remembers: one or two a film, three at most, where the story turns or on "
    "the strongest hit of the music, with simple scenes around them. The kit's own come first.\n")
OPENER_HEAD = "\n**Openers**: a film begins with one of these, or with a signature moment that says it opens a film.\n"
REST_HEAD = "\n**Every other scene**: what carries the film from one moment to the next.\n"


def by_role(kinetic: list[str], own: list[str], openers: list[str], signature: list[str]) -> str:
    """The scene lines by the part a scene plays in a film, the strongest first. A flat list in the
    order scenes were written put the kit's newest and strongest a hundred and fifty lines down,
    and a writer took what stood first (HISTORY 395). The roles are the kit's own
    (`film.cjs` `OPENERS`, `SIGNATURE`: a scene of ours says them in its metadata), so a scene
    cannot be listed under a role it does not have."""
    name = lambda line: re.match(r"- ([\w-]+)", line).group(1)  # noqa: E731
    # Ours newest first, then Kinetic's in their own order.
    lines = [*reversed(own), *kinetic]
    groups: dict[str, list[str]] = {"signature": [], "opener": [], "rest": []}
    for line in lines:
        kind = "signature" if name(line) in signature else "opener" if name(line) in openers else "rest"
        if kind == "signature" and name(line) in openers:
            line += " Opens a film too."
        groups[kind].append(line)
    return (SIGNATURE_HEAD + "\n".join(groups["signature"]) + "\n" + OPENER_HEAD + "\n".join(groups["opener"]) + "\n"
            + REST_HEAD + "\n".join(groups["rest"]))


def guide() -> str:
    # The looks and the scenes of ours as the engine has them: Kinetic's looks and ours
    # (looks-own.cjs), and what each scene of ours says of itself (components/metadata.cjs).
    run = subprocess.run(
        ["node", "-e", "const e = process.argv[1], f = require(e + '/../film.cjs'); process.stdout.write(JSON.stringify({ looks: require(e + '/plan.cjs').looks, own: Object.values(require(e + '/definitions.cjs')).map((d) => d.guide), openers: [...f.OPENERS], signature: [...f.SIGNATURE] }))", str(TEMPLATE / "source" / "lib" / "compiler")],
        capture_output=True, text=True, check=True,
    )
    engine = json.loads(run.stdout)
    looks = engine["looks"]
    own = [f"- {line}" for line in engine["own"]]
    lines = (HERE / "scene-library.txt").read_text(encoding="utf-8").split("\n")
    shapes = (HERE / "shapes.md").read_text(encoding="utf-8")
    table = "\n".join(f"| `{look['id']}` | {look['hint']} | {look['track']}, {look['bpm']} |" for look in looks.values())
    common = [line for line in lines if line.startswith(("COMMON FIELDS", "Usually OMIT", "PALETTE names", "TRANSITIONS:", "3D HALFTONE"))]
    beyond = [line for line in _section(lines, "BRIEFS BEYOND") if not line.startswith('- A cinematic, realistic or "footage" request')]
    parts = [
        HEAD.replace("### Looks\n", shapes + "\n### Looks\n") + table + LIBRARY + by_role(scenes(lines), own, engine["openers"], engine["signature"]) + OWN + "\n\n" + "\n".join(common),
        "### Rhythm\n\n" + "\n".join(_section(lines, "RHYTHM RULES")),
        "### Words\n\n" + "\n".join(_section(lines, "COPY RULES")),
        "### Films that are not a product launch\n\n" + "\n".join(beyond).replace("Long films have more scenes and hold each one longer.", "Long films have more scenes, each at its usual length.") + TAIL,
    ]
    return "\n".join(_ours(line) for line in "\n\n".join(parts).split("\n")).replace("@@FONT_LIBRARY@@", font_library())


def usual() -> dict[str, list[int]]:
    """How long each scene usually is, in beats, as its line of the guide says ("4-5 beats"):
    what `film.cjs` holds a scene to, so a longer film gets more scenes and not longer ones."""
    out = {}
    for line in guide().split("\n"):
        named = re.match(r"- ([a-z0-9-]+) \{", line)
        said = re.findall(r"(\d+)(?:-(\d+))? beats", line)
        if named and said:
            low, high = said[-1]
            out[named[1]] = [int(low), int(high or low)]
    return out


if __name__ == "__main__":
    (TEMPLATE / "AGENTS.md").write_text(guide(), encoding="utf-8")
    (TEMPLATE / "source" / "lib" / "beats.json").write_text(json.dumps(usual(), indent=1) + "\n", encoding="utf-8")
    print(f"AGENTS.md: {len(guide())} characters")
