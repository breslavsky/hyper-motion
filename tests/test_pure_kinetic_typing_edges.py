"""Native bidi and terminal-newline regressions use an independent text-node oracle."""
from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE, artifact_directory

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


@AUDIT
def test_typing_edges_keep_rtl_and_terminal_newlines_stable(tmp_path):
    out = artifact_directory(tmp_path, "typing-edges")
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/typing-edge-native.mjs"), "--out", str(out)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=1200,
    )
    (out.parent / "typing-edges.log").write_text(run.stdout + run.stderr)
    assert run.returncode == 0, run.stdout[-16000:] + run.stderr[-3000:]
    report = json.loads((out / "report.json").read_text())
    assert_typing_edge_report(report)


def assert_typing_edge_report(report):
    assert report["schema"] == "pure-kinetic.typing-edge-native.v1"
    assert report["passed"] and report["sourceStable"]
    assert report["sourceAfter"]["aggregate"] == report["testedSourceReceipt"]["aggregate"] == report["sourceReceipt"]["aggregate"]
    assert report["completed"] == report["total"] == 12
    assert report["failed"] == 0
    expected = {(case, aspect) for case in ["arabic-mixed", "hebrew-mixed", "newline-short", "newline-wrap"]
                for aspect in ["9:16", "1:1", "16:9"]}
    assert {(row["case"], row["aspect"]) for row in report["results"]} == expected
    assert len(report["results"]) == len(expected)
    for row in report["results"]:
        assert row["passed"] and row["fullCopyExact"] and row["audioEventsExact"]
        assert row["findingCount"] == 0
        assert row["maximumGlyphDrift"] <= report["policy"]["tolerance"]
        assert row["reverseExact"] and row["reverseWitnesses"] == row["sampleCount"] > 0
        assert row["negativeControls"]["misplacedCaretRejected"]
        assert row["negativeControls"]["restoredExact"]
        if row["case"].startswith("newline-"):
            assert row["text"].endswith("\n")
            assert row["negativeControls"]["missingTerminalLineRejected"]
