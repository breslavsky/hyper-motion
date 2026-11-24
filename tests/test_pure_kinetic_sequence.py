"""A directed sequence keeps native identity, responsive copy and event timing."""
from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")



@AUDIT
def test_native_directed_sequence_keeps_objects_legible_and_sounds_synchronized(tmp_path):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "sequence-probe.mjs"), "--out", str(tmp_path)],
        capture_output=True, text=True, timeout=900,
    )
    assert run.returncode == 0, run.stdout[-6000:] + run.stderr[-3000:]
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["schema"] == "pure-kinetic.document-flow.native.v2"
    assert report["total"] == report["completed"] == 18
    assert report["failedCases"] == 0
    assert report["sourceStable"] is True
    assert all(row["nativeAudioSynchronized"] for row in report["results"])
    assert all(row["occlusionSelfTest"]["passed"] for row in report["results"])
    assert all(not row["missingCopy"] for row in report["results"])
    assert all(row["createPayoff"]["passed"] for row in report["results"])
    assert all(row["createPayoff"]["applicable"] for row in report["results"] if row["copy"] == "normal")
    assert all(not sample["findings"] for row in report["results"] for sample in row["samples"])
    assert all(len(row["contrast"]) == 5 and row["minimumContrast"] >= 3 for row in report["results"])
    assert all(row["minimumRendered"] >= (39.1 if row["aspect"] == "9:16" else 35.5) for row in report["results"])
    assert all(len(row["reverse"]) == 5 and all(check["passed"] for check in row["reverse"]) for row in report["results"])


@AUDIT
def test_native_sequence_variables_preserve_precedence_and_reject_stale_audio(tmp_path):
    output = tmp_path / "variables"
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "sequence-variables.mjs"), "--out", str(output)],
        capture_output=True, text=True, timeout=300,
    )
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-3000:]
    report = json.loads((output / "report.json").read_text())
    assert report["schema"] == "document-flow-native-variables.v1"
    assert len(report["results"]) == 7
    assert all(row["passed"] for row in report["results"])
    assert all(row["actual"]["audioCurrent"] for row in report["results"])


@AUDIT
def test_native_sequence_instances_are_isolated_and_stale_audio_blocks_real_export(tmp_path):
    output = tmp_path / "contracts"
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "sequence-contracts.mjs"), "--out", str(output)],
        capture_output=True, text=True, timeout=300,
    )
    assert run.returncode == 0, run.stdout[-6000:] + run.stderr[-3000:]
    report = json.loads((output / "report.json").read_text())
    assert report["schema"] == "document-flow-native-contracts.v1"
    assert report["sourceStable"] is True
    assert report["passed"] is True
    rows = {row["id"]: row for row in report["results"]}
    assert len(rows) == 5
    assert all(row["passed"] for row in rows.values())
    assert rows["two-native-instances"]["sample"]["legacySingleton"] is False
    for name in ["stale-root", "stale-child"]:
        assert rows[name]["exitCode"] != 0
        assert rows[name]["exportExists"] is False
        assert rows[name]["hasStaleDiagnostic"] is True
    for name in ["rebuilt-events", "safe-copy"]:
        assert rows[name]["exitCode"] == 0
        assert rows[name]["exportExists"] is True


@AUDIT
def test_native_sequence_contrast_probe_rejects_explicit_invisible_ink(tmp_path):
    # An explicit bad foreground must stay explicit and fail the painted check.
    recipe = tmp_path / "low-contrast.json"
    recipe.write_text(json.dumps({"aspect": "1:1", "brand": {"foreground": "#0b0b0b"}}))
    output = tmp_path / "contrast"
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "sequence-probe.mjs"), "--recipe", str(recipe), "--out", str(output)],
        capture_output=True, text=True, timeout=180,
    )
    assert run.returncode == 1, run.stdout[-4000:] + run.stderr[-3000:]
    report = json.loads((output / "report.json").read_text())
    assert report["sourceStable"] is True
    assert report["completed"] == report["total"] == report["failedCases"] == 1
    result = report["results"][0]
    assert result["minimumContrast"] < 1.01
    assert any("contrast" in error for error in result["errors"])
