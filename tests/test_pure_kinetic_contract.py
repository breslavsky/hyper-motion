"""Writer-facing regressions found by real DeepSeek quality runs.

Do not silently drop supplied art direction; give a musical duration budget
and resolved facts a text-only writer can compare with the brief.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FILM = ROOT / "kit/source/lib/film.cjs"
pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


def call(function: str, film: dict):
    run = subprocess.run(
        ["node", "-e", "const F=require(process.argv[1]),f=JSON.parse(process.argv[2]);"
         f"console.log(JSON.stringify({function}))", str(FILM), json.dumps(film)],
        text=True, capture_output=True, check=True, timeout=30,
    )
    return json.loads(run.stdout)


def recipe():
    return {
        "aspect": "1:1", "style": "mono", "pace": "normal", "seconds": 8,
        "brand": {"name": "Kin", "font": "Geist"}, "music": {"bpm": 108},
        "scenes": [
            {"type": "letterflip", "beats": 3, "text": "One thing at a time"},
            {"type": "polar", "beats": 5, "label": "Make room to focus"},
            {"type": "endcard", "beats": 6, "cta": "Start a focus session"},
        ],
    }


def test_unknown_background_is_an_error_with_a_preserving_repair():
    film = recipe()
    film["bg"] = "#101828"
    errors = call("F.problems(f)", film)
    assert len(errors) == 1
    assert 'has no field "bg"' in errors[0]
    assert "brand.tokens.background" in errors[0]
    assert "preserve the requested colour" in errors[0]


@pytest.mark.parametrize("tokens", [None, [], {"backround": "#123456"}, {"accent": "red"}, {"accent": "#1234"}, {"accent": 123}])
def test_malformed_brand_roles_cannot_silently_change_art_direction(tokens):
    film = recipe()
    film["brand"]["tokens"] = tokens
    assert any("brand.tokens" in error for error in call("F.problems(f)", film))


def test_exact_roles_and_resolved_review_are_the_same_as_the_render_plan():
    film = recipe()
    film["brand"]["tokens"] = {"background": "#101828", "foreground": "#f7f7f2", "accent": "#b9f24a"}
    assert call("F.problems(f)", film) == []
    result = call("F.review(f,F.planOf(f))", film)
    assert result["requestedSeconds"] == 8
    assert result["duration"] == pytest.approx(8.056, abs=.001)
    assert result["font"] == "Geist"
    assert all(scene["background"] == "#101828" for scene in result["scenes"])
    assert all(scene["foreground"] == "#f7f7f2" for scene in result["scenes"])
    assert all(scene["accent"] == "#b9f24a" for scene in result["scenes"])
    assert result["scenes"][-1]["settledHoldSeconds"] >= 2
    assert result["scenes"][0]["words"] == ["One thing at a time"]


def test_a_length_a_beat_off_is_shared_out_and_one_out_of_reach_is_repaired_in_scenes():
    film = recipe()
    film["scenes"][-1]["beats"] = 7
    assert call("F.problems(f)", film) == []
    film["seconds"] = 20
    errors = call("F.problems(f)", film)
    assert len(errors) == 1
    assert "add about 4 scenes" in errors[0] and "Leave the beats as they are" in errors[0]


def test_review_omits_geometry_names_and_sound_controls_from_visible_copy():
    film = recipe()
    film["scenes"][1].update(shapes=["circle", "star"], sound={"kit": "tech", "mapping": {"tick": "click"}})
    result = call("F.review(f,F.planOf(f))", film)
    assert result["scenes"][1]["words"] == ["Make room to focus"]


def test_colour_panel_changes_exact_tokens_and_can_restore_the_looks_palette():
    film = recipe()
    film["brand"]["tokens"] = {"background": "#101828", "accent": "#b9f24a", "accent2": "#aabbcc"}
    changed = call("F.changed(f,{colors:['#FF6A70']})", film)["film"]
    assert changed["brand"]["tokens"] == {"background": "#101828", "accent": "#ff6a70"}
    result = call("F.review(f,F.planOf(f))", changed)
    assert all(scene["accent"] == "#ff6a70" for scene in result["scenes"])
    restored = call("F.changed(f,{palette:'look'})", changed)["film"]
    assert "tokens" not in restored["brand"] and "palette" not in restored
    assert len({scene["background"] for scene in call("F.review(f,F.planOf(f))", restored)["scenes"]}) > 1
