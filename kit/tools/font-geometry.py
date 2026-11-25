"""Glyph outlines of a bundled font, for scenes that build letters as real geometry.

A scene of extruded letters (kinetic-burst-words) cannot ask the browser for a
glyph's outline, so the outlines of one family at one weight are written out
once, from the kit's own font files, as a module the scene loads when it runs.

    uv run --no-project --with fonttools==4.60.1 --with brotli==1.1.0 \
        python kit/tools/font-geometry.py            # writes the file
    ... python kit/tools/font-geometry.py --check    # fails when it is stale
"""
import json
import sys
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONTS = Path(__file__).resolve().parents[1] / "source" / "lib" / "fonts"
FAMILY, ID, WEIGHT = "Onest", "onest", 600
SUBSETS = ["cyrillic-ext", "cyrillic", "latin-ext", "latin"]
TARGET = FONTS / "geometry" / f"{ID}-{WEIGHT}.mjs"


class Outline(BasePen):
    """A glyph as contours of whole numbers: M x y, L x y, Q cx cy x y, C c1 c2 x y."""

    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.commands = []

    def command(self, name, *points):
        self.commands.append(name)
        for x, y in points:
            self.commands.extend([str(round(x)), str(round(y))])

    def _moveTo(self, p):
        self.command("M", p)

    def _lineTo(self, p):
        self.command("L", p)

    def _qCurveToOne(self, p1, p2):
        self.command("Q", p1, p2)

    def _curveToOne(self, p1, p2, p3):
        self.command("C", p1, p2, p3)

    def _closePath(self):
        self.commands.append("Z")


def build():
    glyphs, units, cap = {}, None, None
    for subset in SUBSETS:
        font = instantiateVariableFont(TTFont(FONTS / f"{ID}-{subset}-normal.woff2"), {"wght": WEIGHT}, inplace=True)
        units = font["head"].unitsPerEm
        cap = cap or getattr(font["OS/2"], "sCapHeight", None)
        glyph_set = font.getGlyphSet()
        for code, name in sorted(font.getBestCmap().items()):
            pen = Outline(glyph_set)
            glyph_set[name].draw(pen)
            glyphs[chr(code)] = [round(glyph_set[name].width), " ".join(pen.commands)]
    data = {"family": FAMILY, "weight": WEIGHT, "unitsPerEm": units, "capHeight": cap, "glyphs": dict(sorted(glyphs.items()))}
    return ("// The outlines of %s %d, written by kit/tools/font-geometry.py from the kit's own font files\n"
            "// (fonts/SOURCE.json, OFL-onest.txt). Per glyph: its advance and its contours.\n"
            "export default %s;\n") % (FAMILY, WEIGHT, json.dumps(data, ensure_ascii=True, separators=(",", ":")))


if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        if not TARGET.exists() or TARGET.read_text() != text:
            sys.exit(f"{TARGET} is stale: run kit/tools/font-geometry.py")
    else:
        TARGET.parent.mkdir(exist_ok=True)
        TARGET.write_text(text)
        print(TARGET, len(text))
