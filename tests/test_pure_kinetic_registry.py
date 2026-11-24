"""Five real registry adaptations retain native data, geometry and timing contracts."""
from __future__ import annotations

import json
import shutil

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE, artifact_directory, native_audit_run

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")



@AUDIT
def test_design_camera_preserves_typography_and_control_proportions(tmp_path):
    out = artifact_directory(tmp_path, "design-camera")
    run = native_audit_run(
        ["node", str(TEMPLATE / "tools" / "design-system-native.mjs"), "--out", str(out / "camera")],
        out, cwd=TEMPLATE, timeout=600,
    )
    assert run.returncode == 0, run.stdout[-10000:] + run.stderr[-4000:]
    report = json.loads((out / "camera" / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["total"] == report["completed"] == 12
    assert all(report["negativeControls"][key] for key in [
        "roomDoesNotEnlarge", "tinyBoundsRejected", "copyPreserved", "boundedHeadingKeepsTokens", "invalidCapRejected",
    ])


@AUDIT
@pytest.mark.parametrize(("mode", "expected"), [([], 96), (["--avatars"], 24)], ids=["catalogue", "avatars"])
def test_registry_native_geometry_media_contrast_timing_and_aliases(tmp_path, mode, expected):
    out = artifact_directory(tmp_path, "registry-avatars" if mode else "registry-catalogue")
    run = native_audit_run(
        ["node", str(TEMPLATE / "tools" / "registry-native.mjs"), *mode, "--out", str(out / "registry")],
        out, cwd=TEMPLATE, timeout=1200,
    )
    assert run.returncode == 0, run.stdout[-10000:] + run.stderr[-4000:]
    report = json.loads((out / "registry" / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["total"] == report["completed"] == expected
    assert report["failedCases"] == 0
    assert report["registryWarnings"] == []
    assert all(report["calibration"][key] for key in ["opaqueCoverDetected", "overlapAllowanceRejected", "lowContrastRejected", "avatarShiftDetected"])
    assert report["calibration"]["avatarShift"]["dx"] >= 2
    assert all(row["reverseExact"] and row["semantic"] and row["audio"] and row["checkpoints"] for row in report["results"])
    assert all(row["design"]["typography"] and row["designFindings"] == [] for row in report["results"])
    if not mode:
        assert report["calibration"]["typeDriftDetected"]
        assert report["calibration"]["spacingDriftDetected"]
    assert all(row["independence"][key] for row in report["results"] for key in [
        "sameDefinition", "privateIds", "distinctContent", "firstUnchanged", "secondUnchanged", "firstRestored", "secondRestored",
    ])
    assert all(text["minimum"] >= 3 for row in report["results"] for text in row["contrast"])
    assert all(row["avatarCenter"]["vector"]["dx"] <= .03 and row["avatarCenter"]["vector"]["dy"] <= .03
               and row["avatarCenter"]["dx"] <= row["avatarCenter"]["rasterTolerance"]
               and row["avatarCenter"]["dy"] <= row["avatarCenter"]["rasterTolerance"]
               for row in report["results"] if row["type"] == "testimonial-proof-card" and row["copy"] == "normal")
