"""Template checks of Pure Kinetic (template.json "checks"): run by the harness on every
publish, draft, `harness validate` and `harness check`, next to HyperFrames' own validation.

- `source/film.json` is the film: a look, a tempo and scenes of a type with their words and a
  length in beats. The film's own helper checks it (`node lib/film.cjs check`, the same code
  the page plays it with): a scene type that does not exist, a field missing, text longer than
  its scene fits are errors, each said with its place.
- What would make it a better film is a note (`qa_script`, of severity `info`: not told at a
  publish): a weak opener, no end card, the same scene twice running, slides of type alone, a
  buzzword or a line too long to read. Current kits reject unknown recipe fields rather than
  silently discarding author intent; an older saved project retains its own kit's contract.
- A picture or background video a scene names must exist.
- The page states the film's length and size (`data-duration`, `data-width`, `data-height`):
  they must be the film's own, so the preview and the export end where the film ends.
  `node lib/film.cjs fit` sets them.
- A film's emoji are drawn by the kit's own set (Fluent Emoji), never by the machine's emoji
  font; `fit` writes the ones the film uses to `assets/emoji.json`, and a film whose emoji are
  not there is an error.
- A soundtrack made for another film is a warning (`qa_sound_stale`): its sounds sit on that
  film's cues. The music script writes the film's mark beside the track (`assets/music.json`).
"""

from __future__ import annotations

import json
import math
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

FIT = "run `node lib/film.cjs fit` in source/"
SOUND = "run `harness audio source/music.py`"


def _issue(severity: str, message: str, hint: str = "", file: str = "film.json", code: str = "film") -> dict:
    return {"severity": severity, "code": code, "file": file, "message": message, "hint": hint}


def inspect(source: Path, film: dict) -> dict:
    """What the film's helper says of a film: errors, notes, pictures, length and size."""
    run = subprocess.run(
        ["node", str(source / "lib" / "film.cjs"), "check", "-"],
        input=json.dumps(film), capture_output=True, text=True, timeout=30,
    )
    if run.returncode != 0:
        raise RuntimeError(f"lib/film.cjs could not check the film: {run.stderr.strip()[-300:]}")
    return json.loads(run.stdout)


class _Tags(HTMLParser):
    """Read authored clip attributes without confusing nested scene durations."""

    def __init__(self) -> None:
        super().__init__()
        self.tags: list[tuple[str, dict[str, str | None]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tags.append((tag, dict(attrs)))


def _page(source: Path, result: dict) -> list[dict]:
    index = source / "index.html"
    if not index.is_file():
        return [_issue("error", "source/index.html is missing", file="index.html")]
    html = index.read_text(encoding="utf-8", errors="replace")
    out = []
    parser = _Tags()
    parser.feed(html)
    roots = [attrs for _, attrs in parser.tags if attrs.get("data-composition-id") == "main"]
    if len(roots) != 1:
        out.append(_issue("error", "index.html needs exactly one main composition root", FIT, file="index.html"))

    def number(attrs: dict, name: str) -> float | None:
        try:
            value = float(attrs[name])
            return value if math.isfinite(value) else None
        except (KeyError, TypeError, ValueError):
            return None

    native = result.get("nativeClips")
    if native is None:
        # Existing projects retain their own kit. Its stage and single music
        # clip span the entire film, and its fit cannot create native hosts.
        declared = {float(v) for v in re.findall(r'data-duration="([\d.]+)"', html)}
        if declared and any(abs(v - result["duration"]) > 0.002 for v in declared):
            out.append(_issue(
                "error", f"index.html data-duration {sorted(declared)} differs from the film's length {result['duration']:g} s", FIT, file="index.html",
            ))
    else:
        if roots:
            root_duration = number(roots[0], "data-duration")
            if root_duration is None or abs(root_duration - result["duration"]) > 0.002:
                out.append(_issue("error", f"index.html main data-duration differs from the film's length {result['duration']:g} s", FIT, file="index.html"))
            if result.get("buildMark") and roots[0].get("data-pk-film-hash") != result["buildMark"]:
                out.append(_issue("error", "index.html was built for different film words, style or settings", FIT, file="index.html", code="qa_build_stale"))
        hosts = [attrs for _, attrs in parser.tags if attrs.get("data-composition-src") or attrs.get("data-composition-file")]
        expected = {clip["id"]: clip for clip in native}
        actual_ids = [attrs.get("data-composition-id") for attrs in hosts]
        if len(actual_ids) != len(set(actual_ids)) or set(actual_ids) != set(expected):
            out.append(_issue("error", "index.html native scene hosts differ from the film's scene list", FIT, file="index.html"))
        for attrs in hosts:
            identity = attrs.get("data-composition-id")
            wanted = expected.get(identity)
            if wanted is None:
                continue
            start, duration = number(attrs, "data-start"), number(attrs, "data-duration")
            if start is None or duration is None or abs(start - wanted["start"]) > 0.002 or abs(duration - wanted["duration"]) > 0.002:
                out.append(_issue("error", f"index.html scene {identity} has stale native timing", FIT, file="index.html"))
            relative = attrs.get("data-composition-src") or attrs.get("data-composition-file") or ""
            target = (source / relative).resolve()
            if not target.is_relative_to(source.resolve()) or not target.is_file():
                out.append(_issue("error", f"index.html scene {identity} has no local composition file", FIT, file="index.html"))
        for tag, attrs in parser.tags:
            if tag != "audio":
                continue
            start, duration = number(attrs, "data-start"), number(attrs, "data-duration")
            if start is not None and duration is not None and (start < 0 or duration <= 0 or start + duration > result["duration"] + 0.002):
                out.append(_issue("error", f"index.html audio {attrs.get('id', '(unnamed)')} lies outside the film", FIT, file="index.html"))
    # The film's emoji are drawn by the kit's set, which `fit` writes beside the film: without
    # it they are the machine's own, another picture on another worker.
    try:
        drawn = json.loads((source / "assets" / "emoji.json").read_text(encoding="utf-8")).get("emoji", {})
    except (OSError, ValueError, AttributeError):
        drawn = None
    # Only for a project whose kit has the set: a project made before it keeps its own kit, and
    # its `fit` writes no emoji (asked of such a project, the agent copied the worker's kit over
    # the project's to get past the error).
    has_set = (source / "lib" / "emoji.json.gz").is_file()
    if has_set and (drawn is None or any(char not in drawn for char in result.get("emoji", []))):
        out.append(_issue("error", "the film's emoji are not written for the page yet (assets/emoji.json)", FIT, file="assets/emoji.json"))
    size = re.search(r'data-width="(\d+)"[^>]*data-height="(\d+)"', html)
    if size and (int(size[1]), int(size[2])) != (result["width"], result["height"]):
        out.append(_issue(
            "error", f"index.html is {size[1]}x{size[2]}, the film's aspect is {result['width']}x{result['height']}", FIT, file="index.html",
        ))
    return out


def _sound(source: Path, mark: str) -> list[dict]:
    """Whether the soundtrack is the one made for this film: the music script writes the film's
    mark beside it (assets/music.json). File times are no measure: a checkout sets them anew."""
    music = source / "assets" / "music.m4a"
    if not music.is_file():
        return [_issue("warning", "the film has no soundtrack yet", SOUND, file="assets/music.m4a", code="qa_no_sound")]
    try:
        made_for = json.loads(music.with_suffix(".json").read_text(encoding="utf-8")).get("film")
    except (OSError, ValueError, AttributeError):
        made_for = None
    if made_for != mark:
        return [_issue("warning", "the soundtrack was made for another film: its sounds sit on the old cues", SOUND, file="assets/music.m4a", code="qa_sound_stale")]
    return []


def check(source: Path) -> list[dict]:
    path = source / "film.json"
    if not path.is_file():
        return [_issue("error", "source/film.json is missing", "write the film as source/film.json (the template guide gives its shape)")]
    try:
        film = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [_issue("error", f"film.json is not valid JSON: {exc}")]
    try:
        result = inspect(source, film)
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        return [_issue("error", f"could not check film.json: {exc}")]

    out = [_issue("error", message, "the scene library in the template guide lists every scene's fields") for message in result["errors"]]
    if out:
        return out
    # Subjective script notes do not block a publish. Current fit/review prints
    # resolved copy, colours and timing for one bounded comparison with the brief.
    out += [_issue("info", note, code="qa_script") for note in result["notes"]]
    for where, asset in [*result["pictures"], *result.get("videos", [])]:
        if re.match(r"^(https?:|data:)", asset):
            continue
        disk_path = unquote(urlsplit(asset).path) if ".background." in where else asset
        if not (source / disk_path).is_file():
            out.append(_issue("error", f"{where}: {asset} does not exist", "use the path of an upload (`harness assets`) or of a generated file, as seen from source/"))
    font = film.get("brand", {}).get("font")
    if result.get("nativeClips") is not None and isinstance(font, dict) and font.get("src") and not (source / font["src"]).is_file():
        out.append(_issue("error", f'brand.font.src: {font["src"]} does not exist', "copy the brand font into source/assets/ and use its local path", file=font["src"], code="qa_font_missing"))
    return out + _page(source, result) + _sound(source, result["sound"])
