"""Freeze the existing Pure Kinetic pulse bed without scene effects.

Development-only command, run with the repository Python environment. Generated
projects need only the resulting PCM, its metadata and the offline Node builder.
No provider, existing user project or scene soundtrack is read.
"""
from __future__ import annotations

import ast
import hashlib
import json
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = next(p for p in HERE.parents if (p / "core/sound/soundtrack.py").is_file())
sys.path.insert(0, str(REPO / "core/sound"))
from soundtrack import Track, measure, synth  # noqa: E402

source = REPO / "templates/pure-kinetic/source/music.py"
tree = ast.parse(source.read_text())
names = {"notes", "pulse", "CHORDS", "ROOTS"}
nodes = [node for node in tree.body if (
    isinstance(node, ast.FunctionDef) and node.name in names
    or isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in names for t in node.targets)
)]
assert len(nodes) == 4, "The source pulse arrangement changed; review the extraction."
bpm, beats, sample_rate = 108, 32, 48_000
context = {"Track": Track, "synth": synth, "B": 60 / bpm, "bars": beats // 4}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), context)
track = Track(seconds=beats * 60 / bpm, bpm=bpm)
context["pulse"](track)
pcm = track.mix(lufs=-18, fade_in=.012, fade_out=.24, quiet=True)
output = HERE / "pulse-108.wav"
frames = np.round(np.clip(pcm.T, -1, 1) * 32767).astype("<i2")
with wave.open(str(output), "wb") as stream:
    stream.setnchannels(2)
    stream.setsampwidth(2)
    stream.setframerate(sample_rate)
    stream.writeframes(frames.tobytes())
data = output.read_bytes()
record = {
    "file": output.name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
    "sampleRate": sample_rate, "channels": 2, "frames": len(frames),
    "duration": len(frames) / sample_rate, "bpm": bpm, "beats": beats,
    "source": {"kind": "existing-original-arrangement", "file": str(source.relative_to(REPO)),
               "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "function": "pulse"},
    "processing": "Music-only existing pulse, -18 LUFS, 12ms attack, 240ms end fade; no scene effects.",
    "measurements": measure(frames.T.astype(np.float32) / 32767),
}
(HERE / "music.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps({"file": str(output), "duration": record["duration"], "sha256": record["sha256"]}))
