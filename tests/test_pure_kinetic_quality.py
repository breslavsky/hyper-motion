"""Rendered typography must survive native cameras, fonts and repeated components."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from tests.test_pure_kinetic import AUDIT, TEMPLATE, artifact_directory, native_audit_run

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


def test_reflowed_components_accept_full_written_bounds_for_non_latin_copy():
    script = """
const assert=require('node:assert/strict'),F=require(process.argv[1]);
const film={aspect:'16:9',style:'editorial',brand:{name:'Nook'},scenes:[
  {type:'between',beats:6,lead:'Ш'.repeat(16),words:['Ш'.repeat(20)]},
  {type:'flip',beats:6,lead:'Ш'.repeat(18),words:['Ш'.repeat(18)]}
]};
assert.deepEqual(F.problems(film),[]);
film.scenes[0].lead+='Ш';film.scenes[1].words[0]+='Ш';
const problems=F.problems(film);
assert.ok(problems.some(p=>p.includes('lead')&&p.includes('at most 16')));
assert.ok(problems.some(p=>p.includes('words[0]')&&p.includes('at most 18')));
"""
    run = subprocess.run(["node", "-e", script, str(TEMPLATE / "source" / "lib" / "film.cjs")], capture_output=True, text=True, timeout=60)
    assert run.returncode == 0, run.stdout[-2000:] + run.stderr[-2000:]


@AUDIT
def test_native_font_families_use_the_bundled_glyphs_for_each_script(tmp_path):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "quality-fonts.mjs"), "--out", str(tmp_path)],
        capture_output=True, text=True, timeout=120,
    )
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-2000:]
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["completed"] == report["total"] == 21
    assert report["failedCases"] == 0


@AUDIT
def test_native_cards_reflow_at_the_rendered_font_floor_in_all_formats(tmp_path):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "quality-cards.mjs"), "--out", str(tmp_path)],
        capture_output=True, text=True, timeout=600,
    )
    assert run.returncode == 0, run.stdout[-6000:] + run.stderr[-2000:]
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["completed"] == report["total"] == 42
    assert report["failedCases"] == 0
    assert all(row["reverseExact"] for row in report["results"])


@AUDIT
def test_native_long_copy_preserves_readable_type_and_safe_glyph_bounds(tmp_path):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools" / "quality-layout.mjs"), "--scenes", "between,arc,slam,icon3d,scatter,flip", "--out", str(tmp_path)],
        capture_output=True, text=True, timeout=300,
    )
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-2000:]
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["completed"] == report["total"] == 18
    assert report["failedCases"] == 0


@AUDIT
def test_native_wide_copy_supports_the_removed_historical_limits(tmp_path: Path):
    out = artifact_directory(tmp_path, "quality-wide-copy")
    run = native_audit_run(
        ["node", str(TEMPLATE / "tools" / "quality-wide-copy.mjs"), "--out", str(out)],
        out, timeout=300,
    )
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-2000:]
    report = json.loads((out / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["sourceAfter"]["aggregate"] == report["sourceReceipt"]["aggregate"]
    assert report["completed"] == report["total"] == 48
    assert report["failedCases"] == 0
    assert all(row["reverseExact"] for row in report["results"])


@AUDIT
def test_native_append_mask_contains_real_font_metrics_for_every_word(tmp_path: Path):
    out = artifact_directory(tmp_path, "quality-append")
    run = native_audit_run(
        ["node", str(TEMPLATE / "tools" / "quality-append.mjs"), "--out", str(out)],
        out, timeout=300,
    )
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-2000:]
    report = json.loads((out / "report.json").read_text())
    assert report["passed"] and report["sourceStable"]
    assert report["completed"] == report["total"] == 18
    assert report["failedCases"] == 0
    assert all(row["reverseExact"] for row in report["results"])
