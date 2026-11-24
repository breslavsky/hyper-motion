"""Native recipe integration uses the published Orbs painter and local film clocks."""
import json
import subprocess

from tests.test_pure_kinetic import AUDIT, TEMPLATE


@AUDIT
def test_orbs_native_film_canvas_copy_and_independent_clocks(tmp_path):
    output = tmp_path / "orbs-native"
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/thinking-orbs-native.mjs"), "--out", str(output)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=600,
    )
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-4000:]
    report = json.loads((output / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert len(report["results"]) == report["total"] == 54
    assert all(row["parity"] and row["reverseExact"] for row in report["results"])
    assert len(report["groups"]) == 6
    assert all(group["disposal"] and all(group["independence"].values()) for group in report["groups"])
