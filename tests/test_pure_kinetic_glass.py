"""Native liquid-glass cameras, projected text and independent world lifecycle."""
from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE, artifact_directory, native_audit_run

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


@AUDIT
@pytest.mark.parametrize("probe", ["glass-copy-focus-native", "send-prompt-chips-native", "send-prompt-wave-native"])
def test_glass_foreground_pixels(probe, tmp_path):
    out = artifact_directory(tmp_path, probe)
    run = native_audit_run(["node", str(TEMPLATE / "tools" / f"{probe}.mjs")], out, cwd=TEMPLATE, timeout=420)
    assert run.returncode == 0, run.stdout[-6000:] + run.stderr[-4000:]


@AUDIT
def test_glass_native_cameras_text_and_lifecycle(tmp_path):
    out = artifact_directory(tmp_path, "glass-native")
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/glass-native.mjs"), "--out", str(out)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=1200,
    )
    (out.parent / "glass-native.log").write_text(run.stdout + run.stderr)
    assert run.returncode == 0, run.stdout[-16000:] + run.stderr[-3000:]
    report = json.loads((out / "report.json").read_text())
    assert_glass_report(report)


def assert_glass_report(report):
    assert report["schema"] == "pure-kinetic.glass-native.v1"
    assert report["scope"] == "three-formats"
    assert report["passed"] and report["sourceStable"]
    assert report["sourceAfter"]["aggregate"] == report["testedSourceReceipt"]["aggregate"] == report["sourceReceipt"]["aggregate"]
    assert report["failed"] == 0
    expected = {(case, aspect) for case in ["island-static", "island-orbit-collapse", "lens-static", "lens-orbit",
                                            "ask-orbit-reply", "ask-static-prompt", "glass-send-prompt"]
                for aspect in ["16:9", "9:16", "1:1"]}
    assert report["completed"] == report["total"] == len(expected)
    assert {(row["case"], row["aspect"]) for row in report["results"]} == expected
    for row in report["results"]:
        assert row["passed"] and row["reverseExact"]
        assert len(row["samples"]) == 2
        for sample in row["samples"]:
            assert sample["projectionFindings"] == sample["layoutFindings"] == 0
            assert sample["renderDifference"]["max"] <= report["policy"]["renderMaxDelta"]
            assert sample["renderDifference"]["share"] <= report["policy"]["renderChangedShare"]
            if row["case"].startswith("lens-"):
                assert sample["lens"]["textureReady"]
                # Glass traces its lens in the slab shader.
                assert sample["lens"]["mechanism"] == "traced-slab"
        if row["case"] == "glass-send-prompt":
            pullback = row["pullback"]
            assert 0 < pullback["typingCount"] < pullback["typedCount"]
            assert pullback["closeWidth"] > pullback["landedWidth"] * 1.5
        if row["case"].startswith("lens-"):
            optics = row["optics"]
            assert optics["textureInkPixels"] > 100
            assert optics["changedInside"] > 100 and optics["changedOutside"] == 0
            assert optics["clearInk"] > 100 and optics["changedInk"] > 15
            assert optics["transmittedInk"] > 100
            assert optics["restoration"]["max"] <= report["policy"]["renderMaxDelta"]
            assert optics["restoration"]["share"] <= report["policy"]["renderChangedShare"]
        if not row["case"].startswith("lens-"):
            assert row["detachedTextRejected"]
    assert {group["aspect"] for group in report["groups"]} == {"16:9", "9:16", "1:1"}
    assert all(all(group["lifecycle"].values()) for group in report["groups"])
