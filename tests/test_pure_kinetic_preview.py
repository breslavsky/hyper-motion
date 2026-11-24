"""A Pure Kinetic film is ready in the live preview at once (HISTORY 384).

The other native suites open a film as an export does. The preview serves the
page with the HyperFrames runtime and plays it, and that runtime plays a whole
film through, 60 steps a second, when a timeline tweens an accessor: it takes
it for one that may move the volume of the music.
"""
import json
import re
import subprocess

from tests.test_pure_kinetic import AUDIT, TEMPLATE

COMPONENTS = TEMPLATE / "source/lib/components"


def test_the_clocks_gsap_drives_are_functions():
    # Nothing drawn: the two clocks every film has, the scene's and the film's.
    for name in ("runtime.mjs", "presentation.mjs"):
        source = (COMPONENTS / name).read_text()
        clock = re.search(r"const clock=\{(.+?)\};\n", source).group(1)
        assert clock.startswith("time(value){"), f"{name}: {clock}"
        assert not re.search(r"\b[gs]et time\(", clock), f"{name}: the clock is an accessor again"
        assert ".to(clock,{time:" in source, name


def measured(*options):
    run = subprocess.run(
        ["node", str(TEMPLATE / "tools/preview-ready-native.mjs"), "--json", *options],
        cwd=TEMPLATE, capture_output=True, text=True, timeout=300,
    )
    assert run.returncode == 0, run.stdout[-4000:] + run.stderr[-4000:]
    return json.loads(run.stdout[: run.stdout.rindex("}") + 1])


@AUDIT
def test_a_metal_film_is_ready_in_the_live_preview():
    result = measured()
    assert result["failure"] is None and result["errors"] == []
    assert len(result["scenes"]) == 12
    # Mounted, and placed at the start: never once for every frame of the film.
    assert max(scene["draws"] for scene in result["scenes"].values()) <= 30
    assert result["readyMs"] < 5000
    assert sum(result["longTasks"]) < 3000


@AUDIT
def test_the_live_preview_draws_for_the_stream_and_an_export_for_the_frame():
    # The film is 1080x1920 and the stream 1280 on its long side: two thirds.
    glass = lambda result: next(scene for scene in result["scenes"].values() if scene["type"] == "search")  # noqa: E731
    live = measured("--play")
    assert glass(live)["canvases"][0] == "720x1280"  # the glass world; the button has a canvas of its own
    # Played, a scene draws the frames of the film's grid, 30 a second, though
    # the player moves its clock on every animation frame: a scene of 2.5 s and
    # its transitions is some 100 frames, never the 200 of every animation frame.
    scene = next(stat for id, stat in live["played"]["scenes"].items() if live["scenes"][id]["type"] == "search")
    assert 60 <= scene["draws"] <= 125, scene
    # Without the hint (an export, a snapshot, a check) nothing is reduced.
    assert glass(measured("--export"))["canvases"][0] == "1080x1920"
