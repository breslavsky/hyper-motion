"""From a technique of the community library to a scene of Pure Kinetic.

The library holds moves taken out of the videos people made (one standalone composition each,
`core/generation/technique_library.py`). A scene of ours is such a move written again for this
engine: a pure function of the scene's clock, drawn in the look's type and colours, with the
film's words (`source/lib/components/README.md` says how a scene is defined). This tool is the way
from one to the other, for whoever writes the scene; a project's agent never runs it.

    uv run python kit/tools/technique.py find "numbers that count up in a card"
    uv run python kit/tools/technique.py get <technique id>
    uv run python kit/tools/technique.py new <technique id> <scene> --into cards
    uv run python kit/tools/technique.py accept <scene>
    uv run python kit/tools/technique.py list | record

- `find` searches the library (HyperFrames techniques only) and says which results a scene was
  already written from.
- `get` puts the technique's code and description into `tools/techniques/<id>/` to read. It is
  other people's code: git-ignored, read for the move, never pasted (it carries its own fonts,
  colours and words; its timeline must be adapted to the component contract).
- `new` writes the scene's definition as a stub into `source/lib/components/scenes/<file>.mjs` (a
  new file is registered in the component catalogue): its `from`, one text field, a line
  for the guide, a sample and a build that sets the text in the middle. The stub passes the
  checks, so the work starts from a scene that plays.
- `accept` is the gate. It fails unless the scene is defined whole (`from`, `fields`, `guide`,
  `sample`, `build`), its file reads no clock, timer or chance, its sample is a valid film, the
  picture audit finds no fault in it in five looks and three frames (`tools/audit.mjs`, with
  `--twice`: the same moment drawn twice is the same picture), and the guide has its line. It draws a
  sheet of its frames to look at, and writes the technique's name and page into
  `tools/techniques.json`, the record of where each scene came from.
- `list` shows every scene of ours with the technique it was written from; `record` writes
  `tools/techniques.json` for every one of them (the scenes written before this tool).

Needs the template's packages and Chrome for `accept` (as audit.mjs), and the library's
address (`HARNESS_TECHNIQUE_LIBRARY_URL`, the public one by default) for `find` and `get`.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent
REPO = TEMPLATE.parent.parent
SOURCE = TEMPLATE / "source"
COMPONENTS = SOURCE / "lib" / "components"
KEPT = TEMPLATE / "tools" / "techniques"
RECORD = TEMPLATE / "tools" / "techniques.json"
LIBRARY = "https://motionfab.app/api/library/mcp"
RUNTIME = "hyperframes"
LOOKS = "editorial,sting,liquid,frost,noir"
NAME = re.compile(r"^[a-z][a-z0-9-]{1,23}$")
# What a scene never reads: a clock, a timer, a chance. Its picture is a function of the scene's moment alone.
CLOCKS = re.compile(r"Math\.random|Date\.now|new Date|performance\.now|setTimeout|setInterval|requestAnimationFrame")

STUB = """
	// TODO: what the viewer sees, in one line.
	define("{scene}", {{
		from: "{technique}",
		fields: {{ text: {{ kind: "string", min: 1, max: 40 }} }},
		guide: "{scene} {{text}}: TODO what it shows and when to use it. 3-4 beats.",
		sample: {{ type: "{scene}", beats: 4, text: "Bookings that run themselves" }},
		// sounds(s, len, cue, beat) {{ cue(0.1, "tick"); }},
		build({{ p, cam, fg, accent, K }}) {{
			const {{ S, el, set, px, prog, expoOut }} = K;
			const wrap = el("div", "center", cam);
			const line = el("div", "display", wrap, p.scene.text);
			set(line, {{ color: fg, textAlign: "center" }});
			K.design.fitSize(line, K.safe.w * 0.92, K.safe.h * 0.5, 'display');
			return (l) => {{
				const k = expoOut(prog(l, 0.05, 0.5));
				set(line, {{ opacity: k.toFixed(3), transform: `translateY(${{px((1 - k) * 40 * S)}})`, color: l > p.dur * 0.6 ? accent : fg }});
			}};
		}},
	}});
"""

NEW_FILE = """// Native component factories adapted from community techniques. See ../README.md.
import metadata from '../metadata.mjs';
export function createFamily(K) {
const sceneFactories = {};
return {sceneFactories};
}
"""


def fail(message: str) -> None:
    print(f"technique: {message}", file=sys.stderr)
    raise SystemExit(1)


def node(script: str, *args: str) -> str:
    run = subprocess.run(["node", "-e", script, *args], capture_output=True, text=True, cwd=TEMPLATE, timeout=60)
    if run.returncode != 0:
        fail(run.stderr.strip()[-600:])
    return run.stdout


def own() -> dict[str, dict]:
    """Every scene of ours: what its definition has, its technique, its sample and what the film check says of it."""
    return json.loads(node(
        """
        (async()=>{
        const defs = require("./source/lib/compiler/definitions.cjs");
        const film = require("./source/lib/film.cjs");
        const catalog = require("./source/lib/components/catalog.json");
        const {createComponentLibrary} = await import("./source/lib/components/index.mjs");
        const maths = await import("./source/lib/components/maths.mjs");
        const library = createComponentLibrary({plan:{look:{}},helpers:{maths,dom:{},moves:{},ui:{}}});
        const out = {};
        for (const [type, def] of Object.entries(defs)) {
          let errors = ["no sample"];
          try { if (def.sample) errors = film.problems({ aspect: "9:16", style: "liquid", brand: { name: "Nook" }, scenes: [def.sample] }); } catch (err) { errors = [String(err.message)]; }
          const file = catalog[type] ? `source/lib/components/scenes/${catalog[type].family}.mjs` : null;
          let hasFactory = false;
          try { hasFactory = typeof await library.get(type) === "function"; } catch(error) { errors.push(String(error.message)); }
          out[type] = { keys: [...Object.keys(def), ...(hasFactory ? ["build"] : [])], file, from: def.from ?? null, guide: def.guide ?? "", sample: def.sample ?? null, errors };
        }
        process.stdout.write(JSON.stringify(out));
        })().catch(error=>{console.error(error.stack);process.exitCode=1;});
        """
    ))


def library():
    sys.path.insert(0, str(REPO))
    from core.generation.technique_library import TechniqueLibrary

    return TechniqueLibrary(os.environ.get("HARNESS_TECHNIQUE_LIBRARY_URL") or LIBRARY, user_agent="motion-fab-harness/technique-tool")


def find(args: argparse.Namespace) -> None:
    async def run() -> dict:
        lib = library()
        try:
            return await lib.find(query=args.query, runtime=RUNTIME, kind=args.kind, limit=args.limit)
        finally:
            await lib.aclose()

    made = {scene["from"]: name for name, scene in own().items() if scene["from"]}
    for row in asyncio.run(run())["results"]:
        mark = f"  [scene `{made[row['id']]}`]" if row["id"] in made else ""
        print(f"{row['id']}  {row.get('score', '')}  {row['kind']}  {row['name']}{mark}\n    {row['description'][:300]}")


def get(args: argparse.Namespace) -> None:
    async def run() -> dict:
        lib = library()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                got = await lib.get(Path(tmp), technique_id=args.id, runtime=RUNTIME, check=lambda code: None, name="technique")
                folder = KEPT / args.id
                folder.mkdir(parents=True, exist_ok=True)
                for file in (Path(tmp) / got["dir"]).iterdir():
                    (folder / file.name).write_bytes(file.read_bytes())
                return got
        finally:
            await lib.aclose()

    got = asyncio.run(run())
    print(f"{got['name']} ({got['kind']})\n{got['description']}\nin {(KEPT / args.id).relative_to(REPO)}: {', '.join(sorted(f.name for f in (KEPT / args.id).iterdir()))}")
    print("Read it for the move. Adapt it to the native component draw contract; use the host clock, fonts, colours and content.")


def new(args: argparse.Namespace) -> None:
    if not NAME.match(args.scene):
        fail("a scene's name is lower case letters, digits and hyphens, 2-24 long")
    fields = json.loads(node('process.stdout.write(JSON.stringify(Object.keys(require("./source/lib/compiler/fields.cjs"))))'))
    scenes = own()
    if args.scene in fields or args.scene in scenes:
        fail(f"there is a scene `{args.scene}` already")
    for name, scene in scenes.items():
        if scene["from"] == args.id:
            fail(f"the scene `{name}` was written from this technique")
    if not NAME.match(args.into):
        fail("--into names a family in source/lib/components/scenes/ without .mjs, such as cards")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.id):
        fail("a technique id contains letters, digits, underscores or hyphens")
    file = COMPONENTS / "scenes" / f"{args.into}.mjs"
    code = file.read_text(encoding="utf-8") if file.is_file() else NEW_FILE
    if "const sceneFactories" not in code:
        fail(f"{file.name} does not expose the native sceneFactories contract")
    stub = STUB.format(scene=args.scene, technique=args.id)
    metadata = json.loads(node("const definitions={};const define=(name,def)=>definitions[name]=def;eval(process.argv[1]);process.stdout.write(JSON.stringify(definitions));", stub))
    canonical = COMPONENTS / "metadata.cjs"
    content = canonical.read_text(encoding="utf-8")
    end = content.rindex("};\nmodule.exports = definitions;")
    entry = json.dumps(args.scene) + ":" + json.dumps(metadata[args.scene], ensure_ascii=False, indent=2)
    canonical.write_text(content[:end].rstrip() + ",\n" + entry + "\n" + content[end:], encoding="utf-8")
    build = "build(" + stub.split("build(", 1)[1].rsplit("\n\t});", 1)[0].strip().rstrip(",")
    identifier = "definition_" + args.scene.replace("-", "_")
    factory = f'const {identifier} = {{...metadata[{json.dumps(args.scene)}], {build}}};\nsceneFactories[{json.dumps(args.scene)}] = given => {identifier}.build(given);\n'
    if "import metadata from" not in code:
        code = "import metadata from '../metadata.mjs';\n" + code
    if "export function createFamily" in code:
        end = code.rindex("return {sceneFactories};")
        code = code[:end] + factory + code[end:]
    else:
        code += "\n" + factory
    file.write_text(code, encoding="utf-8")
    catalog_file = COMPONENTS / "catalog.json"
    catalog = json.loads(catalog_file.read_text(encoding="utf-8"))
    catalog[args.scene] = {"family": args.into, "renderMode": "dom", "owned": True}
    catalog_file.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    (COMPONENTS / "catalog.mjs").write_text("export const catalog=" + json.dumps(catalog, indent=2) + ";\nexport default catalog;\n", encoding="utf-8")
    subprocess.run(["node", str(TEMPLATE / "tools" / "sync-component-metadata.cjs")], check=True, capture_output=True)
    print(f"`{args.scene}` is a native factory in {file.relative_to(REPO)}. Its metadata lives in components/metadata.cjs. Write its fields, guide, sample and build, then:\n  uv run python kit/tools/technique.py accept {args.scene}")


def accept(args: argparse.Namespace) -> None:
    subprocess.run(["node", str(TEMPLATE / "tools" / "sync-component-metadata.cjs")], check=True, capture_output=True)
    scenes = own()
    scene = scenes.get(args.scene)
    if scene is None:
        fail(f"no scene of ours is called `{args.scene}`: {', '.join(scenes)}")
    problems = [f"its definition has no `{key}`" for key in ("from", "fields", "guide", "sample", "build") if key not in scene["keys"]]
    if not scene["guide"].startswith(f"{args.scene} ") or "TODO" in scene["guide"]:
        problems.append("its guide line starts with its name and its fields and says what it shows (no TODO)")
    if (scene["sample"] or {}).get("type") != args.scene:
        problems.append("its sample is a scene of its own type")
    problems += [f"its sample: {error}" for error in scene["errors"]]
    if scene.get("file"):
        file = TEMPLATE / scene["file"]
        code = file.read_text(encoding="utf-8")
        if found := sorted(set(CLOCKS.findall(code))):
            problems.append(f"{file.name} reads a clock or a chance ({', '.join(found)}): a scene is a function of its moment `l` and of K.hash")
    if problems:
        fail(f"`{args.scene}` is not whole:\n  " + "\n  ".join(problems))

    audit = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "audit.mjs"), "--scenes", args.scene, "--looks", args.looks, "--aspects", "9:16,16:9,1:1", "--twice"],
        capture_output=True, text=True, timeout=900,
    )
    print(audit.stdout.strip()[-1500:])
    if audit.returncode != 0:
        fail(f"the picture audit found faults in `{args.scene}` (or could not run): {audit.stderr.strip()[-300:]}\n  `node tools/audit.mjs --scenes {args.scene} --texts` prints where every text stands")

    guide = subprocess.run([sys.executable, str(TEMPLATE / "tools" / "kinetic" / "guide.py")], capture_output=True, text=True, timeout=120)
    if guide.returncode != 0 or f"\n- {args.scene} " not in (TEMPLATE / "AGENTS.md").read_text(encoding="utf-8"):
        fail(f"the guide has no line of `{args.scene}`: {guide.stderr.strip()[-300:]}")

    sheet = Path(args.sheet) if args.sheet else Path(tempfile.gettempdir()) / f"pure-kinetic-{args.scene}.jpg"
    film = {"aspect": "9:16", "style": "editorial", "brand": {"name": "Nook", "url": "nook.app"}, "scenes": [scene["sample"]]}
    drawn = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "sheet.mjs"), "-", "--out", str(sheet), "--looks", args.looks, "--samples", "6"],
        input=json.dumps(film), capture_output=True, text=True, timeout=600,
    )
    if drawn.returncode != 0:
        fail(f"the sheet could not be drawn: {(drawn.stdout + drawn.stderr).strip()[-400:]}")

    recorded(args.scene, scene["from"])
    print(f"`{args.scene}` is accepted. Look at its frames before it is committed: {sheet}")


def recorded(name: str, technique: str) -> None:
    """The scene's line of tools/techniques.json: its technique, the technique's name and the page of the video it is from."""
    record = json.loads(RECORD.read_text(encoding="utf-8")) if RECORD.is_file() else {"scenes": {}}
    record["note"] = "Where each scene of ours came from: the technique of the community library it was written from, and the page of the video that technique was taken out of. Written by tools/technique.py (accept, record)."
    kept = KEPT / technique / "technique.json"
    if not kept.is_file():
        get(argparse.Namespace(id=technique))
    known = json.loads(kept.read_text(encoding="utf-8"))
    record["scenes"][name] = {"technique": technique, "name": known.get("name", ""), "recipe": (known.get("recipe") or {}).get("url", "")}
    record["scenes"] = dict(sorted(record["scenes"].items()))
    RECORD.write_text(json.dumps(record, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def record(_: argparse.Namespace) -> None:
    """Every scene written from a technique, recorded (for scenes written before this tool)."""
    for name, scene in own().items():
        if scene["from"]:
            recorded(name, scene["from"])


def listing(_: argparse.Namespace) -> None:
    record = json.loads(RECORD.read_text(encoding="utf-8"))["scenes"] if RECORD.is_file() else {}
    for name, scene in own().items():
        print(f"{name:12} {scene['from'] or 'written from nothing':44} {record.get(name, {}).get('name', '')}")


def main() -> None:
    parser = argparse.ArgumentParser(description="From a technique of the community library to a scene of Pure Kinetic.")
    commands = parser.add_subparsers(dest="command", required=True)
    p = commands.add_parser("find")
    p.add_argument("query")
    p.add_argument("--kind")
    p.add_argument("--limit", type=int, default=8)
    p.set_defaults(run=find)
    p = commands.add_parser("get")
    p.add_argument("id")
    p.set_defaults(run=get)
    p = commands.add_parser("new")
    p.add_argument("id")
    p.add_argument("scene")
    p.add_argument("--into", required=True)
    p.set_defaults(run=new)
    p = commands.add_parser("accept")
    p.add_argument("scene")
    p.add_argument("--looks", default=LOOKS)
    p.add_argument("--sheet")
    p.set_defaults(run=accept)
    p = commands.add_parser("record")
    p.set_defaults(run=record)
    p = commands.add_parser("list")
    p.set_defaults(run=listing)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
