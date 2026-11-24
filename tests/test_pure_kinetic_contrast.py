"""Text must contrast with composited glass and gradients, not only palette tokens."""
from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


@AUDIT
@pytest.mark.parametrize("look", ["editorial", "noir"])
def test_native_text_contrasts_with_actual_material_pixels(tmp_path, look):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "quality-contrast.mjs"), "--look", look,
         "--fractions", ".4,.5,.6,.7,.8,.9", "--out", str(tmp_path)],
        capture_output=True, text=True, timeout=300,
    )
    assert run.returncode == 0, run.stdout[-5000:] + run.stderr[-2000:]
    report = json.loads((tmp_path / "report.json").read_text())
    assert len(report["results"]) == 9
    for row in report["results"]:
        assert row["minimum"] >= 3
        assert row["failures"] == []
        assert row["surfaceForeground"] == row["review"]["surfaceForeground"]


@AUDIT
def test_explicit_low_contrast_foreground_is_preserved_and_reported(tmp_path):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "quality-contrast.mjs"), "--scenes", "winner,tabs,endcard",
         "--aspects", "9:16", "--foreground", "#ffffff", "--out", str(tmp_path)],
        capture_output=True, text=True, timeout=180,
    )
    assert run.returncode == 1, run.stdout[-3000:] + run.stderr[-2000:]
    report = json.loads((tmp_path / "report.json").read_text())
    assert len(report["results"]) == 3
    for row in report["results"]:
        assert row["surfaceForeground"] == row["review"]["surfaceForeground"] == "#ffffff"
        assert row["failures"] and row["minimum"] < 3
        assert all(failure["foreground"][:3] == [255, 255, 255] for failure in row["failures"])



@AUDIT
def test_native_coral_logo_and_button_keep_contrast_during_hold_and_shine(tmp_path):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "quality-on-accent.mjs"), "--out", str(tmp_path)],
        capture_output=True, text=True, timeout=180,
    )
    assert run.returncode == 0, run.stdout[-3000:] + run.stderr[-2000:]
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["kind"] == "native-regression"
    assert len(report["results"]) == 3
    assert all(row["minimum"] >= 3 for row in report["results"])


@AUDIT
def test_native_sky_uses_readable_implicit_ink_and_preserves_explicit_overrides(tmp_path):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "quality-sky-contrast.mjs"), "--out", str(tmp_path)],
        capture_output=True, text=True, timeout=300,
    )
    assert run.returncode == 0, run.stdout[-5000:] + run.stderr[-2000:]
    report = json.loads((tmp_path / "report.json").read_text())
    assert len(report["results"]) == 30
    for row in report["results"]:
        implicit = row["label"].startswith("default-") or row["label"] == "native-brand-removed"
        assert row["minimum"] >= 3 if implicit else row["minimum"] < 3
        if row["label"].startswith("default-"):
            assert row["review"]["foreground"] == row["planned"]["fg"] == "#ffffff"
            assert row["review"]["surfaceForeground"] == "#111111"
