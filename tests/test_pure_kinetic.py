"""Pure Kinetic: the film is data, the plan compiler is held to Kinetic's own, and the
template's checks say what is wrong with a film in words its writer can act on."""

from __future__ import annotations

import importlib.util
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "kit"
SOURCE = TEMPLATE / "source"
COMPILER = SOURCE / "lib" / "compiler"
COMPONENTS = SOURCE / "lib" / "components"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


def _checks():
    spec = importlib.util.spec_from_file_location("pure_kinetic_checks", TEMPLATE / "tools" / "checks.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _project(tmp_path: Path, change=None) -> Path:
    """A copy of the template's source, its film changed by `change`."""
    source = tmp_path / "source"
    shutil.copytree(SOURCE, source)
    if change:
        film = json.loads((source / "film.json").read_text())
        change(film)
        (source / "film.json").write_text(json.dumps(film))
    return source


def test_the_starting_film_passes_its_checks():
    assert _checks().check(SOURCE) == []


def test_glass_background_checks_resolve_uploaded_images_and_videos(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    (source / "lib").symlink_to(SOURCE / "lib", target_is_directory=True)
    film = {"aspect": "9:16", "brand": {"name": "Glass"}, "style": "glass", "scenes": [
        {"type": "glass-ask", "beats": 5, "text": "Book a class", "background": {"image": "assets/Экран%20%231.png"}},
        {"type": "glass-island", "beats": 4, "title": "Booked", "background": {"video": "media/clip/original.mp4"}},
    ]}
    (source / "film.json").write_text(json.dumps(film))
    checker = _checks()
    def missing():
        return [d["message"] for d in checker.check(source) if ".background." in d["message"]]

    assert missing() == ["scenes[0].background.image: assets/Экран%20%231.png does not exist",
                         "scenes[1].background.video: media/clip/original.mp4 does not exist"]
    for name in ["assets/Экран #1.png", "media/clip/original.mp4"]:
        asset = source / name
        asset.parent.mkdir(parents=True)
        asset.touch()
    assert missing() == []


def test_every_template_of_kinetic_is_a_valid_film():
    script = (
        "const {problems}=require(process.argv[1]);const T=require(process.argv[2]);"
        "const bad=T.map(t=>[t.id,problems({aspect:t.aspect,style:t.style,brand:{name:'Nook'},music:{bpm:t.bpm,track:t.track},scenes:t.scenes})]).filter(x=>x[1].length);"
        "process.stdout.write(JSON.stringify(bad))"
    )
    run = subprocess.run(
        ["node", "-e", script, str(SOURCE / "lib" / "film.cjs"), str(TEMPLATE / "tools" / "kinetic" / "templates.json")],
        capture_output=True, text=True, timeout=60,
    )
    assert json.loads(run.stdout) == []


def test_a_wrong_scene_is_named_with_its_place(tmp_path):
    def change(film):
        film["scenes"][0] = {"type": "slam", "beats": 4, "lines": []}
        film["scenes"][1] = {"type": "nope", "beats": 2}
        film["scenes"][2]["text"] = "x" * 200

    messages = [d["message"] for d in _checks().check(_project(tmp_path, change)) if d["severity"] == "error"]
    assert any("scenes[0] (slam).lines needs at least 1" in m for m in messages)
    assert any('no scene type "nope"' in m for m in messages)
    assert any("scenes[2] (scatter).text is 200 characters, at most 80 fit" in m for m in messages)


def test_a_film_of_another_length_asks_for_fit_and_fit_sets_the_page(tmp_path):
    source = _project(tmp_path, lambda film: film["scenes"].pop(3))
    found = _checks().check(source)
    assert any(d["file"] == "index.html" and "data-duration" in d["message"] for d in found)
    assert any(d["code"] == "qa_sound_stale" for d in found)
    subprocess.run(["node", str(source / "lib" / "film.cjs"), "fit"], check=True, capture_output=True, timeout=30)
    assert not [d for d in _checks().check(source) if d["severity"] == "error"]


def test_the_frame_follows_the_aspect(tmp_path):
    source = _project(tmp_path, lambda film: film.update(aspect="16:9"))
    assert any("1920x1080" in d["message"] for d in _checks().check(source))
    subprocess.run(["node", str(source / "lib" / "film.cjs"), "fit"], check=True, capture_output=True, timeout=30)
    html = (source / "index.html").read_text()
    assert 'data-width="1920" data-height="1080"' in html and 'data-resolution="landscape"' in html


def test_a_weak_script_is_a_note_not_an_error(tmp_path):
    def change(film):
        film["scenes"] = [{"type": "logo3d", "beats": 3}, {"type": "title", "beats": 3, "text": "Seamless work"}]

    found = _checks().check(_project(tmp_path, change))
    notes = [d["message"] for d in found if d["code"] == "qa_script"]
    assert any("weak opener" in n for n in notes) and any("endcard" in n for n in notes) and any("buzzword" in n for n in notes)
    assert all(d["severity"] == "info" for d in found if d["code"] == "qa_script")


def test_a_picture_that_is_not_there_is_an_error(tmp_path):
    def change(film):
        film["scenes"][1] = {"type": "laptop", "beats": 4, "image": "stock:a laptop"}

    assert any("stock:a laptop does not exist" in d["message"] for d in _checks().check(_project(tmp_path, change)))


def _node(script: str, *args: str) -> str:
    run = subprocess.run(["node", "-e", script, *args], capture_output=True, text=True, timeout=60)
    assert run.returncode == 0, run.stderr[-600:]
    return run.stdout


def test_the_guide_is_what_its_builder_writes():
    spec = importlib.util.spec_from_file_location("pure_kinetic_guide", TEMPLATE / "tools" / "kinetic" / "guide.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert (TEMPLATE / "AGENTS.md").read_text(encoding="utf-8") == module.guide(), "run tools/kinetic/guide.py"


def test_the_guide_lists_every_scene_a_film_may_use_and_no_other():
    import re

    guide = (TEMPLATE / "AGENTS.md").read_text(encoding="utf-8")
    listed = set(re.findall(r"^- ([a-z0-9-]+) \{", guide, flags=re.M))
    engine = str(COMPILER)
    fields = set(json.loads(_node("process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1] + '/fields.cjs'))))", engine)))
    own = set(json.loads(_node("process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1] + '/definitions.cjs'))))", engine)))
    assert own and not own & fields
    assert listed == fields | own


def test_what_the_engine_here_has_not_got_is_no_scene(tmp_path):
    # The model's own HTML, a screen recording and the 3D models (never on Kinetic's site: a
    # scene that asked for one left the whole film blank) are cut out of the engine, not refused.
    for kind in ("freestyle", "clip", "props3d"):
        def change(film, kind=kind):
            film["scenes"][1] = {"type": kind, "beats": 4}

        assert any(f'there is no scene type "{kind}"' in d["message"] for d in _checks().check(_project(tmp_path / kind, change)) if d["severity"] == "error")


def test_a_field_a_scene_does_not_have_is_named(tmp_path):
    def change(film):
        film["scenes"][0]["line"] = "A misspelt field"

    errors = [d["message"] for d in _checks().check(_project(tmp_path, change)) if d["severity"] == "error"]
    assert any('scenes[0] (slam) has no field "line"' in n and "lines, crumbs" in n for n in errors)


def test_every_face_for_other_scripts_is_there():
    import re

    css = (SOURCE / "lib" / "fonts.css").read_text(encoding="utf-8")
    files = re.findall(r'url\("([^"]+)"\)', css)
    assert files and all((SOURCE / "lib" / f).is_file() for f in files)


def test_every_ready_shape_of_the_guide_is_a_film_with_nothing_to_note():
    # The agent copies a shape and changes its words: a shape that drew a note sent it looking.
    import re

    guide = (TEMPLATE / "AGENTS.md").read_text(encoding="utf-8")
    shapes = [json.loads(b) for b in re.findall(r"```json\n(\{ \"aspect\".*?)\n```", guide, flags=re.S)]
    assert len(shapes) == 7
    for film in shapes:
        for scene in film["scenes"]:
            scene.pop("image", None)  # a path the agent fills in
        run = subprocess.run(["node", str(SOURCE / "lib" / "film.cjs"), "check", "-"], input=json.dumps(film), capture_output=True, text=True, timeout=30)
        result = json.loads(run.stdout)
        assert result["errors"] == [] and result["notes"] == [], (film["style"], result)


def test_the_soundtrack_is_held_to_the_film_by_its_mark_not_by_file_times(tmp_path):
    # A checkout sets file times anew: on CI the starting film was "newer" than its own
    # soundtrack, and so it would be in a project just made from the template (HISTORY 312).
    import os

    source = _project(tmp_path)
    music, film = source / "assets" / "music.m4a", source / "film.json"
    os.utime(music, (1_000_000_000, 1_000_000_000))
    os.utime(film, (2_000_000_000, 2_000_000_000))
    assert _checks().check(source) == []
    # A soundtrack with no mark beside it, or with another film's, is not this film's.
    (source / "assets" / "music.json").unlink()
    assert [d["code"] for d in _checks().check(source)] == ["qa_sound_stale"]


def test_every_scene_of_ours_says_everything_about_itself():
    # One definition is the whole scene: its fields, its line in the guide, a sample that is a
    # valid film, and sounds whose cues fall inside it (lib/engine/own.js).
    script = """
    const [engine, helper] = process.argv.slice(1);
    const own = require(engine + '/definitions.cjs');
    const { problems, planOf } = require(helper);
    const out = {};
    for (const [type, def] of Object.entries(own)) {
      const film = { aspect: '9:16', style: 'liquid', brand: { name: 'Nook' }, scenes: [def.sample] };
      const found = problems(film);
      const plan = found.length ? null : planOf(film);
      out[type] = { keys: Object.keys(def), guide: def.guide, sample: def.sample.type, found,
        cues: plan ? plan.cues.map((c) => [c.t, c.kind]) : [], length: plan ? plan.duration : 0 };
    }
    process.stdout.write(JSON.stringify(out));
    """
    scenes = json.loads(_node(script, str(COMPILER), str(SOURCE / "lib" / "film.cjs")))
    kinds = set(json.loads((SOURCE / "lib" / "sounds.json").read_text(encoding="utf-8"))["kits"]["soft"]) - {"about", "logo"}
    assert len(scenes) >= 12
    for name, scene in scenes.items():
        assert scene["sample"] == name and scene["found"] == [], (name, scene["found"])
        assert len(scene["cues"]) > 1, f"{name} makes no sound of its own"
        assert all(0 <= t <= scene["length"] and kind in kinds for t, kind in scene["cues"]), name


def test_a_film_names_its_kit_and_the_soundtrack_is_held_to_it(tmp_path):
    def mark(change):
        return _checks().inspect(SOURCE, change(json.loads((SOURCE / "film.json").read_text(encoding="utf-8"))))

    same = mark(lambda film: film)
    other = mark(lambda film: {**film, "music": {**film.get("music", {}), "kit": "cinema"}})
    assert same["errors"] == [] and other["errors"] == [] and same["sound"] != other["sound"]
    wrong = mark(lambda film: {**film, "music": {"kit": "loud"}})
    assert any('"music.kit" must be one of' in e for e in wrong["errors"])


def test_the_brand_palette_repaints_a_look_and_keeps_its_contrast():
    script = """
    const { compile } = require(process.argv[1]);
    const film = (more) => ({ aspect: '16:9', style: 'editorial', brand: { name: 'Nook', colors: ['#0a7cff', '#ff7a00'] },
      scenes: [{ type: 'title', beats: 3, text: 'Meet *Nook*.' }], ...more });
    process.stdout.write(JSON.stringify([compile(film({})).palette, compile(film({ palette: 'brand' })).palette]));
    """
    look, brand = json.loads(_node(script, str(COMPILER / "plan.cjs")))
    assert (brand["paper"], brand["ink"]) == (look["paper"], look["ink"])
    assert {"#0a7cff", "#ff7a00"} <= set(brand.values()) - {brand["brand"], brand["brand2"]} | {v for k, v in brand.items() if k not in ("brand", "brand2")}
    assert all(brand[name] != look[name] for name in ("lime", "peach", "lilac", "butter"))

    def light(colour):
        r, g, b = (int(colour[i:i + 2], 16) for i in (1, 3, 5))
        return (max(r, g, b) + min(r, g, b)) / 510

    assert all(abs(light(brand[name]) - light(look[name])) < 0.02 for name in ("lime", "peach", "lilac", "butter", "sage"))
    wrong = _checks().inspect(SOURCE, {"aspect": "16:9", "style": "editorial", "palette": "brand", "brand": {"name": "Nook"}, "scenes": [{"type": "title", "beats": 3, "text": "Hi"}]})
    assert any('needs "brand.colors"' in e for e in wrong["errors"])


def test_a_films_emoji_are_drawn_by_the_kits_own_set(tmp_path):
    # Not by the worker's emoji font: Apple's on a Mac and Noto's on Linux made two films of one.
    import gzip

    packed = json.loads(gzip.decompress((SOURCE / "lib" / "emoji.json.gz").read_bytes()))
    assert len(packed["emoji"]) > 3000 and all(key in packed["emoji"] for key in "✅🔥📅")

    def change(film):
        film["scenes"][1] = {"type": "glass-island", "beats": 4, "title": "Class is full", "icon": "✅"}

    source = _project(tmp_path, change)
    stale = [d for d in _checks().check(source) if d["file"] == "assets/emoji.json"]
    assert stale and stale[0]["severity"] == "error" and "fit" in stale[0]["hint"]
    subprocess.run(["node", "lib/film.cjs", "fit"], cwd=source, check=True, capture_output=True)
    drawn = json.loads((source / "assets" / "emoji.json").read_text(encoding="utf-8"))
    assert list(drawn["emoji"]) == ["✅"] and drawn["emoji"]["✅"].startswith("<")
    assert not [d for d in _checks().check(source) if d["file"] == "assets/emoji.json"]


def test_the_checks_ask_nothing_of_an_older_kit_that_it_cannot_do(tmp_path):
    # A project keeps the kit it was made with, and the worker's checks are the newest: an
    # error the old kit's `fit` cannot clear sent an agent copying the worker's kit into the
    # project (HISTORY 319).
    source = _project(tmp_path)
    (source / "lib" / "emoji.json.gz").unlink()
    (source / "assets" / "emoji.json").unlink()
    assert not [d for d in _checks().check(source) if d["severity"] == "error"]


def _chrome() -> bool:
    cache = Path.home() / ".cache" / "puppeteer" / "chrome-headless-shell"
    return cache.is_dir() or Path("/Applications/Google Chrome.app").exists() or shutil.which("google-chrome") is not None


# The picture audits draw in Chrome with the template's own packages. They are
# run by hand (kit/tools/test.sh), every time: nothing
# guesses whether they are due. `test.sh quick` leaves them out by PURE_KINETIC_QUICK=1.
AUDIT = pytest.mark.skipif(
    os.environ.get("PURE_KINETIC_QUICK") == "1" or not (TEMPLATE / "node_modules" / ".pnpm").is_dir() or not _chrome(),
    reason="draws in Chrome: needs the template's packages (pnpm install in kit) and Chrome, and is left out of `test.sh quick`",
)


@AUDIT
def test_the_scenes_of_ours_pass_the_picture_audit(tmp_path):
    # Drawn and measured, not compared with anything: every text whole inside the safe area,
    # large enough, over no other text, and the film's own words (tools/audit.mjs). The scenes
    # taken from Kinetic are held to their known faults by `node tools/audit.mjs --known`.
    own = json.loads(_node("process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]))))", str(COMPILER / "definitions.cjs")))
    out = artifact_directory(tmp_path, "picture-owned")
    run = native_audit_run(
        ["node", str(TEMPLATE / "tools" / "audit.mjs"), "--scenes", ",".join(own), "--looks", "liquid,sting", "--aspects", "9:16,16:9,1:1", "--twice", "--json", str(out / "report.json")],
        out, timeout=600,
    )
    assert run.returncode == 0, run.stdout[-1500:] + run.stderr[-500:]
    known = json.loads((TEMPLATE / "tools" / "audit.known.json").read_text(encoding="utf-8"))["scenes"]
    assert not set(known) & set(own), "a scene of ours has no known fault: fix it"


@AUDIT
def test_every_scene_passes_the_picture_audit_in_one_look(tmp_path):
    # Every scene in the three frames, in one look (five looks take a quarter of an hour:
    # `node tools/audit.mjs --looks editorial,sting,liquid,frost,noir --known` by hand).
    out = artifact_directory(tmp_path, "picture-editorial")
    run = native_audit_run(
        ["node", str(TEMPLATE / "tools" / "audit.mjs"), "--looks", "editorial", "--aspects", "9:16,16:9,1:1", "--known", "--json", str(out / "report.json")],
        out, timeout=1200,
    )
    assert run.returncode == 0, run.stdout[-1500:] + run.stderr[-500:]


def test_the_engine_lays_scenes_out_in_the_safe_area_of_the_plan():
    plan = json.loads(_node("const p = require(process.argv[1]); process.stdout.write(JSON.stringify({ safe: p.safe, tall: p.compile({ aspect: '9:16', style: 'sting', brand: { name: 'N' }, scenes: [{ type: 'title', beats: 3, text: 'Hi' }] }).safe }))", str(COMPILER / "plan.cjs")))
    assert plan["tall"] == plan["safe"]["9:16"] and plan["safe"]["9:16"]["bottom"] > plan["safe"]["9:16"]["top"] >= 0.05
    assert all(0.03 <= share <= 0.2 for frame in plan["safe"].values() for share in frame.values())


def test_a_drawn_interface_has_the_films_words_or_bars_and_none_of_its_own():
    # Kinetic's drew a menu, people and figures it made up ("Home", "Maya Chen", "2,481") on a
    # film about somebody's real product. Now `app` of the film gives the words, and what it
    # leaves out is a grey bar.
    film = {"aspect": "16:9", "style": "daylight", "brand": {"name": "Nook"}, "scenes": [{"type": "browser", "beats": 4, "url": "nook.app"}, {"type": "endcard", "beats": 4, "cta": "nook.app"}]}
    app = {"nav": ["Classes", "Waitlist"], "title": "This week", "stats": [["Booked", "92%"]], "rows": [["Yoga, Tue 18:30", "12 of 12 booked"]], "status": ["Full"], "cta": "New class"}
    assert _checks().inspect(SOURCE, {**film, "app": app})["errors"] == []
    wrong = _checks().inspect(SOURCE, {**film, "app": {"menu": ["Classes"], "stats": [["Booked"]]}})["errors"]
    assert any('"app" has no "menu"' in e for e in wrong) and any("stats" in e for e in wrong)


def test_no_scene_falls_back_to_words_of_the_kit():
    # A field a film may leave out has no English standing in for it: the film's name, a sign
    # (an arrow) or nothing.
    fields = json.loads(_node("process.stdout.write(JSON.stringify(require(process.argv[1])))", str(COMPILER / "fields.cjs")))
    found, covered = [], set()
    for file in ["builtin.mjs", *(f"scenes/{f.name}" for f in sorted((COMPONENTS / "scenes").glob("*.mjs")))]:
        scene = None
        for n, line in enumerate((COMPONENTS / file).read_text(encoding="utf-8").splitlines(), 1):
            named = re.search(r'(?:SCENES|sceneFactories)(?:\.(\w+)|\["([\w-]+)"\])\s*=\s*\(', line)
            if named:
                scene = named[1] or named[2]
                covered.add(scene)
            for field, _, words in re.findall(r's\.(\w+)(\?\.length \? s\.\w+ : \[|\s*(?:\|\||\?\?)\s*)(\[?"[^"]*[A-Za-z]{3}[^"]*")', line):
                spec = fields.get(scene, {}).get(field)
                if scene in fields and (spec is None or spec.get("optional")) and (scene, field) != ("toggle", "kind"):
                    found.append(f"{file}:{n} {scene}.{field} falls back to {words}")
    assert not found, found
    assert set(fields) <= covered, "the fallback-word scan must cover every imported scene factory"


def test_every_scene_written_from_a_technique_says_where_it_came_from():
    # tools/technique.py is the way from a technique of the community library to a scene; what it
    # accepts it records: the technique, its name and the page of the video it was taken out of.
    own = json.loads(_node(
        "const o=require(process.argv[1]);process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(o).map(([k,d])=>[k,d.from??null]))))",
        str(COMPILER / "definitions.cjs"),
    ))
    record = json.loads((TEMPLATE / "tools" / "techniques.json").read_text(encoding="utf-8"))["scenes"]
    made = {name: technique for name, technique in own.items() if technique}
    assert {name: row["technique"] for name, row in record.items()} == made
    assert all(row["name"] and row["recipe"].startswith("https://") for row in record.values())
    assert len(set(made.values())) == len(made), "two scenes written from one technique"


def test_a_loud_look_throws_sparks_on_a_hit_and_a_calm_one_does_not():
    # Dots fly out from behind a word where the plan has a hit. Which looks do it follows their
    # sound kit (punch, play, tech), the film's own "sparks" says otherwise, and the compare with
    # Kinetic's frames turns them off.
    out = json.loads(_node(
        """
        const P = require(process.argv[1]), S = require(process.argv[2]), F = require(process.argv[3]);
        const film = (style, more) => ({ aspect: "9:16", style, brand: { name: "Nook" }, scenes: [{ type: "title", text: "Nook", beats: 3 }], ...more });
        const by = {};
        for (const [look, kit] of Object.entries(S.looks)) by[look] = [kit, P.compile(film(look)).sparks];
        process.stdout.write(JSON.stringify({ by, off: P.compile(film("poster", { sparks: false })).sparks, on: P.compile(film("keynote", { sparks: true })).sparks,
          wrong: F.problems(film("poster", { sparks: "yes" })), fine: F.problems(film("poster", { sparks: true })) }));
        """,
        str(COMPILER / "plan.cjs"), str(SOURCE / "lib" / "sounds.json"), str(SOURCE / "lib" / "film.cjs"),
    ))
    assert len(out["by"]) >= 44 and out["by"]["metal"] == ["soft", False]
    assert all(sparks == (kit in {"punch", "play", "tech"}) for kit, sparks in out["by"].values()), out["by"]
    assert out["off"] is False and out["on"] is True
    assert any('"sparks" must be true or false' in e for e in out["wrong"]) and out["fine"] == []


def test_sounds_that_fall_together_are_one_sound():
    # The owner heard "a bit too many" sounds: a cut played a whoosh, a tick and a hit at once.
    # The soundtrack script plays the one that matters most of those closer than its gap; the keys
    # of a typed line may follow faster and give way to anything; a riser is never in the way.
    code = (SOURCE / "music.py").read_text(encoding="utf-8")
    scope: dict = {}
    exec(code[code.index("RANK = {"):code.index("for i, cue in enumerate(thinned")], scope)
    thinned = scope["thinned"]
    cue = lambda t, kind, strength=1: {"t": t, "kind": kind, "strength": strength}  # noqa: E731
    kept = thinned([cue(1.0, "whoosh"), cue(1.02, "tick"), cue(1.1, "hit"), cue(0.4, "riser"), cue(2.0, "tick"), cue(2.5, "pop")])
    assert [(c["t"], c["kind"]) for c in kept] == [(0.4, "riser"), (1.1, "hit"), (2.0, "tick"), (2.5, "pop")]
    keys = thinned([cue(3 + i * 0.05, "type") for i in range(10)] + [cue(3.2, "click")])
    assert [c["kind"] for c in keys].count("click") == 1 and 2 <= [c["kind"] for c in keys].count("type") <= 4
    assert all(abs(a["t"] - b["t"]) >= 0.11 - 1e-9 for a in keys for b in keys if a is not b)


def test_a_brand_named_without_an_address_gets_its_own_site_only():
    # "A film for Adidas" with no address and no files: the agent takes the brand's site by its
    # name once, and `film.cjs brand` says by code whether the page is that brand's: its address
    # carries the name, the page says it, and it is a page (not a bot check or a domain for sale).
    cards = {
        "own": {"url": "https://www.adidas.com/us", "name": "adidas", "title": "adidas Official Website", "headlines": ["Cookies and privacy: we use cookies", "New arrivals"],
                "colors": {"accent": "#000000", "buttons": [{"fill": "#0a66c2"}], "surfaces": ["#ffffff", "#eceff1"]}, "files": {"screenshot": "derived/generated/screenshots/adidas.png"}},
        "other": {"url": "https://amazon.de/dp/1", "title": "Adidas shoes | Amazon", "headlines": ["Adidas"], "colors": {"accent": "#205192"}},
        "silent": {"url": "https://adidas.shop", "title": "Sneaker outlet", "headlines": ["Big sale"], "colors": {}},
        "wall": {"url": "https://adidas.com", "title": "Just a moment...", "headlines": ["Verify you are human", "adidas"], "colors": {}},
    }
    out = json.loads(_node(
        "const F=require(process.argv[1]);const C=JSON.parse(process.argv[2]);"
        "process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(C).map(([k,c])=>[k,F.brandOf(c,'Adidas')]))))",
        str(SOURCE / "lib" / "film.cjs"), json.dumps(cards),
    ))
    assert out["own"]["ok"] and out["own"]["use"] == {"brand": {"name": "Adidas", "url": "adidas.com", "colors": ["#000000", "#0a66c2"]}, "palette": "brand"}
    assert out["own"]["picture"] == "../derived/generated/screenshots/adidas.png" and out["own"]["words"] == ["New arrivals"]
    assert not out["other"]["ok"] and "amazon.de is not Adidas" in out["other"]["why"]
    assert not out["silent"]["ok"] and "does not say" in out["silent"]["why"]
    assert not out["wall"]["ok"] and "bot check" in out["wall"]["why"]


def test_a_length_asked_for_is_held_by_musical_beats_without_filler():
    # "A 30 second film": a real project's agent found the length by trial, three publishes, and
    # got there by holding eight scenes twice as long as they are made for. `"seconds"` names the
    # length; the check refuses a scene held far past its usual length (lib/beats.json, written
    # from the guide) and gives a beat budget, without requiring filler scenes.
    scene = lambda kind, beats, **more: {"type": kind, "beats": beats, **more}  # noqa: E731
    short = [scene("typewriter", 5, text="Why drink more water?"), scene("steps", 6, steps=["Carries oxygen", "Cools you down"]), scene("endcard", 5, cta="One glass now")]
    films = {
        "held": {"scenes": [scene("typewriter", 5, text="Why?"), scene("steps", 11, steps=["A", "B"]), scene("endcard", 5, cta="Now")]},
        "short": {"seconds": 30, "scenes": short},
        "fits": {"seconds": 8, "scenes": short},
        "long": {"seconds": 5, "scenes": short},
        "wrong": {"seconds": "30", "scenes": short},
    }
    out = json.loads(_node(
        "const F=require(process.argv[1]);const C=JSON.parse(process.argv[2]);"
        "process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(C).map(([k,f])=>[k,F.problems({aspect:'9:16',style:'explainer',brand:{name:'Water'},...f})]))))",
        str(SOURCE / "lib" / "film.cjs"), json.dumps(films),
    ))
    assert len(out["held"]) == 1 and "11 beats is too long" in out["held"][0] and "5-7" in out["held"][0] and "at most 9" in out["held"][0]
    assert len(out["short"]) == 1 and '"seconds" asks for 30' in out["short"][0] and "add about 44 actual beats" in out["short"][0] and "never repeat the ending" in out["short"][0]
    assert out["fits"] == []
    assert len(out["long"]) == 1 and "remove about 7 actual beats" in out["long"][0]
    assert any('"seconds" must be a number' in e for e in out["wrong"])


def test_a_panels_change_sets_only_what_a_panel_offers():
    # `film.cjs change` is run by the worker for a panel, with no agent (template.json "changes"):
    # the change comes from a client, so every key and value is one of the kit's own or refused.
    film = {"aspect": "9:16", "style": "explainer", "seconds": 8, "brand": {"name": "Water"}, "music": {"track": "air"},
            "scenes": [{"type": "typewriter", "beats": 5, "text": "Why drink more water?"}, {"type": "steps", "beats": 6, "steps": ["Carries oxygen", "Cools you down"]}, {"type": "endcard", "beats": 5, "cta": "One glass now"}]}
    changes = {
        "look": {"style": "neon"}, "all": {"style": "collage", "sparks": True, "kit": "play", "aspect": "1:1"}, "pace": {"pace": "chill"},
        "brand": {"palette": "brand", "colors": ["#FF6A3D"]}, "nobrand": {"palette": "brand"},
        "nolook": {"style": "nope"}, "scenes": {"scenes": []}, "words": {"brand": {"name": "x"}}, "empty": {}, "list": [1], "kit": {"kit": "loud"}, "colors": {"colors": ["red"]},
    }
    out = json.loads(_node(
        "const F=require(process.argv[1]);const film=JSON.parse(process.argv[2]);const C=JSON.parse(process.argv[3]);"
        "process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(C).map(([k,c])=>[k,F.changed(film,c)]))))",
        str(SOURCE / "lib" / "film.cjs"), json.dumps(film), json.dumps(changes),
    ))
    assert out["look"]["film"]["style"] == "neon" and out["look"]["said"] == "look Neon"
    # The words, the scenes and their order stay; a film with a length asked for keeps its tempo, so it stays that long.
    assert out["look"]["film"]["scenes"] == film["scenes"] and isinstance(out["look"]["film"]["music"]["bpm"], (int, float))
    made = out["all"]["film"]
    assert (made["style"], made["sparks"], made["music"]["kit"], made["aspect"]) == ("collage", True, "play", "1:1")
    # Another pace is another length: with a length asked for it is the agent's work (scenes to
    # add or take out), and the panel sends it there when this refuses.
    assert '"seconds" asks for 8' in out["pace"]["error"]
    assert out["brand"]["film"]["palette"] == "brand" and out["brand"]["film"]["brand"]["colors"] == ["#ff6a3d"]
    assert "brand.colors" in out["nobrand"]["error"]
    assert out["nolook"]["error"] == 'there is no look "nope"'
    assert out["scenes"]["error"] == 'a panel cannot change "scenes"' and out["words"]["error"] == 'a panel cannot change "brand"'
    assert "must name what to set" in out["empty"]["error"] and "must name what to set" in out["list"]["error"]
    assert "no sound kit" in out["kit"]["error"] and "#hex" in out["colors"]["error"]


def test_a_text_beyond_latin_is_held_to_the_measured_limit():
    # The limits of fields.js were taken by eye for lines in Latin letters. `audit.mjs --limits`
    # finds, for every text field, the longest text that leaves nothing cut, outside the safe
    # area, too small or over another text, with Russian words (lib/limits.json). A text with
    # letters beyond Latin is held to it; a Latin one keeps the written limit, which Kinetic's
    # own films fit.
    limits = json.loads((SOURCE / "lib" / "limits.json").read_text(encoding="utf-8"))["limits"]
    # `steps` is not among them since its list steps down the scale of type instead (HISTORY 335).
    assert limits["agent"]["steps[]"] < 40 and "steps" not in limits and 5 <= len(limits) <= 20
    assert "bubbles" not in limits  # its questions drift off the frame on purpose
    film = lambda steps: {"aspect": "9:16", "style": "grape", "brand": {"name": "Water"}, "scenes": [  # noqa: E731
        {"type": "agent", "beats": 6, "steps": steps, "done": "Done"}, {"type": "endcard", "beats": 5, "cta": "Now"}]}
    most = limits["agent"]["steps[]"]
    out = json.loads(_node(
        "const F=require(process.argv[1]);const C=JSON.parse(process.argv[2]);process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(C).map(([k,f])=>[k,F.problems(f)]))))",
        str(SOURCE / "lib" / "film.cjs"),
        json.dumps({"long": film(["Ясная голова", "Я" * (most + 1)]), "fits": film(["Ясная голова", "Я" * most]), "latin": film(["Clear head", "x" * 40]), "latin_long": film(["Clear head", "x" * 41])}),
    ))
    assert len(out["long"]) == 1 and f"at most {most} fit" in out["long"][0] and "steps[1]" in out["long"][0]
    assert out["fits"] == [] and out["latin"] == []
    assert len(out["latin_long"]) == 1 and "at most 40 fit" in out["latin_long"][0]
    # Every limit names a text field that exists.
    specs = json.loads(_node(
        "const o=require(process.argv[2]);process.stdout.write(JSON.stringify({...require(process.argv[1]),...Object.fromEntries(Object.entries(o).map(([k,d])=>[k,d.fields]))}))",
        str(COMPILER / "fields.cjs"), str(COMPILER / "definitions.cjs"),
    ))
    for scene, fields in limits.items():
        for at, n in fields.items():
            spec = specs[scene]
            for step in re.findall(r"[^.\[\]]+|\[\]", at):
                spec = spec["of"] if step == "[]" else (spec.get("fields") or spec)[step]
            assert spec["kind"] == "string" and 1 <= n < spec["max"], (scene, at)


def test_compiler_preserves_format_readability_floors_for_the_design_system():
    # The compiler's public scale remains compatible with existing plans and
    # supplies the portrait label floor. Rendered roles use the Radix contract;
    # its instance isolation, fitting and native metrics have dedicated tests.
    out = json.loads(_node(
        "const P=require(process.argv[1]);const f=(aspect)=>P.compile({aspect,style:'editorial',brand:{name:'Nook'},scenes:[{type:'title',text:'Nook',beats:3}]}).type;"
        "process.stdout.write(JSON.stringify({steps:P.type,tall:f('9:16'),wide:f('16:9'),square:f('1:1')}))",
        str(COMPILER / "plan.cjs"),
    ))
    assert out["wide"] == out["square"] == {k: float(v) for k, v in out["steps"].items()}
    assert out["tall"] == {k: round(v * 1.1, 1) for k, v in out["steps"].items()}


def test_native_clips_keep_transition_overlap_and_the_final_tail():
    out = json.loads(_node("""
      const {nativeClips}=require(process.argv[1]);
      const plan={duration:9,scenes:[
        {start:0,dur:3,trDur:0,scene:{type:'title'}},
        {start:3,dur:2,trDur:.6,scene:{type:'title'}},
        {start:5,dur:3,trDur:1,scene:{type:'endcard'}}]};
      process.stdout.write(JSON.stringify(nativeClips(plan)));
    """, str(SOURCE / "lib" / "build.cjs")))
    assert out == [
        {"id": "s1", "type": "title", "start": 0, "duration": 3.3},
        {"id": "s2", "type": "title", "start": 2.7, "duration": 2.8},
        {"id": "s3", "type": "endcard", "start": 4.5, "duration": 4.5},
    ]


def test_a_text_change_requires_rebuilding_even_when_duration_is_unchanged(tmp_path):
    source = _project(tmp_path)
    film = json.loads((source / "film.json").read_text())
    before = _checks().inspect(source, film)["duration"]
    film["brand"]["name"] = "Another name"
    (source / "film.json").write_text(json.dumps(film))
    assert _checks().inspect(source, film)["duration"] == before
    assert any(d["code"] == "qa_build_stale" for d in _checks().check(source))
    subprocess.run(["node", str(source / "lib" / "film.cjs"), "fit"], check=True, capture_output=True, timeout=30)
    assert not [d for d in _checks().check(source) if d["severity"] == "error"]


def test_build_mark_covers_compiled_tokens_and_events_even_when_film_is_unchanged():
    out = json.loads(_node("""
      const {compile}=require(process.argv[1]),{buildMark}=require(process.argv[2]);
      const film={aspect:'9:16',style:'editorial',brand:{name:'Nook'},scenes:[{type:'title',text:'Hello',beats:3}]};
      const plan=compile(film),tokens=structuredClone(plan),events=structuredClone(plan);
      tokens.scenes[0].fg='#123456';events.cues[0].t+=.005;
      process.stdout.write(JSON.stringify([buildMark(film),buildMark(film,plan),buildMark(film,tokens),buildMark(film,events)]));
    """, str(COMPILER / "plan.cjs"), str(SOURCE / "lib" / "build.cjs")))
    assert out[0] == out[1]
    assert len(set(out[1:])) == 3


@pytest.mark.parametrize("value", ["0", "NaN", "Infinity", "-1"])
def test_native_clip_timing_cannot_be_stale_or_non_finite(tmp_path, value):
    source = _project(tmp_path)
    page = source / "index.html"
    html = page.read_text()
    html, replacements = re.subn(r'(id="s1"[^>]*data-duration=")[^"]+', lambda m: m[1] + value, html, count=1)
    assert replacements == 1
    page.write_text(html)
    assert any("s1 has stale native timing" in d["message"] for d in _checks().check(source))


def test_legacy_kit_page_checks_do_not_require_native_hosts_or_a_build_hash(tmp_path):
    # Checks run on saved projects too. An old kit must remain fixable by its own fit command.
    (tmp_path / "index.html").write_text('<div data-composition-id="main" data-width="1920" data-height="1080" data-duration="3"><div data-duration="3"></div></div>')
    assert _checks()._page(tmp_path, {"duration": 3, "width": 1920, "height": 1080}) == []


def artifact_directory(tmp_path: Path, name: str) -> Path:
    """Keep native evidence in CI artifacts when requested, otherwise isolate it per test."""
    configured = os.environ.get("PURE_KINETIC_ARTIFACT_DIR")
    root = Path(configured).expanduser().resolve() if configured else tmp_path
    root.mkdir(parents=True, exist_ok=True)
    return root / name


def native_audit_run(command: list[str], out: Path, *, timeout: int, cwd: Path | None = None):
    """Persist full diagnostics even if a native subprocess fails or times out."""
    out.mkdir(parents=True, exist_ok=True)
    stdout, stderr = out / "stdout.log", out / "stderr.log"
    with stdout.open("w") as output, stderr.open("w") as errors:
        run = subprocess.run(command, stdout=output, stderr=errors, timeout=timeout, cwd=cwd)
    return subprocess.CompletedProcess(command, run.returncode, stdout.read_text(), stderr.read_text())


def test_node_component_contracts(tmp_path):
    # One owner for every tools/*.test.mjs suite; new contract files join CI automatically.
    # The historical tools/kinetic/plans.test.js comparison remains a separate test above.
    scripts = sorted((TEMPLATE / "tools").glob("*.test.mjs"))
    assert scripts, "No Pure Kinetic Node contracts discovered"
    out = artifact_directory(tmp_path, "node-contracts")
    out.mkdir(exist_ok=True)
    (out / "files.json").write_text(json.dumps([script.name for script in scripts], indent=2) + "\n")
    run = subprocess.run(
        ["node", "--test", "--test-reporter=tap", *map(str, scripts)], cwd=TEMPLATE,
        capture_output=True, text=True, timeout=300,
    )
    (out / "results.tap").write_text(run.stdout + run.stderr)
    assert run.returncode == 0, run.stdout[-16000:] + run.stderr[-4000:]


@AUDIT
def test_native_clocks_reverse_seek_and_repeated_component_instances(tmp_path):
    run = subprocess.run([
        "node", str(TEMPLATE / "tools" / "native-accept.mjs"), "--scenes", "title,stat,phone3d",
        "--aspects", "9:16,16:9,1:1", "--out", str(tmp_path / "native"),
    ], capture_output=True, text=True, timeout=300)
    assert run.returncode == 0, run.stdout[-3000:] + run.stderr[-1000:]


@AUDIT
def test_community_components_reuse_native_definitions_with_private_brand_and_clocks(tmp_path):
    run = subprocess.run([
        "node", str(TEMPLATE / "tools" / "community-native.mjs"), "--out", str(tmp_path / "community"),
    ], capture_output=True, text=True, timeout=300)
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-1000:]


@AUDIT
@pytest.mark.parametrize("script", ["native-brand-tokens.mjs", "native-code-pages.mjs", "community-scan-native.mjs", "community-shapes-native.mjs"])
def test_native_brand_edits_code_pages_and_optional_scan_copy(tmp_path, script):
    out = artifact_directory(tmp_path, script.removesuffix(".mjs"))
    run = native_audit_run([
        "node", str(TEMPLATE / "tools" / script), "--out", str(out),
    ], out, timeout=600)
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-1000:]
    if script == "community-scan-native.mjs":
        report = json.loads((out / "report.json").read_text())
        assert report["passed"] and report["sourceStable"]
        assert report["sourceReceipt"]["aggregate"] == report["sourceAfter"]["aggregate"]
        assert report["total"] == report["completed"] == 27
        assert report["failures"] == 0
        dimensions = {"9x16": (1080, 1920), "16x9": (1920, 1080), "1x1": (1080, 1080)}
        for row in report["results"]:
            aspect = row["id"].rsplit("-", 1)[1]
            assert row["nativeCapture"] == dict(zip(("width", "height"), dimensions[aspect]))


def test_component_sounds_keep_visual_impulses_and_own_their_transition_preroll():
    out = json.loads(_node("""
      const F=require(process.argv[1]);
      const original={aspect:'9:16',style:'editorial',brand:{name:'Nook'},scenes:[
        {type:'title',text:'Hello',beats:3},
        {type:'dial',label:'Capacity',value:92,beats:4,in:'glide',timing:{slide:{startBeat:1,endBeat:3}}}]};
      const cases={base:{},mute:{mute:true},silent:{gain:0},quiet:{gain:.25,kit:'cinema'},map:{mapping:{tick:false,chime:'click'}}};
      const result={};
      for(const [key,sound]of Object.entries(cases)){
        const film=structuredClone(original);if(key!=='base')film.scenes[1].sound=sound;
        const plan=F.planOf(film);
        const edited=structuredClone(plan);edited.audioEvents[0].t+=.005;
        result[key]={errors:F.problems(film),cues:plan.cues,audio:plan.audioEvents,start:plan.scenes[1].start,mark:F.soundMark(film,plan),editedMark:F.soundMark(film,edited),summary:F.summary(film,plan)};
      }
      process.stdout.write(JSON.stringify(result));
    """, str(SOURCE / "lib" / "film.cjs")))
    base = out["base"]
    assert all(row["errors"] == [] and row["cues"] == base["cues"] for row in out.values())
    assert any(c["scene"] == 1 and c["t"] < base["start"] and c["kind"] == "whoosh" for c in base["audio"])
    first = [c for c in base["audio"] if c["scene"] == 0]
    for key in ("mute", "silent"):
        assert out[key]["audio"] == first
    quiet = [c for c in out["quiet"]["audio"] if c["scene"] == 1]
    assert quiet and all(c["gain"] == 0.25 and c["kit"] == "cinema" for c in quiet)
    mapped = [c for c in out["map"]["audio"] if c["scene"] == 1]
    assert not any(c["kind"] in {"tick", "chime"} for c in mapped)
    assert any(c["kind"] == "click" for c in mapped)
    assert out["mute"]["mark"] == out["silent"]["mark"], "identical mixer inputs have one soundtrack mark"
    assert len({out[key]["mark"] for key in ("base", "mute", "quiet", "map")}) == 4
    assert all(row["editedMark"] != row["mark"] for row in out.values()), "the exact audible event schedule must invalidate the soundtrack"
    assert all(row["summary"]["cues"] == row["audio"] for row in out.values())


def test_dial_arrival_stays_on_its_musical_beat_across_tempo_and_pace():
    out = json.loads(_node("""
      const F=require(process.argv[1]),rows=[];
      for(const bpm of [72,120,180])for(const pace of ['chill','normal','hyper']){
        const film={aspect:'9:16',style:'editorial',brand:{name:'Nook'},music:{bpm},pace,scenes:[
          {type:'dial',label:'Capacity',value:92,beats:4,timing:{slide:{startBeat:1,endBeat:3}}}]};
        const plan=F.planOf(film);
        rows.push({bpm,pace,errors:F.problems(film),arrival:plan.audioEvents.find(c=>c.kind==='chime').t});
      }
      process.stdout.write(JSON.stringify(rows));
    """, str(SOURCE / "lib" / "film.cjs")))
    assert len(out) == 9
    assert all(row["errors"] == [] and row["arrival"] == pytest.approx(180 / row["bpm"]) for row in out)


def test_component_timing_sound_and_font_inputs_are_validated():
    def film(scene=None, font=None, pace="normal"):
        return {"aspect": "9:16", "style": "editorial", "pace": pace, "brand": {"name": "Nook", **({"font": font} if font is not None else {})},
                "scenes": [{"type": "dial", "label": "Capacity", "value": 92, "beats": 4, **(scene or {})}]}

    cases = {
        "start": film({"timing": {"slide": {"startBeat": -1, "endBeat": 3}}}),
        "backwards": film({"timing": {"slide": {"startBeat": 2, "endBeat": 1}}}),
        "paced_end": film({"timing": {"slide": {"startBeat": 1, "endBeat": 4}}}, pace="hyper"),
        "unknown_action": film({"timing": {"jump": {"startBeat": 1, "endBeat": 2}}}),
        "unsupported_action": film({"type": "title", "text": "Hi", "timing": {"slide": {"startBeat": 1, "endBeat": 2}}}),
        "sound_gain": film({"sound": {"gain": 3}}), "sound_mute": film({"sound": {"mute": "yes"}}),
        "sound_kit": film({"sound": {"kit": "imaginary"}}), "sound_mapping": film({"sound": {"mapping": {"chime": "imaginary"}}}),
        "font_remote": film(font={"family": "Acme", "src": "https://fonts.example/acme.woff2"}),
        "font_traversal": film(font={"family": "Acme", "src": "assets/../private/acme.woff2"}),
        "font_css": film(font={"family": "Acme; color:red", "src": "assets/acme.woff2"}),
        "good_family": film(font="Geist Mono"), "good_file": film(font={"family": "Acme", "src": "assets/acme.woff2", "weight": 600}),
        "good_long_action": film({"beats": 8, "timing": {"slide": {"startBeat": 1, "endBeat": 6}}}),
    }
    out = json.loads(_node("const F=require(process.argv[1]),cases=JSON.parse(process.argv[2]);process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(cases).map(([k,f])=>[k,F.problems(f)]))))", str(SOURCE / "lib" / "film.cjs"), json.dumps(cases)))
    assert all(errors for name, errors in out.items() if not name.startswith("good_")), out
    assert out["good_family"] == out["good_file"] == out["good_long_action"] == []


def test_a_missing_brand_font_is_named_before_browser_setup(tmp_path):
    source = _project(tmp_path, lambda film: film["brand"].update(font={"family": "Acme", "src": "assets/acme.woff2", "weight": 500}))
    found = [d for d in _checks().check(source) if d["code"] == "qa_font_missing"]
    assert len(found) == 1 and "assets/acme.woff2 does not exist" in found[0]["message"]
    shutil.copyfile(next((source / "lib").rglob("*.woff2")), source / "assets" / "acme.woff2")
    assert not [d for d in _checks().check(source) if d["code"] == "qa_font_missing"]


def test_inherited_object_names_are_not_component_or_style_choices():
    out = json.loads(_node("""
      const F=require(process.argv[1]),result={};
      const original={aspect:'9:16',style:'editorial',brand:{name:'Nook'},scenes:[{type:'title',text:'Hello',beats:3}]};
      for(const name of ['constructor','toString','__proto__'])for(const target of ['aspect','style','pace','musicKit','type','transition','look','sceneKit']){
        const film=structuredClone(original);
        if(['aspect','style','pace'].includes(target))film[target]=name;
        else if(target==='musicKit')film.music={kit:name};
        else if(target==='type')film.scenes[0].type=name;
        else if(target==='transition')film.scenes[0].in=name;
        else if(target==='look')film.scenes[0].look=name;
        else film.scenes[0].sound={kit:name};
        result[`${target}/${name}`]=F.problems(film);
      }
      process.stdout.write(JSON.stringify(result));
    """, str(SOURCE / "lib" / "film.cjs")))
    assert len(out) == 24 and all(errors for errors in out.values()), out
