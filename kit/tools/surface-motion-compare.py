#!/usr/bin/env python3
"""Verify six native renders, then build synchronized, uncropped comparisons.

python3 tools/surface-motion-compare.py --media-dir /path/to/media --source-receipt /path/to/receipt.json
Requires ffmpeg/ffprobe; uses only the Python standard library.
The receipt must provide sourceHashes.before/after and files.<original.mp4>.sha256
for all six inputs. beforeRevision/afterRevision are optional source references.
The historical tools/surface-motion-acceptance.json already has these fields.
"""

import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path
import subprocess
import sys


TOOLS = Path(__file__).resolve().parent
FORMATS = [
    ("9:16", "9x16", (1080, 1920), (540, 960), "hstack"),
    ("1:1", "1x1", (1080, 1080), (720, 720), "hstack"),
    ("16:9", "16x9", (1920, 1080), (1280, 720), "vstack"),
]
HEADER = 56


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_source_identity(path, originals):
    """Bind declared render sources to these exact originals, never a default."""
    data = json.loads(path.read_text())
    source_hashes = data.get("sourceHashes", {})
    for version in ("before", "after"):
        value = source_hashes.get(version)
        require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value),
                f"{path.name}: sourceHashes.{version} must be a full SHA256")
    for original in originals:
        expected = data.get("files", {}).get(original.name, {}).get("sha256")
        require(isinstance(expected, str) and re.fullmatch(r"[0-9a-f]{64}", expected),
                f"{path.name}: missing SHA256 binding for {original.name}")
        require(sha256(original) == expected,
                f"{original.name}: source receipt media hash mismatch; use the receipt for these renders")
    revisions = {}
    for version in ("before", "after"):
        value = data.get(f"{version}Revision")
        if value is not None:
            require(isinstance(value, str) and value.strip(), f"{path.name}: invalid {version}Revision")
            revisions[version] = value
    return {"sourceHashes": {version: source_hashes[version] for version in ("before", "after")},
            "sourceRevisions": revisions, "sourceReceiptSha256": sha256(path),
            "sourceReceiptFile": path.name, "originalMediaHashesVerified": True}


def run(args, receipt, stderr=False):
    result = subprocess.run([str(arg) for arg in args], capture_output=True, text=True)
    receipt["commands"].append({"argv": [str(arg) for arg in args], "exitCode": result.returncode})
    if result.returncode:
        raise RuntimeError(f"{args[0]} failed ({result.returncode}): {result.stderr.strip()}")
    return result.stderr if stderr else result.stdout


def inspect_media(path, dimensions, receipt):
    probe = json.loads(run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", path,
    ], receipt))
    video = [stream for stream in probe["streams"] if stream["codec_type"] == "video"]
    audio = [stream for stream in probe["streams"] if stream["codec_type"] == "audio"]
    require(len(video) == 1 and len(audio) == 1,
            f"{path.name}: expected exactly one video and one audio stream")
    video, audio = video[0], audio[0]
    require((video["width"], video["height"]) == dimensions,
            f"{path.name}: wrong dimensions, expected {dimensions}")
    require(Fraction(video["avg_frame_rate"]) == 30 and Fraction(video["r_frame_rate"]) == 30,
            f"{path.name}: expected constant 30 fps")
    require(video.get("sample_aspect_ratio", "1:1") in ("1:1", "N/A"),
            f"{path.name}: expected square pixels")
    require(abs(float(video.get("start_time", 0))) < 1 / 30000,
            f"{path.name}: video must start at zero")
    frames = int(video["nb_read_frames"])
    require(frames > 0, f"{path.name}: no decoded frames")
    duration = float(video["duration"])
    require(abs(duration - frames / 30) < 0.001,
            f"{path.name}: duration does not match its 30 fps frame count")
    run([
        "ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-xerror",
        "-err_detect", "explode", "-i", path, "-map", "0:v:0", "-map", "0:a:0",
        "-f", "null", "-",
    ], receipt)
    # Hash decoded samples rather than AAC packets/container metadata. Do not
    # resample or remix: stream rate/channel equality is checked separately.
    audio_hash = run([
        "ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-xerror",
        "-i", path, "-map", "0:a:0", "-vn", "-c:a", "pcm_s32le",
        "-f", "hash", "-hash", "sha256", "-",
    ], receipt).strip()
    require(audio_hash.startswith("SHA256="), f"{path.name}: invalid decoded audio hash")
    result = {
        "file": path.name, "sha256": sha256(path), "bytes": path.stat().st_size,
        "width": video["width"], "height": video["height"], "fps": 30,
        "frames": frames, "duration": duration, "fullDecodePassed": True,
        "audio": {
            "streams": 1, "sampleRate": int(audio["sample_rate"]),
            "channels": audio["channels"], "duration": float(audio["duration"]),
            "startTime": float(audio.get("start_time", 0)),
            "decodedPcmFormat": "s32le", "decodedPcmSha256": audio_hash.split("=", 1)[1],
        },
        "ffprobe": probe,
    }
    receipt["media"][path.name] = result
    return result


def same_timing_and_audio(before, after):
    label = f"{before['file']} / {after['file']}"
    require(before["frames"] == after["frames"], f"{label}: unequal frame counts")
    require(abs(before["duration"] - after["duration"]) < 0.001, f"{label}: unequal durations")
    require(before["audio"] == after["audio"], f"{label}: decoded audio or audio timing differs")


def filter_path(path):
    # ffmpeg filter syntax escaping; subprocess itself never invokes a shell.
    return str(path).replace("\\", "\\\\").replace("'", "'\\''").replace(":", "\\:")


def compare(before, after, output, pane, stack, font, receipt):
    width, height = pane
    filters = []
    for index, title in enumerate(("До", "После")):
        filters.append(
            f"[{index}:v:0]scale={width}:{height}:flags=lanczos,setsar=1,"
            f"pad={width}:{height + HEADER}:0:{HEADER}:color=0x0b1118,"
            f"drawtext=fontfile='{filter_path(font)}':text='{title}':"
            f"fontcolor=0xf2f5f7:fontsize=26:x=(w-text_w)/2:y=({HEADER}-text_h)/2[p{index}]"
        )
    filters.append(f"[p0][p1]{stack}=inputs=2[v]")
    run([
        "ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-xerror", "-y",
        "-i", before, "-i", after, "-filter_complex", ";".join(filters),
        "-map", "[v]", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium",
        "-crf", "18", "-pix_fmt", "yuv420p", "-fps_mode", "passthrough",
        "-c:a", "copy", "-movflags", "+faststart", "-threads", "4", output,
    ], receipt)
    return (width * 2, height + HEADER) if stack == "hstack" else (width, (height + HEADER) * 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--media-dir", type=Path, required=True)
    parser.add_argument("--source-receipt", type=Path, required=True,
                        help="Explicit render source hashes bound to all six original MP4 hashes")
    parser.add_argument("--chapters", type=Path, default=TOOLS / "surface-motion-demo.chapters.json")
    parser.add_argument("--font", type=Path, default=Path("/System/Library/Fonts/Supplemental/Arial.ttf"))
    args = parser.parse_args()
    media = args.media_dir.resolve()
    originals = [media / f"{version}-{tag}.mp4" for _, tag, _, _, _ in FORMATS for version in ("before", "after")]
    # Check the entire input set before invoking any decoder or creating outputs.
    missing = [str(path) for path in originals if not path.is_file() or not path.stat().st_size]
    require(not missing, "All six native renders must exist before starting; missing: " + ", ".join(missing))
    require(args.font.is_file(), f"Label font not found: {args.font}; supply --font /path/to/font.ttf")
    chapters = json.loads(args.chapters.read_text())
    identity = load_source_identity(args.source_receipt, originals)
    receipt = {
        "schema": "pure-kinetic.surface-motion-integrity.v1", "passed": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        **identity,
        "sourceHashProvenance": "Explicit source receipt, bound to all six original media hashes. Source identities are declared, not inferred from video pixels.",
        "chapterFileSha256": sha256(args.chapters), "commands": [], "media": {}, "pairs": [],
    }
    receipt_path = media / "media-integrity.json"
    manifest = {
        "title": "До и после — в движении", "sceneCount": len(chapters["chapters"]),
        "description": "8 выбранных сцен: карточки, поля, бейджи и печать текста. Одинаковый сценарий и звук в трёх форматах, без музыки.",
        "defaultAspect": "16:9", **identity, "integrityReceipt": receipt_path.name,
        "formats": [],
    }
    try:
        receipt["ffmpegVersion"] = run(["ffmpeg", "-version"], receipt).splitlines()[0]
        receipt["ffprobeVersion"] = run(["ffprobe", "-version"], receipt).splitlines()[0]
        expected_frames = math.ceil(chapters["duration"] * 30)
        # Verify all originals before creating comparisons. Any mismatch fails
        # the job instead of hiding it with trimming, retiming or mixed audio.
        for aspect, tag, size, _pane, _stack in FORMATS:
            print(f"Verifying originals {aspect}", flush=True)
            before = inspect_media(media / f"before-{tag}.mp4", size, receipt)
            after = inspect_media(media / f"after-{tag}.mp4", size, receipt)
            same_timing_and_audio(before, after)
            require(abs(after["frames"] - expected_frames) <= 1,
                    f"{tag}: duration differs from compiled chapters by more than one frame")
            receipt["pairs"].append({"aspect": aspect, "nativeFrames": after["frames"], "decodedAudioIdentical": True})
            write_json(receipt_path, receipt)
        require(len({pair["nativeFrames"] for pair in receipt["pairs"]}) == 1,
                "The three native formats have unequal frame counts")
        volume_log = run([
            "ffmpeg", "-hide_banner", "-nostdin", "-v", "info", "-i", media / "after-9x16.mp4",
            "-map", "0:a:0", "-vn", "-af", "volumedetect", "-f", "null", "-",
        ], receipt, stderr=True)
        levels = dict(re.findall(r"\b(mean_volume|max_volume):\s*(-?[\d.]+|-?inf) dB", volume_log))
        require("mean_volume" in levels and "max_volume" in levels, "Audio level measurement is missing")
        receipt["audioLevels"] = {
            "file": "after-9x16.mp4", "method": "ffmpeg volumedetect (signed 16-bit samples)",
            "meanRmsDbfs": levels["mean_volume"], "peakDbfs": levels["max_volume"],
        }
        for aspect, tag, _size, pane, stack in FORMATS:
            print(f"Building comparison {aspect}", flush=True)
            before, after = media / f"before-{tag}.mp4", media / f"after-{tag}.mp4"
            output = media / f"compare-{tag}.mp4"
            dimensions = compare(before, after, output, pane, stack, args.font.resolve(), receipt)
            comparison = inspect_media(output, dimensions, receipt)
            same_timing_and_audio(receipt["media"][after.name], comparison)
            poster = media / f"poster-{tag}.jpg"
            run([
                "ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-xerror", "-y",
                "-i", output, "-ss", "2.5", "-frames:v", "1", "-q:v", "2", poster,
            ], receipt)
            receipt["media"][poster.name] = {"sha256": sha256(poster), "time": 2.5}
            manifest["formats"].append({
                "aspect": aspect, "duration": comparison["duration"],
                "before": before.name, "after": after.name, "comparison": output.name, "poster": poster.name,
                # A beat boundary may fall between encoded frames. Seeking to
                # that exact time displays the preceding scene's last frame;
                # start each chapter on its first actual 30 fps frame instead.
                "chapters": [{"time": math.ceil(chapter["start"] * 30) / 30,
                              "authoredTime": chapter["start"], "label": chapter["title"],
                              "type": chapter["type"]} for chapter in chapters["chapters"]],
            })
            write_json(receipt_path, receipt)
        receipt["passed"] = True
        receipt["comparisonPolicy"] = {"crop": False, "retime": False, "audio": "after stream copied exactly once", "labels": "outside source panes", "headerPixels": HEADER}
        write_json(receipt_path, receipt)
        write_json(media / "manifest.json", manifest)
        print(json.dumps({"passed": True, "manifest": str(media / "manifest.json"), "receipt": str(receipt_path)}, indent=2))
    except Exception as error:
        receipt["error"] = str(error)
        write_json(receipt_path, receipt)
        raise


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        print(f"Comparison failed: {error}", file=sys.stderr)
        sys.exit(1)
