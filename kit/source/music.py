"""The film's soundtrack, written from source/film.json: the track of its look (or the one
`music.track` names) at the film's tempo, as long as the film, and a sound on every cue of the
plan: a tick as a part lands, a click of the cursor, a whoosh into a scene, a hit on a slam and on
the end card, a riser into it. The sounds are the kit's of the film's look (`lib/sounds.json`:
soft, punch, tech, play, cinema; `music.kit` names another), library sounds mixed into the
track. In step with the picture because every time is the plan's own (`node lib/film.cjs plan`). After a change to film.json run it again:
harness audio source/music.py

    PYTHONPATH=core/sound HARNESS_SOUNDS=sounds uv run python kit/source/music.py

Tracks: `pulse` four on the floor with bright chords, `bounce` half-time with an 808, `drive`
fast with an arpeggio, `air` calm plucks, `space` a drone with a ticking clock, `none` the sounds
of the picture alone. A film that names a file of its own (`music.file`: the user's track, or one a
tool made) plays that instead, from the beat its plan starts on. A film with a voice-over (scenes with
"voice") has every take laid where its scene begins, the music lowered under it.
"""

import hashlib
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from soundtrack import Track, sound, synth

HERE = Path(__file__).resolve().parent
OUT = HERE / "assets" / "music.m4a"
plan = json.loads(subprocess.run(
    ["node", str(HERE / "lib" / "film.cjs"), "plan", str(HERE / "film.json")], capture_output=True, text=True, check=True,
).stdout)

seconds = plan["duration"]
bpm = plan["bpm"]
B = plan["beat"]
beats = math.ceil(seconds / B)
bars = math.ceil(beats / 4)
# Four bars of chords in A minor, and their roots.
CHORDS = [("A3", "C4", "E4"), ("F3", "A3", "C4"), ("C4", "E4", "G4"), ("G3", "B3", "D4")]
ROOTS = ["A1", "F1", "C2", "G1"]


def notes(track: Track, placed: list[tuple[float, str, float]], *, wave: str, bus: str, gain_db: float, cutoff: float | None = None, release: float = 0.08) -> None:
    """Plain notes at their beats: (beat, note, length in beats)."""
    for beat, name, length in placed:
        track.add(synth.tone(name, length * B, wave=wave, release=release, cutoff=cutoff), beat=beat, bus=bus, gain_db=gain_db)


def pulse(track: Track) -> None:
    track.pattern(synth.kick(tone=52, punch=0.8, decay=0.34), "x...x...x...x...", bars=bars, bus="drums", gain_db=-5)
    track.pattern(synth.clap(), "....x.......x...", bar=1, bars=bars - 1, bus="drums", gain_db=-11)
    track.pattern(synth.hat(), "..x...x...x...x.", bars=bars, bus="drums", gain_db=-15)
    notes(track, [(bar * 4 + beat, ROOTS[bar % 4], 0.4) for bar in range(bars) for beat in (0, 0.75, 1.5, 2, 2.75, 3.5)], wave="square", bus="bass", gain_db=-12, cutoff=500)
    notes(track, [(bar * 4 + beat, name, 0.4) for bar in range(bars) for beat in (0, 2.5) for name in CHORDS[bar % 4]], wave="saw", bus="keys", gain_db=-17, cutoff=2600)
    track.bus("keys").delay(B * 0.75, feedback=0.3, mix=0.2).reverb(1.1, mix=0.16)
    track.duck("bass", by="drums", depth_db=-4, release=0.12)


def bounce(track: Track) -> None:
    track.pattern(synth.kick(tone=44, punch=1.0, decay=0.5), "x.........x.....", bars=bars, bus="drums", gain_db=-5)
    track.pattern(synth.snare(decay=0.16), "........x.......", bars=bars, bus="drums", gain_db=-11)
    track.pattern(synth.hat(), "x.x.x.xxx.x.x.x.", bars=bars, bus="drums", gain_db=-17, swing=0.18)
    notes(track, [(bar * 4 + beat, ROOTS[bar % 4], length) for bar in range(bars) for beat, length in ((0, 1.6), (2.5, 1.2))], wave="sine", bus="bass", gain_db=-8, release=0.2)
    notes(track, [(bar * 4 + beat, CHORDS[bar % 4][i % 3], 0.3) for bar in range(bars) for i, beat in enumerate((0.5, 1.5, 2, 3.5))], wave="triangle", bus="keys", gain_db=-14)
    track.bus("keys").delay(B * 0.5, feedback=0.25, mix=0.18)


def drive(track: Track) -> None:
    track.pattern(synth.kick(tone=54, punch=0.9, decay=0.28), "x...x...x...x...", bars=bars, bus="drums", gain_db=-5)
    track.pattern(synth.hat(), "..x...x...x...x.", bars=bars, bus="drums", gain_db=-13)
    track.pattern(synth.hat(decay=0.02), "xxxxxxxxxxxxxxxx", bars=bars, bus="drums", gain_db=-22)
    track.pattern(synth.clap(), "....x.......x...", bar=2, bars=max(0, bars - 2), bus="drums", gain_db=-12)
    notes(track, [(bar * 4 + step * 0.5 + 0.25, ROOTS[bar % 4], 0.22) for bar in range(bars) for step in range(8)], wave="saw", bus="bass", gain_db=-13, cutoff=700)
    arp = [(bar * 4 + step * 0.25, CHORDS[bar % 4][(0, 1, 2, 1)[step % 4]].replace("3", "4"), 0.2) for bar in range(bars) for step in range(16)]
    notes(track, arp, wave="square", bus="keys", gain_db=-20, cutoff=3200)
    track.bus("keys").delay(B * 0.75, feedback=0.35, mix=0.22)
    track.duck("bass", by="drums", depth_db=-5, release=0.1)


def air(track: Track) -> None:
    track.pattern(synth.hat(decay=0.03), "....x.......x...", bars=bars, bus="drums", gain_db=-22)
    track.pattern(synth.kick(tone=46, punch=0.5, decay=0.4, click=0.1), "x...............", bars=bars, bus="drums", gain_db=-11)
    plucks = [(bar * 4 + step * 0.5, CHORDS[bar % 4][(0, 2, 1, 2, 0, 1, 2, 1)[step]].replace("3", "4"), 0.45) for bar in range(bars) for step in range(8)]
    notes(track, plucks, wave="triangle", bus="keys", gain_db=-13, release=0.25)
    notes(track, [(bar * 4, ROOTS[bar % 4].replace("1", "2"), 3.6) for bar in range(bars)], wave="sine", bus="bass", gain_db=-13, release=0.6)
    track.bus("keys").delay(B * 0.75, feedback=0.4, mix=0.28).reverb(2.2, mix=0.25)


def space(track: Track) -> None:
    for bar in range(0, bars, 2):
        for name in (ROOTS[bar % 4].replace("1", "2"), CHORDS[bar % 4][2]):
            track.add(synth.tone(name, 8 * B, wave="saw", attack=1.2, release=1.5, cutoff=420), beat=bar * 4, bus="drone", gain_db=-14)
    track.bus("drone").reverb(3.5, mix=0.4)
    track.pattern(synth.click(tone=1800, decay=0.02), "x...x...x...x...", bars=bars, bus="drums", gain_db=-20)
    for bar in range(0, bars, 4):
        track.add(synth.boom(tone=38, seconds=2.6, noise=0.3), beat=bar * 4, bus="hits", gain_db=-9)


BEDS = {"pulse": pulse, "bounce": bounce, "drive": drive, "air": air, "space": space}

# The sounds of the picture: the kit of the film's look (lib/sounds.json), for each kind of cue
# the library sounds that play it, taken in turn. A kind a kit has no sound for is synthesized.
KITS = json.loads((HERE / "lib" / "sounds.json").read_text(encoding="utf-8"))["kits"]
SYNTH = {
    "hit": lambda i, strength: (synth.boom(tone=52, seconds=0.7, noise=0.25), -8, "start"),
    "whoosh": lambda i, strength: (synth.whoosh(0.45 if strength < 1.15 else 0.7, seed=i + 1), -12, "peak"),
    "riser": lambda i, strength: (synth.riser(2 * B + 0.6), -14, "end"),
}
turn: dict[str, int] = {}


def faded(audio, seconds: float = 0.12):
    """A sound cut short ends in a fade, not a click."""
    n = min(audio.shape[-1], int(seconds * 48000))
    out = audio.copy()
    out[..., -n:] *= np.linspace(1, 0, n, dtype=np.float32)
    out.cue = audio.cue
    return out


def played(kind: str, i: int, strength: float, kit: str | None = None):
    """The sound of a cue: (audio, level in dB at strength 1, the point of it that lands on the cue)."""
    kit = kit or plan["kit"]
    takes = KITS[kit].get(kind)
    if not takes:
        return SYNTH[kind](i, strength) if kind in SYNTH else None
    # A strong whoosh is the kit's longest one; the others take turns, so no sound repeats in a row.
    key = f"{kit}:{kind}"
    take = takes[-1] if kind == "whoosh" and strength >= 1.15 else takes[turn.get(key, 0) % len(takes)]
    turn[key] = turn.get(key, 0) + 1
    audio = sound(take["id"], lufs=take["lufs"], semitones=take.get("semitones", 0), trim=take.get("trim"))
    return (faded(audio) if take.get("trim") else audio), 0, "cue"


track = Track(seconds=seconds, bpm=bpm)
music = plan["track"] in BEDS or bool(plan.get("file"))
if plan.get("file"):
    # The film's own track (`music.file`): the stretch of it the film plays over, from the moment the
    # plan starts on, at the film's volume. Any sound or video file: ffmpeg reads it.
    heard = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(plan["from"]), "-t", str(seconds), "-i", plan["file"], "-vn", "-ac", "2", "-ar", "48000", "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    bed = np.frombuffer(heard, np.float32).reshape(-1, 2).T
    track.add(bed, at=0, bus="music", gain_db=20 * math.log10(max(0.05, plan["volume"])))
elif music:
    BEDS[plan["track"]](track)
    for name in ("drums", "bass", "keys", "drone", "hits"):
        if name in track.buses:
            track.bus(name).gain(20 * math.log10(max(0.05, plan["volume"])))

# Fewer sounds, each heard. A cut used to play three at once (the whoosh into the scene, a tick
# as its first part lands, the hit of its word), and a list or a typed line a sound on every
# part: "a bit too many" to the ear. Where sounds fall closer than GAP only the one that matters
# most is played; keys of a typed line may follow one another faster, and give way to anything.
RANK = {"hit": 5, "shot": 5, "chime": 4, "whoosh": 3, "ping": 3, "glitch": 3, "sparkle": 2, "select": 2, "click": 2, "pop": 2, "tick": 1, "type": 0}
GAP = 0.22
KEYS = 0.11


def thinned(cues: list[dict]) -> list[dict]:
    kept: list[dict] = []
    order = sorted(cues, key=lambda c: (-RANK.get(c["kind"], 1), -c.get("strength", 1), c["t"]))
    for cue in order:
        if cue["kind"] == "riser":  # long, and before what it leads to: it is never in the way
            kept.append(cue)
            continue
        near = KEYS if cue["kind"] == "type" else GAP
        if all(other["kind"] == "riser" or abs(other["t"] - cue["t"]) >= (KEYS if other["kind"] == "type" and cue["kind"] == "type" else near) for other in kept):
            kept.append(cue)
    return sorted(kept, key=lambda c: c["t"])


for i, cue in enumerate(thinned(plan["cues"])):
    kind, at, strength = cue["kind"], cue["t"], cue.get("strength", 1)
    if kind == "tick" and strength < 1 and music:
        continue  # the quiet ticks are the beat's own under a track
    take = played(kind, i, strength, cue.get("kit"))
    if take is None:
        continue
    audio, base, sync = take
    # A riser ends as the end card lands, two beats after its cue.
    track.add(audio, at=at + 2 * B if kind == "riser" else at, sync=sync, bus="fx", gain_db=base + 20 * math.log10(max(0.2, min(1.5, strength))) + 20 * math.log10(cue.get("gain", 1)))
# The end card lands on the kit's own note.
ends = [scene for scene in plan["scenes"] if scene["type"] == "endcard"]
end = ends[-1] if ends else None
end_sound = end.get("sound", {}) if end else {}
logo_kind = end_sound.get("mapping", {}).get("logo", "logo")
logo = played(logo_kind, 0, 1, end_sound.get("kit")) if end and logo_kind and not end_sound.get("mute") and end_sound.get("gain", 1) > 0 else None
if logo:
    track.add(logo[0], at=end["start"], sync=logo[2], bus="fx", gain_db=logo[1] + 20 * math.log10(end_sound.get("gain", 1)))

# The voice-over: every take where its scene begins (`voice` of the plan: the kit has made each run of scenes as
# long as its line), on a bus of its own. The music gives way under it and the sounds of the picture a little,
# so no word is covered. A take is any sound file: ffmpeg reads it.
for line in plan.get("voice", []):
    said = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", line["file"], "-vn", "-ac", "2", "-ar", "48000", "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    track.add(np.frombuffer(said, np.float32).reshape(-1, 2).T.copy(), at=line["at"], bus="voice")
if plan.get("voice"):
    for name in ("music", "drums", "bass", "keys", "drone", "hits"):
        track.duck(name, by="voice", depth_db=-10, release=0.4)
    track.duck("fx", by="voice", depth_db=-4, release=0.25)

OUT.parent.mkdir(parents=True, exist_ok=True)
# The sounds of the picture alone keep their own level: brought up to -14 LUFS they would be loud clicks.
# A voice-over is brought to it, as every voice of the platform is.
track.mix(str(OUT), lufs=-14 if music or plan.get("voice") else None, fade_out=0.25)
# Which film this soundtrack was made for, and the file as it was made: the template's checks hold the film to
# the one and the track to the other (a voice mixed into it by hand is not this script's soundtrack).
made = {"film": plan["mark"], "sha256": hashlib.sha256(OUT.read_bytes()).hexdigest()}
OUT.with_suffix(".json").write_text(json.dumps(made) + "\n", encoding="utf-8")
