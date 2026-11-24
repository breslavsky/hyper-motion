"""The Metal look keeps native text/layout while hosting deterministic material."""
import json
import subprocess

from tests.test_pure_kinetic import AUDIT, TEMPLATE


@AUDIT
def test_metal_native_variants_frames_and_independent_clocks(tmp_path):
    output = tmp_path / "metal-native"
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/metal-native.mjs"), "--out", str(output)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=600,
    )
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-4000:]
    report = json.loads((output / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert len(report["results"]) == report["total"] == 36
    assert {row["variant"] for row in report["results"]} == {"silver", "gold", "chromatic"}
    assert all(row["shaderReverseExact"] for row in report["results"])
    assert all(row["renderDifference"]["max"] <= 3 and row["renderDifference"]["share"] <= .0001
               for row in report["results"])
    assert len(report["groups"]) == 6
    assert all(all(group["lifecycle"].values()) for group in report["groups"])
