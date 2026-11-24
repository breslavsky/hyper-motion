#!/usr/bin/env python3
"""Pure Kinetic's kit in the shared HyperFrames catalogue.

Other templates' agents find and install the kit (source/lib) through
references/hyperframes/registry_search.py, which copies a bundled item only
when every file matches the SHA-256 written in local-catalog.json. The kit
changes with the template, so its sums are written by this tool:

    python kit/tools/kit-catalog.py           # write the entry
    python kit/tools/kit-catalog.py --check   # exit 1 when it is behind

Run it after a change under kit/source/lib. A kit whose sums
are behind is left out of the catalogue (the components stay), and
tests/test_local_kit_catalog.py fails.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HARNESS = Path(__file__).resolve().parents[2]
CATALOG = HARNESS / "catalog.json"
ROOT = "kit/source/lib"
NAME = "kinetic-scenes"

# What the catalogue says of the kit. The files are added below.
ENTRY = {
    "name": NAME,
    "kind": "kit",
    "root": ROOT,
    "title": "Kinetic Scenes",
    "description": (
        "Pure Kinetic's ready scenes for any HyperFrames film: liquid glass panels (search field, prompt composer, "
        "ask bar, control panel with switches and a slider, notification island, lens over a headline, glass "
        "card flight) in Glass, Dark Glass or Metal, plus kinetic type, charts and device scenes. A command "
        "builds one scene from a short recipe as a native sub-composition and prints its mount and sound cues."
    ),
    "tags": [
        "liquid glass", "glass ui", "glassmorphism", "search field", "prompt composer", "chat input", "ai prompt",
        "toggle switches", "slider", "control panel", "notification island", "magnifying lens", "dark glass",
        "metal ui", "kinetic scenes", "жидкое стекло", "стеклянный интерфейс", "поле поиска", "переключатели",
    ],
    "intentPhrases": [
        "kinetic scenes", "liquid glass", "glass ui", "glass panel", "glass search", "glass search field",
        "prompt composer", "send prompt", "ask bar", "glass controls", "glass island", "glass lens", "dark glass",
        "жидкое стекло", "стеклянная панель", "стеклянный интерфейс", "поле поиска из стекла",
    ],
    "intentGroups": [
        ["glass", "liquid", "frosted", "refractive", "glassmorphism", "metal", "стекло", "стеклянный", "стеклянная",
         "стеклянное", "жидкое", "матовое"],
        ["ui", "interface", "panel", "card", "search", "field", "input", "prompt", "composer", "chat", "ask",
         "controls", "switch", "switches", "toggle", "slider", "island", "notification", "lens", "button",
         "интерфейс", "панель", "карточка", "поиск", "поле", "ввод", "запрос", "переключатель", "ползунок",
         "линза", "кнопка"],
    ],
    "command": "scene.cjs",
    "guide": "USAGE.md",
    "note": (
        "A kit, not one composition: run the returned command with --list to see the scenes, then with a recipe "
        "to write a scene's composition; it prints the host element, two style sheets for <head> and the scene's "
        "sound cues. Give the film's own colours in the recipe's brand.tokens. All files are local; no npm install "
        "is needed."
    ),
}


def kit_files() -> dict[str, str]:
    root = HARNESS / ROOT
    files = {}
    for path in sorted(root.rglob("*")):
        if path.is_file() and not path.is_symlink() and path.name != ".DS_Store":
            files[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


def written(raw: str) -> str:
    doc = json.loads(raw)
    # The file is shared with other components: its formatting is kept as it is,
    # so the only lines that change are the kit's.
    if json.dumps(doc, indent=2, ensure_ascii=False) + "\n" != raw:
        raise SystemExit(f"{CATALOG}: not in the expected formatting (indent 2, UTF-8); the kit's entry was not written")
    entry = {**ENTRY, "files": kit_files()}
    items = [row for row in doc["items"] if row.get("name") != NAME] + [entry]
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
        print(f"Wrote {NAME} ({len(json.loads(new)['items'][-1]['files'])} files) to {CATALOG.relative_to(HARNESS)}")
    else:
        print(f"{NAME} is current")
    return 0


if __name__ == "__main__":
    sys.exit(main())
