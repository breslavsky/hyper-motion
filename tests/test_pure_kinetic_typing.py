"""Per-key native regressions for the catalog's remaining typing mechanisms."""
from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE, artifact_directory

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


@AUDIT
@pytest.mark.parametrize("family,total", [("builtin", 27), ("motion", 18), ("ui", 42)])
def test_typed_copy_keeps_its_layout_through_every_key_and_reverse_seek(tmp_path, family, total):
    out = artifact_directory(tmp_path, f"typing-{family}")
    run = subprocess.run(
        ["node", str(TEMPLATE / f"tools/typing-{family}-native.mjs"), "--out", str(out)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=2400,
    )
    assert run.returncode == 0, run.stdout[-12000:] + run.stderr[-3000:]
    report = json.loads((out / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["completed"] == report["total"] == total
    assert report["failed"] == 0
    assert {row["aspect"] for row in report["results"]} == {"9:16", "1:1", "16:9"}
    for row in report["results"]:
        assert row["passed"] and row["reverseExact"]
        if family == "motion":
            assert row["keyCount"] > 0
            assert all(target["drifts"] == [] for target in row["targets"])
        else:
            assert row["findingCount"] == 0
            assert row["reverseWitnesses"] == row["sampleCount"] > 0
    if family == "builtin":
        assert report["negativeControls"]["shiftedVisibleUnitRejected"]
        assert report["negativeControls"]["restoredExact"]
    elif family == "ui":
        assert report["negativeControl"]["shiftedVisibleGlyphRejected"]
        assert report["negativeControl"]["restoredExact"]
        assert report["negativeControl"]["unwrittenInkRejected"]
        assert report["testedSourceReceipt"]["aggregate"] == report["sourceReceipt"]["aggregate"]
