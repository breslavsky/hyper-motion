#!/usr/bin/env python3
"""Finish in the shared HyperFrames catalogue.

Agents find and install the kit through references/hyperframes/registry_search.py,
which copies a bundled item only when every file matches the SHA-256 written in
local-catalog.json. This tool writes the entry:

    python components/finish/tools/catalog.py           # write the entry
    python components/finish/tools/catalog.py --check   # exit 1 when it is behind

Run it after a change to one of FILES. A kit whose sums are behind is left out
of the catalogue, and tests/test_finish_component.py fails.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HARNESS = Path(__file__).resolve().parents[3]
CATALOG = HARNESS / "catalog.json"
ROOT = "components/finish"
NAME = "finish"
# What a project gets: the component, its command, the guide and where it is from.
FILES = ["finish.mjs", "events.mjs", "USAGE.md", "SOURCE.json"]

ENTRY = {
    "name": NAME,
    "kind": "kit",
    "root": ROOT,
    "title": "Finish",
    "description": (
        "The look of the whole picture, laid over a film and driven by time: film grain, a chromatic fringe that "
        "pulses on a hit, a vignette, flashes of a frame or two, bursts of camera shake that decay, a slow light "
        "leak. Every part is optional and every frame is the same on every render. It takes the flashes, shakes "
        "and hits of a reference video as they are measured."
    ),
    "tags": [
        "film grain", "grain", "noise texture", "chromatic aberration", "rgb split", "vignette", "flash frame",
        "white flash", "camera shake", "screen shake", "light leak", "film look", "finishing", "grade",
        "зерно", "плёночное зерно", "хроматическая аберрация", "виньетка", "вспышка", "тряска камеры", "засветка",
    ],
    "intentPhrases": [
        "film grain", "chromatic aberration", "rgb split", "vignette", "flash frames", "white flash",
        "camera shake", "screen shake", "light leak", "film look", "finishing pass",
        "плёночное зерно", "хроматическая аберрация", "виньетка", "тряска камеры", "эффект плёнки",
    ],
    "intentGroups": [
        ["grain", "noise", "aberration", "fringe", "vignette", "flash", "flashes", "shake", "leak", "film",
         "зерно", "аберрация", "виньетка", "вспышка", "вспышки", "тряска", "засветка", "плёнка", "плёнки"],
        ["look", "texture", "finish", "finishing", "overlay", "effect", "effects", "pass", "frames", "screen",
         "camera", "вид", "текстура", "отделка", "эффект", "эффекты", "поверх", "экрана", "камеры", "кадра"],
    ],
    "command": "events.mjs",
    "guide": "USAGE.md",
    "note": (
        "A kit, not one composition: import finish.mjs in the page, mark what the finish shakes with data-finish "
        "and mount it on the page's own GSAP timeline (USAGE.md shows the whole page). The returned command "
        "prints the flashes, shakes and hits a finish takes from a reference map (harness reference-map --json). "
        "All files are local; no npm install is needed."
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
