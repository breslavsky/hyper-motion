"""Every catalog type participates in the same native design acceptance gate."""
from __future__ import annotations

import json
import shutil
import subprocess

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE, artifact_directory

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


def test_full_design_matrix_covers_every_catalog_type_in_all_formats():
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/catalog-design-native.mjs"), "--list"],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=60,
    )
    assert run.returncode == 0, run.stderr
    cases = json.loads(run.stdout)
    catalog = json.loads((TEMPLATE / "source/lib/components/catalog.json").read_text())
    assert len(cases) == len({row["id"] for row in cases}) == len(catalog) * 3
    assert {row["type"] for row in cases} == set(catalog)
    assert {row["mode"] for row in cases} == {"dom", "canvas", "webgl"}
    for name in catalog:
        assert {row["aspect"] for row in cases if row["type"] == name} == {"9:16", "1:1", "16:9"}
    assert all(row["scene"]["type"] == row["type"] for row in cases)


@AUDIT
def test_surface_audit_rejects_real_css_mutations_with_unchanged_metadata(tmp_path):
    out = artifact_directory(tmp_path, "surfaces")
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/surface-design-native.mjs"), "--out", str(out)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=600,
    )
    assert run.returncode == 0, run.stdout[-12000:] + run.stderr[-3000:]
    report = json.loads((out / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["total"] == report["completed"] == 6
    assert report["failed"] == 0
    for row in report["results"]:
        assert row["staticCenteringPreserved"] and row["uniqueSurfaceIds"]
        assert len(row["negativeControls"]) >= 12
        assert all(control["metadataUnchanged"] and control["restoredExact"]
                   for control in row["negativeControls"])


@AUDIT
def test_full_catalog_native_design_geometry_and_seek_contract(tmp_path):
    out = artifact_directory(tmp_path, "catalog-design")
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/catalog-design-native.mjs"), "--out", str(out)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=3600,
    )
    assert run.returncode == 0, run.stdout[-12000:] + run.stderr[-3000:]
    report = json.loads((out / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    catalog = json.loads((TEMPLATE / "source/lib/components/catalog.json").read_text())
    expected = {(name, aspect) for name in catalog for aspect in ("9:16", "1:1", "16:9")}
    assert report["total"] == report["completed"] == len(report["results"]) == len(catalog) * 3
    assert {(row["type"], row["aspect"]) for row in report["results"]} == expected
    assert report["failed"] == 0
    for row in report["results"]:
        assert row["reverseExact"]
        assert row["designFindings"] == row["surfaceFindings"] == row["layoutFindings"] == row["uncovered"] == []
        assert len(row["frames"]) == 5
        assert (out / row["image"]).stat().st_size > 0


@AUDIT
def test_paged_catalog_content_is_visible_and_repeatable(tmp_path):
    out = artifact_directory(tmp_path, "visible-content")
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/catalog-design-content.mjs"), "--out", str(out)],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=1200,
    )
    assert run.returncode == 0, run.stdout[-12000:] + run.stderr[-3000:]
    report = json.loads((out / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["completed"] == report["total"] == 21
    assert report["failed"] == 0
    for row in report["results"]:
        assert row["reverseExact"] and row["reverseWitnesses"] > 0
        assert row["missing"] == []
        assert all(target["longestSpan"] >= report["minimumSpan"] for target in row["targets"])


@AUDIT
def test_typewriter_keeps_typed_glyphs_in_place_at_every_key(tmp_path):
    out = artifact_directory(tmp_path, "typewriter-layout")
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/typewriter-layout-native.mjs"), "--out", str(out)],
        # The every-key matrix takes about 27 minutes on the reference machine.
        # Keep a bounded margin below the isolated CI job's 50-minute script cap.
        cwd=TEMPLATE, capture_output=True, text=True, timeout=2700,
    )
    assert run.returncode == 0, run.stdout[-12000:] + run.stderr[-3000:]
    report = json.loads((out / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["completed"] == report["total"] == 84
    assert report["failed"] == 0
    assert {row["aspect"] for row in report["results"]} == {"9:16", "1:1", "16:9"}
    for row in report["results"]:
        assert row["findingCount"] == 0
        assert row["reverseExact"] and row["reverseWitnesses"] == row["sampleCount"]
        assert row["maximumGlyphDrift"] <= report["policy"]["tolerance"]
