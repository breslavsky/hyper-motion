#!/usr/bin/env python3
"""Camera in the shared HyperFrames catalogue.

Agents find and install the kit through references/hyperframes/registry_search.py,
which copies a bundled item only when every file matches the SHA-256 written in
local-catalog.json. This tool writes the entry:

    python components/camera/tools/catalog.py           # write the entry
    python components/camera/tools/catalog.py --check   # exit 1 when it is behind

Run it after a change to one of FILES. A kit whose sums are behind is left out
of the catalogue, and tests/test_camera_component.py fails.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HARNESS = Path(__file__).resolve().parents[3]
CATALOG = HARNESS / "catalog.json"
ROOT = "components/camera"
NAME = "camera"
# What a project gets: the component, its command, the guide and where it is from.
FILES = ["camera.mjs", "hits.mjs", "USAGE.md", "SOURCE.json"]

ENTRY = {
    "name": NAME,
    "kind": "kit",
    "root": ROOT,
    "title": "Camera",
    "description": (
        "One camera over a page that is one world: everything lies on one sheet and the camera goes from one thing "
        "to the next without a cut, closes in, stands back, turns a little, takes the hits of the music and blurs "
        "by its own speed. A stop names an element of the page to look at; the camera measures it and frames it. "
        "For an interface, a board, a page or a line of text looked at part by part in one continuous shot."
    ),
    "tags": [
        "camera move", "continuous shot", "one take", "no cuts", "fly through", "pan and zoom", "zoom in",
        "pull back", "punch in", "camera shake", "handheld", "motion blur", "tour of an interface", "ui walkthrough",
        "движение камеры", "пролёт камеры", "без склеек", "один дубль", "наезд", "отъезд", "облёт интерфейса",
    ],
    "intentPhrases": [
        "camera move", "camera moves", "moving camera", "flying camera", "one continuous shot", "one take",
        "without cuts", "no cuts", "pan and zoom", "camera fly through", "camera tour",
        "движение камеры", "летающая камера", "пролёт камеры", "без склеек", "одним кадром", "один дубль",
    ],
    "intentGroups": [
        ["camera", "shot", "take", "view", "камера", "камеры", "камерой", "кадр", "кадром", "дубль"],
        ["move", "moves", "moving", "fly", "flies", "flying", "travel", "travels", "pan", "zoom", "push", "tour",
         "walkthrough", "continuous", "seamless", "cuts", "движение", "летает", "летающая", "пролёт", "пролет",
         "наезд", "отъезд", "панорама", "непрерывно", "бесшовно", "склеек"],
    ],
    "command": "hits.mjs",
    "guide": "USAGE.md",
    "note": (
        "A kit, not one composition: import camera.mjs in the page, give the world's things data-cam names and "
        "mount the camera with its stops on the page's own GSAP timeline (USAGE.md shows the whole page). The "
        "returned command prints the hits the camera takes from a track map (harness track-map --json). All "
        "files are local; no npm install is needed."
    ),
}


def kit_files() -> dict[str, str]:
    root = HARNESS / ROOT
    return {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in FILES}


def written(raw: str) -> str:
    doc = json.loads(raw)
    # The file is shared with other components: its formatting is kept as it is,
    # so the only lines that change are this kit's.
    if json.dumps(doc, indent=2, ensure_ascii=False) + "\n" != raw:
        raise SystemExit(f"{CATALOG}: not in the expected formatting (indent 2, UTF-8); the kit's entry was not written")
    entry = {**ENTRY, "files": kit_files()}
    items = list(doc["items"])
    names = [row.get("name") for row in items]
    if NAME in names:
        items[names.index(NAME)] = entry
    else:
        # Pure Kinetic's kit writes itself last (kit-catalog.py); this one stays before it.
        place = names.index("kinetic-scenes") if "kinetic-scenes" in names else len(items)
        items.insert(place, entry)
    return json.dumps({**doc, "items": items}, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    raw = CATALOG.read_text(encoding="utf-8")
    new = written(raw)
    if "--check" in sys.argv[1:]:
        if new != raw:
            print(f"The kit's entry in {CATALOG.relative_to(HARNESS)} is behind {ROOT}: run {Path(__file__).relative_to(HARNESS)}", file=sys.stderr)
            return 1
        return 0
    if new != raw:
        CATALOG.write_text(new, encoding="utf-8")
        print(f"Wrote {NAME} ({len(FILES)} files) to {CATALOG.relative_to(HARNESS)}")
    else:
        print(f"{NAME} is current")
    return 0


if __name__ == "__main__":
    sys.exit(main())
