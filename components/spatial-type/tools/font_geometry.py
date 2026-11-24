"""Rebuild every Unicode glyph in bundled Anybody subsets, without network assets.

uv run --no-project --with fonttools==4.60.1 --with brotli==1.1.0 \
    python tools/font_geometry.py
"""
import hashlib
import json
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1] / "assets" / "type"


class Outline(BasePen):
    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.commands = []

    def command(self, name, *points):
        self.commands.append(name)
        for point in points:
            self.commands.extend(f"{v:.3f}".rstrip("0").rstrip(".") if v else "0" for v in point)

    def _moveTo(self, p):
        self.command("m", p)

    def _lineTo(self, p):
        self.command("l", p)

    def _qCurveToOne(self, p1, p2):
        self.command("q", p2, p1)  # Three FontLoader: endpoint before control.

    def _curveToOne(self, p1, p2, p3):
        self.command("b", p3, p1, p2)

    def _closePath(self):
        pass  # Three's ShapePath contours are implicitly closed by extrusion.


def build(width):
    glyphs = {}
    resolution = None
    for filename in ["anybody-latin-ext-normal.woff2", "anybody-latin-normal.woff2"]:
        font = instantiateVariableFont(TTFont(ROOT / filename), {"wght": 800, "wdth": width}, inplace=True)
        resolution = font["head"].unitsPerEm
        gs = font.getGlyphSet()
        for code, name in sorted(font.getBestCmap().items()):
            pen = Outline(gs)
            # Match Three typeface/r8 contour winding, including multi-hole letters.
            gs[name].draw(ReverseContourPen(pen))
            glyphs[chr(code)] = {"ha": gs[name].width, "o": " ".join(pen.commands)}
    data = {"glyphs": glyphs, "familyName": "Anybody", "resolution": resolution,
            "boundingBox": {"yMin": -600, "yMax": 2100}, "underlineThickness": 50,
            "source": {"weight": 800, "width": width, "coverage": "all Unicode cmap entries of bundled latin and latin-ext sources"}}
    target = ROOT / f"anybody-w{width}-800.mjs"
    target.write_text("// Derived OFL font geometry. See SOURCE.json, OFL.txt and provenance.json.\nexport default " + json.dumps(data, ensure_ascii=True, separators=(",", ":")) + ";\n")
    return {"file": target.name, "glyphCount": len(glyphs), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "axes": {"wdth": width, "wght": 800}}


if __name__ == "__main__":
    outputs = [build(130), build(150)]
    inputs = [{"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(ROOT.glob("*.woff2"))]
    receipt = {"generator": "tools/font_geometry.py", "fontTools": "4.60.1", "brotli": "1.1.0", "inputs": inputs, "outputs": outputs}
    (ROOT / "provenance.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt, indent=2))
