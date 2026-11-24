#!/usr/bin/env python3
"""Lens Wall in the shared HyperFrames catalogue.

Agents find and install the kit through references/hyperframes/registry_search.py,
which copies a bundled item only when every file matches the SHA-256 written in
local-catalog.json. This tool writes the entry:

    python runtimes/hyperframes/components/lens-wall/tools/catalog.py           # write the entry
    python runtimes/hyperframes/components/lens-wall/tools/catalog.py --check   # exit 1 when it is behind

Run it after a change to one of FILES. A kit whose sums are behind is left out
of the catalogue, and tests/test_lens_wall.py fails.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HARNESS = Path(__file__).resolve().parents[5]
CATALOG = HARNESS / "references/hyperframes/local-catalog.json"
ROOT = "runtimes/hyperframes/components/lens-wall"
NAME = "lens-wall"
# What a project gets: the component, its builder, the guide and where it is from.
FILES = ["wall.mjs", "build.mjs", "USAGE.md", "SOURCE.json"]

ENTRY = {
    "name": NAME,
    "kind": "kit",
    "root": ROOT,
    "title": "Lens Wall",
    "description": (
        "An endless wall of the film's own photos and videos under a lens that swells the picture in its centre "
        "and curves the rest away like a sphere. A camera drifts over the wall, travels to the pictures a recipe "
        "names, stops on each and opens it to the full frame; an opened video plays. A command builds the wall "
        "from a short recipe as a native sub-composition and prints its mount, stops and sound cues."
    ),
    "tags": [
        "photo wall", "poster wall", "gallery", "photo gallery", "video gallery", "photo sphere", "poster sphere",
        "fisheye", "lens", "bulge", "collage of photos", "portfolio", "memories", "photo grid", "mosaic",
        "стена фотографий", "галерея", "сфера из фото", "мозаика", "портфолио", "воспоминания",
    ],
    "intentPhrases": [
        "lens wall", "photo wall", "poster wall", "wall of photos", "wall of posters", "wall of pictures",
        "photo sphere", "poster sphere", "sphere of photos", "fisheye gallery", "photo mosaic",
        "стена фото", "стена фотографий", "стена постеров", "сфера из фото", "сфера из фотографий",
        "галерея под линзой",
    ],
    "intentGroups": [
        ["photos", "photo", "pictures", "posters", "poster", "images", "videos", "clips", "memories", "shots",
         "фото", "фотографии", "фотографий", "фотки", "снимки", "постеры", "постеров", "картинки", "видео",
         "ролики", "воспоминания"],
        ["wall", "grid", "gallery", "mosaic", "sphere", "globe", "стена", "стену", "сетка", "галерея", "галерею",
         "мозаика", "сфера", "сферу", "шар"],
        ["lens", "fisheye", "bulge", "magnify", "magnified", "swell", "curved", "browse", "fly", "travel",
         "линза", "линзой", "выпуклая", "увеличение", "увеличением", "пролёт", "пролет", "листать"],
    ],
    "command": "build.mjs",
    "guide": "USAGE.md",
    "note": (
        "A kit, not one composition: write a recipe (USAGE.md says what it holds: the media, the stops, the "
        "lens) and run the returned command with it in the project's source folder; it writes the wall's "
        "composition and prints the host element, when each stop opens and the moments for sound. Media are "
        "the project's own files; a video needs ffmpeg for its still or a poster. All files are local; no npm "
        "install is needed."
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
