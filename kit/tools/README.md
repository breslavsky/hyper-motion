# Pure Kinetic development tools

Only `source/` is the renderable template. Its `lib/compiler/` compiles recipe
data and `lib/components/` contains native HyperFrames components. There is no
whole-film engine in the shipped source. Some development tools retain their
`migration-*` names because they first verified that boundary; they still test
the current components and are not a second playback path.

## Current maintenance

Start with the [maintained test entrypoints](#maintained-test-entrypoints) below.
Historical acceptance documents and JSON receipts retain their tested source and
scope; a later source edit does not make their results current again.

- `checks.py` checks a saved project's recipe, compiled page and soundtrack.
  Its older-page branches preserve saved-project compatibility.
- `audit.mjs`, `sheet.mjs` and the native probes use `migration-browser.mjs`
  to compile and seek the pinned native HyperFrames project. See
  `migration-README.md` for commands and receipt policy.
- `technique.py` searches the public technique library, creates native stubs
  and records accepted provenance. Downloaded examples in `techniques/` are
  ignored research inputs, not source files to ship.
- `kinetic/guide.py` regenerates `AGENTS.md` and `source/lib/beats.json` from
  the maintained catalogue. `kinetic/scene-library.txt` supplies the original
  descriptions and component metadata supplies the added definitions.
- `sync-thinking-orbs.cjs` copies only the canonical Thinking Orbs adapter,
  engine, package marker and MIT provenance into portable template source.
  Edit `components/thinking-orbs`, then run this tool;
  `thinking-orbs.test.mjs` checks byte identity, schemas, selection guidance
  and native catalogue resolution. The upstream golden vectors stay outside
  renderable source. `thinking-orbs-native.mjs` checks the actual native scenes.
- `sync-metal.cjs` copies the canonical liquid-metal renderer, original shader
  and presets, source receipts and MIT/Apache notices. `metal-theme.test.mjs`
  checks theme/variant compilation and selection guidance;
  `metal-material.test.mjs` checks portable source and native style boundaries.
  `metal-native.mjs --out /fresh/directory` verifies all three finishes on
  title/card/CTA scenes in three formats and light/dark backgrounds, including
  byte-identical material pixels after reverse seeks, rendered frames within
  two antialiasing quantization steps on at most .01% of channels, and
  independent disposal.
  The canonical runtime's `tools/verify.mjs` compares directly with the pinned
  upstream renderer; it does not approximate the shader with CSS gradients.
- `sync-component-metadata.cjs`, `sync-typewriter-timing.cjs` and
  `sync-brand-tokens.cjs` generate the
  browser ESM counterparts of canonical CJS data/functions. The Node compiler
  and browser need different module formats; these checked pairs are not
  duplicate independently maintained implementations. Catalogue JSON/ESM
  equality is also checked by `migration-components.test.mjs`.
- `quality-layout.mjs` measures actual post-transform glyph ranges, readable
  font size, clipping, safe areas and persistent overlap. `quality-cards.mjs`
  covers repeated card/endcard instances, native fonts, sound and reverse seeks.
  `quality-fonts.mjs` compares actual glyph metrics before and after native
  bundling. `quality-contrast.mjs` samples composited pixels beneath text so
  translucent surfaces and gradients cannot pass on palette metadata alone.
  `quality-append.mjs` checks every rolling word's complete font line box,
  readable ink bounds and reverse seeks with sample and maximum copy.
  `quality-on-accent.mjs` checks contrasting logo/button ink and moving shine;
  `quality-sky-contrast.mjs` checks implicit sky ink and explicit/native overrides.
- `brand-tokens.test.mjs` covers exact semantic brand colours;
  `migration-brand-tokens.mjs` verifies them in native hosts after variable edits.
  `migration-code-pages.mjs` checks readable code pages, preservation of every
  supplied line and deterministic reverse seeks across all three formats.
- `sequence-probe.mjs` checks the separate Document Flow production with three
  brands, normal/long copy and three formats. `sequence-variables.mjs` checks
  seven native root/child override cases, including explicit reset precedence
  and safe copy edits. `sequence-contracts.mjs` mounts the same graphics file
  twice, verifies independent identities/clocks/audio, reverse seeks and disposal,
  then runs the actual default native CLI: stale root/child semantic edits must
  fail without an MP4; a rebuilt recipe and safe copy-only edit must export.
  It records commands, exit codes, diagnostics, output hashes and unchanged source
  fingerprints. Use `--out /fresh/directory`; `--only-isolation` narrows debugging
  and is not the full acceptance gate. `sequence-{model,build,audio}.test.mjs`
  verifies event semantics, recipe limits, native output, assets and isolated
  portable rebuilding with explicit instance IDs.
  See `source/lib/sequences/README.md` (relative to the template root).
- `sequence-authoring.mjs` bounds data-only recipe authoring against a trusted
  contract. Its tests exercise refusal and repair budgets. The real direct-call
  research runner is `tests/tools/document_flow_bench.py`; it validates without
  spending by default, and makes provider calls only with explicit `--run`.

## Maintained test entrypoints

The [2026-11-21 closure receipt](closing-acceptance.json) records 921 passing
native cases on code commit `9d249e6f`, plus the two pixel canaries, 150 Node
contracts and the current fast pytest run. It includes exact report checksums,
source identity, the expected-failure calibration and retained demo warnings.
This is a local acceptance snapshot; subsequent changes need fresh receipts.

None of these tests run in CI, or in a plain `uv run pytest`: `tests/conftest.py`
leaves them out unless `PURE_KINETIC_TESTS=1`, which this command sets. Run
them by hand from the repository root:

```sh
kit/tools/test.sh            # everything
kit/tools/test.sh quick      # what draws nothing in Chrome
kit/tools/test.sh glass      # the Glass family
kit/tools/test.sh storybook  # the component Storybook
```

`quick` runs `tests/test_pure_kinetic*.py` without the tests that draw in
Chrome (the `AUDIT` marker of `tests/test_pure_kinetic.py`), which includes
every `tools/*.test.mjs` suite through `test_node_component_contracts`. With
no word the picture audits run too, every time: nothing guesses from git
whether they are due. A test that needs Chrome or the template's packages
and finds neither is skipped, and a skipped test is not a pass.

`tests/test_pure_kinetic_ellipsis.py` owns the current complete single-line text
suite. Its runner, `ellipsis-suite-native.mjs --out /fresh/directory`, orchestrates
the catalog geometry/motion, drag filenames, scan statuses, Canvas, fitter,
HUD and conditional-branch gates, including their negative controls. It builds a
baseline from the same source in a fresh checkout. This checks build parity and
native invariants; it is explicitly `same-source-native-build`, not a historical
before/after comparison. No old `/tmp` snapshot is required. `--source` selects
an explicit source snapshot. Each subreport retains its own source evidence.

`tests/test_pure_kinetic_typing.py` owns the per-key builtin (27), motion (18) and
UI (42) matrices. `tests/test_pure_kinetic_typing_edges.py` owns the targeted RTL
and terminal-newline gate. All use 9:16, 1:1 and 16:9
and deterministic forward/reverse seeks. The original stable-layout receipts
may report 24 builtin cases; those are historical, not the current default matrix.

`PURE_KINETIC_ARTIFACT_DIR` preserves supported gate outputs outside pytest's
temporary directories; the ellipsis suite writes its reports under `ellipsis/`.
The design-system and typing wrappers likewise preserve `catalog-design/`,
`typewriter-layout/`, `visible-content/`, `surfaces/`, `typing-builtin/`,
`typing-motion/`, `typing-ui/`, `typing-motion-negative-control/` and
`typing-edges/` when those gates run.
`test.sh` sets it to `data/qa/pure-kinetic/<time>/` unless it is given.

The archive includes `index.html`; verification recomputes every SHA-256 and
checks the complete file inventory. Packaging preserves report scope and
provenance; it does not turn partial or failed runs into acceptance. CI writes
to `qa-artifacts/pure-kinetic/$CI_JOB_ID` and the sibling `$CI_JOB_ID.zip`, so retries
cannot reuse older evidence. This directory is outside the preserved `data/`
tree: the next CI checkout removes old local copies. GitLab retains the archive
and JUnit results for 30 days, including on failure. The successful test path
requires packaging to pass; `after_script` also packages failed/partial runs.
The archive contains reports and native images once, avoiding duplicate media
in the upload. The test job has a three-hour timeout for the full native matrices
plus the rest of the repository suite on the shared worker.
The existing protected main-only CI policy is unchanged.
Feature-branch local results do not imply a hosted gallery, deployment or a
completed remote CI run.

Native browser hosting and seeking deliberately depend on private HyperFrames
0.9.19 chunks through `native-hyperframes-adapter.mjs`. Its contract tests reject
unsupported versions, missing/ambiguous chunks and changed callable exports with
an actionable error. This is a pinned QA boundary, not a public vendor API or
production dependency; see [the compatibility policy](migration-README.md).
The sequence probes share that adapter. The two contrast probes also use the
pinned vendor's browser audit asset; vendor-private QA coupling remains explicit.
Restore missing dependencies from the template directory with
`../../core/tools/node_modules/.bin/pnpm install --frozen-lockfile` (the same
package manager as CI). Do not upgrade the vendor as a routine test repair.

## Frozen references and import tools

> Kinetic's own engine and plans (`kinetic/reference/`), the comparison of the
> compiler against them (`kinetic/plans.test.js`) and the tool that reads a new
> upstream bundle (`kinetic/extract.py`) are not published: they are kept and
> run where the library is developed. What follows describes them for that place.

`kinetic/reference/` is historical test input. Its plan compiler and plans are
used by `kinetic/plans.test.js`; its raw drawing files are used by
`kinetic/frames.mjs`. `kinetic/templates.json` and `kinetic/samples.json` also
supply regression films. Do not replace these files with current native output
or delete them as unused runtime code. The dated acceptance JSON files retain
their original tested scope, including when the live catalogue grows.

The upstream extraction utility now requires a new output directory:

```sh
python tools/kinetic/extract.py /path/to/upstream-app-bundle.js --out /tmp/kinetic-import
```

It writes review copies of the upstream guide, templates, plan compiler, looks
and fields under that directory. It refuses any existing destination and does
not update the maintained template or frozen fixtures. The field schemas in
the live compiler contain measured content limits; blindly extracting over
them would discard those fixes. Review the import and deliberately port wanted
changes, then regenerate the guide and run affected checks. A failed extraction
can leave an incomplete review directory; inspect or remove that directory
before choosing a fresh destination.

`migration-components.mjs` is the one-time mechanical converter. Its explicit
frozen input and fresh output safeguards remain; maintained native factories
must be edited directly. It is retained to reproduce the migration method,
not run as a template update command.
