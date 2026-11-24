"""Native ellipsis evidence: complete catalog scope, animated branches and canaries."""
from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE, artifact_directory

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


def test_ellipsis_native_suite_covers_every_declared_single_line_component():
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/ellipsis-suite-native.mjs"), "--list"],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=30,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    manifest = json.loads(run.stdout)
    scope = json.loads((TEMPLATE / "tools/ellipsis-scope.json").read_text())
    expected = {row["type"] for row in scope["components"] if row["policy"] != "preserved"}
    assert set(manifest["types"]) == expected
    assert manifest["aspects"] == ["9:16", "1:1", "16:9"]


@AUDIT
def test_native_ellipsis_catalog_branches_and_negative_controls(tmp_path):
    out = artifact_directory(tmp_path, "ellipsis")
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/ellipsis-suite-native.mjs"), "--out", str(out)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=5400,
    )
    (out.parent / "ellipsis.log").write_text(run.stdout + run.stderr)
    assert run.returncode == 0, run.stdout[-16000:] + run.stderr[-6000:]
    report = json.loads((out / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["sourceAfter"]["aggregate"] == report["sourceReceipt"]["aggregate"]
    assert report["completed"] == report["total"] == 8
    assert report["cases"] == 390
    assert report["comparison"]["kind"] == "same-source-native-build"
    assert report["comparison"]["historicalBeforeAfter"] is False
    assert {row["id"] for row in report["results"]} == {job["id"] for job in report["jobs"]}
    assert all(row["passed"] for row in report["results"])
    assert sum(row["pixelControls"] for row in report["results"]) == 2
    assert all((out / row["report"]).is_file() for row in report["results"])
