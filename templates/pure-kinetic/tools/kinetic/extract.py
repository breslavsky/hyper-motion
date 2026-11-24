"""Extract upstream Kinetic data into a fresh review directory, never the maintained template.
The bundle is the script its app page loads
(https://kinetic.launchloop.tech/app -> /app/assets/index-<hash>.js); it is not kept here.

    python3 templates/pure-kinetic/tools/kinetic/extract.py <index-hash.js> --out /tmp/kinetic-import

Writes inside --out: `scene-library.txt`, `templates.json`, `reference/plan.min.js`,
and `compiler/looks.cjs` / `compiler/fields.cjs` (through schema.js). The output must not
already exist. Review differences and deliberately port any wanted change: the live schemas
contain measured limits and the reference files are frozen parity fixtures. This command does
not replace either or regenerate the guide. The names it looks for are the bundle's minified
ones, so a new build of the app needs them found again using stable surrounding text.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
# What the engine here has not got: a scene of the model's own HTML, a screen recording, and the
# 3D models (they are not on Kinetic's site), as a scene and as a thing a 3D card carries.
LEFT_OUT = ("freestyle", "clip", "props3d")
LEFT_OUT_FIELDS = (("cards3d", "props"),)

LOOKS_HEAD = """// Extracted upstream look data; compiler-only. See SOURCE.json.
module.exports = """

FIELDS_HEAD = """// Extracted upstream field schemas; lib/film.cjs validates against these.
module.exports = """


def literal_end(s, i):
    """Index just past the bracketed literal that opens at s[i], skipping strings and templates."""
    pairs = {"[": "]", "{": "}", "(": ")"}
    stack = []
    while i < len(s):
        c = s[i]
        if c in "\"'":
            j = i + 1
            while s[j] != c:
                j += 2 if s[j] == "\\" else 1
            i = j
        elif c == "`":
            j = i + 1
            while s[j] != "`":
                if s[j] == "\\":
                    j += 2
                elif s[j] == "$" and s[j + 1] == "{":
                    j = literal_end(s, j + 1)
                else:
                    j += 1
            i = j
        elif c in pairs:
            stack.append(pairs[c])
        elif stack and c == stack[-1]:
            stack.pop()
            if not stack:
                return i + 1
        i += 1
    raise ValueError("unbalanced")


def template_end(s: str, i: int) -> int:
    """Index just past the template literal that opens at s[i]."""
    j = i + 1
    while s[j] != "`":
        if s[j] == "\\":
            j += 2
        elif s[j] == "$" and s[j + 1] == "{":
            j = literal_end(s, j + 1)
        else:
            j += 1
    return j + 1


def node(script: str, *args: str, stdin: str | None = None) -> str:
    run = subprocess.run(["node", "-e", script, *args], input=stdin, capture_output=True, text=True)
    if run.returncode:
        raise RuntimeError(run.stderr[-600:])
    return run.stdout


def extract(bundle: Path, output: Path) -> None:
    if output.exists():
        raise ValueError(f"output already exists: {output}; choose a fresh --out directory")
    src = bundle.read_text(encoding="utf-8")
    output.mkdir(parents=True)
    kit = output / "compiler"
    kit.mkdir()

    # The scene library: a template literal with no ${}.
    at = src.index("SCENE LIBRARY (pick from these only")
    start = src.rindex("`", 0, at)
    library = node("process.stdout.write(eval(require('fs').readFileSync(0,'utf8')))", stdin=src[start:template_end(src, start)])
    (output / "scene-library.txt").write_text(library.strip() + "\n", encoding="utf-8")

    # The templates: an array literal that calls one helper for the credit of each.
    at = src.index('[{id:"saas-launch"')
    templates = json.loads(node(
        "const Me=(t,r)=>({author:t,url:`https://x.com/${t}/status/${r}`});process.stdout.write(JSON.stringify(eval(require('fs').readFileSync(0,'utf8'))))",
        stdin=src[at:literal_end(src, at)],
    ))
    (output / "templates.json").write_text(json.dumps(templates, indent=1, ensure_ascii=False), encoding="utf-8")

    # The plan compiler with its looks: from the display-type helper before the looks to the end
    # of the function that returns the plan (the one that sets clickAt).
    start = src.rindex("const ", 0, src.index('={editorial:{id:"editorial"'))
    names = src[src.index('={editorial:{id:"editorial"') - 2:src.index('={editorial:{id:"editorial"')]
    click = src.index("clickAt=Math.min")
    fn = src.rindex("function ", 0, src.rindex("t.scenes.forEach", 0, click))
    name = src[fn + len("function "):src.index("(", fn)]
    end = literal_end(src, src.index("{", fn))
    exports = f"\nmodule.exports={{looks:{names},compile:{name},paces:xh,aspects:Kw,transitions:Vw}};\n"
    (output / "reference").mkdir()
    (output / "reference" / "plan.min.js").write_text(src[start:end] + exports, encoding="utf-8")
    looks = json.loads(node("process.stdout.write(JSON.stringify(require(process.argv[1]).looks))", str(output / "reference" / "plan.min.js")))
    (kit / "looks.cjs").write_text(LOOKS_HEAD + json.dumps(looks, indent="\t") + ";\n", encoding="utf-8")

    # The fields of every scene: the schema's builder calls, read by schema.js.
    at = src.index('[ne({...oe,type:ae("prompt")')
    schema = src[at:literal_end(src, at)]
    fields = subprocess.run(["node", str(HERE / "schema.js"), str(bundle)], input=schema, capture_output=True, text=True, check=True).stdout
    fields = json.loads(fields)
    for name in LEFT_OUT:
        fields.pop(name, None)
    for name, field in LEFT_OUT_FIELDS:
        fields[name].pop(field, None)
    (kit / "fields.cjs").write_text(FIELDS_HEAD + json.dumps(fields, indent="\t") + ";\n", encoding="utf-8")
    print(f"{len(templates)} templates, {len(looks)} looks, {len(fields)} scene types staged in {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("bundle", type=Path, help="downloaded upstream app bundle")
    parser.add_argument("--out", type=Path, required=True, help="new directory for extracted data to review")
    args = parser.parse_args()
    try:
        extract(args.bundle.resolve(), args.out.resolve())
    except (OSError, ValueError) as error:
        parser.exit(1, f"extract: {error}\n")
