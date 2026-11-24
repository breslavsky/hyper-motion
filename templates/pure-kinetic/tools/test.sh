#!/usr/bin/env bash
# Every test of Pure Kinetic, run by hand. None of this runs in CI.
#
#   templates/pure-kinetic/tools/test.sh            everything
#   templates/pure-kinetic/tools/test.sh quick      what draws nothing in Chrome (the node suites, the compiler, the checks)
#   templates/pure-kinetic/tools/test.sh glass      the Glass family alone: its suites, native acceptances and Storybook checks
#   templates/pure-kinetic/tools/test.sh storybook  the component Storybook alone
#
# "everything" is long: the typewriter and the ellipsis matrices draw every
# case in Chrome and take tens of minutes each. What a run drew and measured
# is kept in data/qa/pure-kinetic/<time>/ (PURE_KINETIC_ARTIFACT_DIR names
# another folder). The script stops at the first part that fails.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
template="$root/templates/pure-kinetic"
storybook="$root/tools/component-storybook"
mode="${1:-all}"
cd "$root"

die() { echo "test.sh: $*" >&2; exit 1; }
part() { printf '\n== %s ==\n' "$*"; }

[ -x .venv/bin/python ] || die "no .venv: run 'uv sync --frozen'"
command -v node >/dev/null || die "node is not on PATH"
[ -d "$template/node_modules/.pnpm" ] || die "the template's packages are missing: in templates/pure-kinetic run '../../core/tools/node_modules/.bin/pnpm install --frozen-lockfile --store-dir /opt/motion-fab/data/pnpm-store'"

# Without this no pytest run collects Pure Kinetic's tests (tests/conftest.py).
export PURE_KINETIC_TESTS=1
export PURE_KINETIC_ARTIFACT_DIR="${PURE_KINETIC_ARTIFACT_DIR:-$root/data/qa/pure-kinetic/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$PURE_KINETIC_ARTIFACT_DIR"

pytest() { .venv/bin/python -m pytest -q "$@"; }

# The Storybook's own tests, then its browser checks against a built copy.
# Arguments: the browser checks to run, each one call of tests/browser.mjs
# ("" is the quick set) or a script of tests/ by name.
run_storybook() {
  [ -d "$storybook/node_modules" ] || die "the Storybook's packages are missing: in tools/component-storybook run 'npm ci'"
  (
    cd "$storybook"
    part "Storybook: model and visibility"
    npm test
    part "Storybook: build"
    npm run -s build
    port="$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
    export STORYBOOK_URL="http://127.0.0.1:$port"
    ./node_modules/.bin/vite preview --outDir storybook-static --host 127.0.0.1 --port "$port" --strictPort > test-server.log 2>&1 &
    server=$!
    trap 'kill "$server" 2>/dev/null || true' EXIT
    ready=""
    for _ in $(seq 1 100); do
      kill -0 "$server" 2>/dev/null || { cat test-server.log; exit 1; }
      if curl -fsS "$STORYBOOK_URL/index.json" > /dev/null 2>&1; then ready=1; break; fi
      sleep 0.2
    done
    [ "$ready" = 1 ] || { cat test-server.log; exit 1; }
    for check in "$@"; do
      case "$check" in
        *.mjs) part "Storybook: $check"; node "tests/$check" ;;
        "")    part "Storybook: browser, quick set"; node tests/browser.mjs ;;
        *)     part "Storybook: browser $check"; node tests/browser.mjs "$check" ;;
      esac
    done
  )
}

case "$mode" in
  quick)
    part "Compiler, checks and node suites (nothing drawn)"
    PURE_KINETIC_QUICK=1 pytest tests/test_pure_kinetic*.py
    ;;
  glass)
    part "Glass: node suites"
    (cd "$template" && node --test tools/glass.test.mjs tools/glass-timing.test.mjs tools/material.test.mjs tools/brand-material.test.mjs)
    part "Glass and Metal: native acceptances"
    pytest tests/test_pure_kinetic_glass.py tests/test_pure_kinetic_metal.py
    run_storybook --glass --metal ask-optics.mjs glass-backgrounds.mjs
    ;;
  storybook)
    run_storybook --all --glass --metal ask-optics.mjs glass-backgrounds.mjs
    ;;
  all)
    part "Pure Kinetic: every pytest test, with the picture audits"
    pytest tests/test_pure_kinetic*.py tests/test_thinking_orbs.py
    run_storybook --all --glass --metal ask-optics.mjs glass-backgrounds.mjs
    ;;
  *)
    die "unknown mode '$mode': use quick, glass, storybook or nothing for everything"
    ;;
esac

printf '\nAll passed. Evidence: %s\n' "$PURE_KINETIC_ARTIFACT_DIR"
