# Native HyperFrames acceptance

`audit.mjs`, `sheet.mjs`, and `native-accept.mjs` compile and seek the actual pinned HyperFrames 0.9.19 project. They do not call the former Pure Kinetic frame player. The shared browser adapter copies the source before testing, builds native composition hosts, waits for readiness, and blocks external asset requests.

For current component maintenance, start with [the maintained test entrypoints](README.md#maintained-test-entrypoints). This page also retains the original migration/reference workflow; reproducing that historical comparison requires its frozen source.

The QA-only [compatibility adapter](native-hyperframes-adapter.mjs) deliberately imports three private vendor chunks for bundling, browser hosting and deterministic seeking. These helpers are not public exports in the pinned package. It checks the exact version, unique chunk matches and callable exports before a native run; an unsupported or incomplete installation fails with an actionable contract error. This isolates vendor coupling; it does not remove it. Production components never import the adapter. A future component kit should use a supported public player/CLI interface; a dependency upgrade requires a separate adapter review and native acceptance.

The same adapter serves `sequence-probe.mjs`, `sequence-variables.mjs` and `sequence-contracts.mjs`. The two contrast probes additionally read the pinned vendor's `dist/commands/contrast-audit.browser.js` asset to run its contrast audit inside the page. That private QA asset is an intentional remaining dependency and must also be reviewed on an upgrade.

```sh
node tools/audit.mjs --looks editorial --aspects 9:16,16:9,1:1 --known --twice --json /tmp/pk-audit.json
node tools/audit.mjs --long --known --scenes title,typewriter,stack,steps,agent,orb,dial,controls,phone3d --looks editorial --aspects 9:16,16:9,1:1 --font 'Geist Mono' --json /tmp/pk-font-audit.json
node tools/native-accept.mjs --extended --reference /path/to/frozen/source --out /tmp/pk-accept
```

The picture audit retains its existing safe-area, clipping, minimum-size, overlap, foreign-content, early-text, and known-debt checks. `--font` supplies a central bundled brand font. Its JSON faults and `.sources.json` receipt are written even with `--known`.

The current extended acceptance matrix includes 105 component types in three formats; explicit toggle, chart, fullbleed, stat, and all nine morph states; 43 looks; 18 transitions; six real supplied-image branches; four halftone variants; four explicit dial schedules; and three repeated-definition films. It checks native instance clocks, absence of legacy playback globals, private SVG IDs, independent child timelines, hidden-future fitting, decoded image assets, and visible ui-float image pixels. A dial's visible target value and arrival sound must coincide with the requested musical beat. The historical `native-acceptance.json` receipt and `MIGRATION.md` retain the original migration scope: 95 components and 402 cases. They do not claim coverage of later additions.

Use `--cases` with a regular expression to select a group, for example `--extended --cases '^(look|transition)-'`. `--scenes` and `--aspects` select the basic catalogue cases. Repeated-instance cases are included unless a case filter excludes them.

## Reference and reverse seeking

The reference is a frozen copy of the complete pre-migration template source, including fonts. Both sides use HyperFrames' native bundler and seeker. Forward and reverse native-to-reference differences must retain the original limits: mean channel difference at most 1.5/255 and at most 1% perceptibly changed pixels.

Reverse seeking requires identical native DOM state, measured element geometry, and clock values. Attribute and style declaration order is canonicalized; every attribute value, style value, and node position remains part of the state check. Exact PNG equality is recorded separately. The frozen engine itself exhibits Chromium transformed-layer raster caching: the same DOM and time can produce slightly different glyph or gradient edge pixels after other frames. A paired reverse check allows no more than the reference's own forward-to-reverse discrepancy plus 0.06 mean channel levels and 0.0001 perceptible-pixel share. The report records every non-exact sample, both measured discrepancies, and the policy rationale. Without a reference, the existing picture-audit bound remains: resize both frames to one quarter of the native width and height with the cubic kernel, then allow no more than 0.0002 of those pixels to change by more than 96 in a channel. Full-size maximum deltas and changed-pixel counts remain diagnostic data. These raster checks do not relax DOM, clock, content, or fit checks.

The supplied-image ui-float case is explicitly native-only: the frozen engine throws an insertion error in that branch. Acceptance requires a loaded image, visible geometry, and its distinctive fixture colors in the actual screenshot.

The five new community components (`polar`, `letterflip`, `accordion`, `explode`, `scan`) are also native-only because they do not exist in the frozen engine. When `--reference` is supplied, the runner reads the frozen catalogue and marks any case containing an absent type with an explicit `referenceException`; it does not substitute a different scene or claim a matching baseline. Native clocks, exact DOM and geometry state, reverse-seek raster bounds, fitting and content checks still apply. Existing types continue to require their original paired reference checks. Use `--scenes polar,letterflip,accordion,explode,scan --aspects 9:16,16:9,1:1` for the new basic cases, or `technique.py accept <name>` for each component's five-look acceptance gate and contact sheet.

## Receipts and interruption

Each run writes `report.json`, `source-receipt.json`, and a `native-source/` copy. SHA256 receipts cover compiler, runtime, component, CSS, builder, and vendor JavaScript files. Different source snapshots must be reported separately; do not describe an earlier run as validating later source edits.

Browsers are recycled every 25 cases while retaining the copied source. A disconnected browser stops the run instead of generating a cascade of meaningless case failures. Resume with the original snapshot and identical reference:

```sh
node tools/native-accept.mjs --extended --reference /path/to/frozen/source \
  --source /tmp/pk-accept/native-source --out /tmp/pk-accept --resume
```

Resume verifies source hashes, retains passed cases, and retries failures. After changing source, use a new output directory and rerun the affected cases. A full run against one snapshot and focused later regressions are distinct receipts, not one fabricated all-current-source result.

`--extended --list` prints the expected case inventory without launching Chrome. `native-merge.mjs` can combine disjoint runs and explicitly ordered focused regressions:

```sh
node tools/native-merge.mjs --out /tmp/pk-coverage.json \
  /tmp/core-a/report.json /tmp/core-b/report.json /tmp/looks/report.json \
  /tmp/focused-final/report.json
```

The last supplied result for an ID wins, including failures. Missing cases fail the merge. Each selected case retains its report and source hash; the merged report lists every snapshot's file differences against the current source.
