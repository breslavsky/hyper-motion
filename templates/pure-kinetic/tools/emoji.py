"""Writes the template's emoji set: `source/lib/emoji.json.gz`, every emoji of Fluent Emoji Flat
(Microsoft, MIT; the illustration library's pinned package, illustrations/) as the SVG that
draws it, by the characters it is written with. A film's emoji are drawn with these, not with
the worker's own emoji font (Apple's on a Mac, Noto's on Linux: the same film looked different
by the machine that made it). `node lib/film.cjs fit` takes the ones a film uses out of it.

    python3 templates/pure-kinetic/tools/emoji.py
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SET = HERE.parents[2] / "illustrations" / "node_modules" / "@iconify-json" / "fluent-emoji-flat"
OUT = HERE.parent / "source" / "lib" / "emoji.json.gz"


def main() -> None:
    icons = json.loads((SET / "icons.json").read_text(encoding="utf-8"))
    chars = json.loads((SET / "chars.json").read_text(encoding="utf-8"))
    out = {}
    for code, name in sorted(chars.items()):
        icon = icons["icons"].get(name)
        if icon:
            # Written with or without the variation selector that asks for the picture form.
            text = "".join(chr(int(part, 16)) for part in code.split("-"))
            out[text.replace("️", "")] = icon["body"]
    data = json.dumps({"size": icons.get("width", 32), "emoji": out}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # mtime 0: the same set is the same file, byte for byte.
    OUT.write_bytes(gzip.compress(data, 9, mtime=0))
    print(f"{len(out)} emoji, {len(data) // 1024} KB, {OUT.stat().st_size // 1024} KB packed -> {OUT}")


if __name__ == "__main__":
    main()
