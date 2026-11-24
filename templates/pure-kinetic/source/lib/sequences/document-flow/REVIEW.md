# Folio 02 review

Folio 02 improves the film's hierarchy and the relationship between its verbs
and pictures. Drafts is a recognizable opening subject and closing result;
Collect accompanies gathering, Arrange accompanies sorting, and Create has an
actual change in the existing artwork. The previous three-group camera tour
has been replaced with one approach to the result. This is a stronger authored
document story, not evidence of parity with Claude Motion.

## Comparison reference

The direct before/after reference is Folio v1 from commit `070086c2`, preserved
at `/tmp/folio-sequence/folio-{portrait,square,wide}.mp4`; archived source is
under `/tmp/folio-v2/templates/`. Copy, document IDs, category assignments,
brand, 32 beats at 108 BPM, output formats and pulse-bed gain are matched.
Semantic effects change with choreography; the complete mixes are not assumed
to be loudness matched.

V1's earlier comparison against manually assembled Pure Kinetic scenes is a
separate experiment. Its historical pass counts are not reused for Folio 02.

## Viewed evidence and a defect caught during review

Fresh native HyperFrames 0.9.19 projects were built under
`/tmp/folio-v2-direction/final-{portrait,square,wide}`. Opening and Create frames
were captured through the native settled-page/seek helpers. Create beats 24.8
and 25.5 correspond to 13.777778s and 14.166667s; all six payoff images were
viewed. They show the selected sheet, fully readable supplied label, growing
coral panel and filled photo artwork in all three formats. Portrait gives this
artwork the strongest presence; the lower-height wide card gives it less area.

Native measurement caught a real defect that nominal line-height arithmetic
missed: Geist Mono's label scrollHeight is 56px at a 48px square label and 64px
at a 54px wide label. The initial art sizes therefore hid even normal-copy
artwork. The corrected gate uses label offsetTop plus scrollHeight and the
card's border-excluded clientHeight, with a real 12px gap. Final art heights
are 116/56/48px for portrait/square/wide. Fresh measurements and screenshots
confirm default artwork visibility. Evidence is
`/tmp/folio-v2-direction/final-metrics.json` and `final-*-b24.8.png` /
`final-*-b25.5.png`.

The fresh portrait carry sheets under
`/tmp/folio-v2-direction/final-carry/` were inspected from 5.6–10.65s. Their explicit queue,
single moving sheet and bottom-up column order communicate sorting more
clearly than v1's crossing arcs. The carry is initially back-facing and reveals
its label only after clearing the queue; a still can catch a brief blank front
during the turn. Intentional back-face stacking is not a claim of zero object
overlap. Moving and settled readable labels still require native occlusion
tests rather than a visual exemption.

These observations are sampled-frame creative review. They do not certify
every frame, subjective full-speed rhythm, auditory balance or all brands.

## Native check receipts

The three `/tmp/folio-v2/final-check-{portrait,square,wide}.json` native reports
were read: all return `ok: true` with zero errors. Their contrast checks pass
19/19 portrait, 18/18 square and 19/19 wide. This is sampled CLI acceptance;
the reports' separate motion module is disabled, so they are not evidence of
full-motion quality by themselves.

Retained findings are explicit. Portrait reports a rotated Drafts SVG group
about 3px beyond its clipping SVG, with five sampled occurrences between
0.988s and 12.840s; this clips decorative art, not supplied text. Square retains
the duplicate-media heuristic for intentional simultaneous recognition ticks.
Camera/world overflow and small artwork bounds also appear as informational
findings. No layout allowance was added to suppress these findings.

The final summary at `/tmp/folio-v2-qa/final-summary.json` records 24 passing
visual cases: 18 brand/copy/format combinations, three unchanged actual
DeepSeek recipes and three hero-placement/fallback edge cases. There are 2,418
sampled states, including 1,008 carry states, 120 reverse checks, 120 composited
contrast frames and 24 occlusion negative controls. Minimum projected type is
40px and minimum sampled contrast is 5.017:1. Thirteen applicable draft-hero
cases prove visible artwork completion; multiline labels deliberately omit
that decoration and are not counted as visual payoff proof. The deliberately
invisible foreground fails at 1:1 contrast as expected. Source is stable across
all visual reports, with aggregate
`1d01a27b38296c6038f0278434745512c7c11cff86c88d0a88fd9bacc613d205`;
the model/view/runtime hashes match the fresh visual-review projects.

Five native integration cases pass in
`/tmp/folio-v2-final3-contracts/report.json`, also source-stable: two instances
of the same graphics source remain independent; stale root and child events
reject ordinary export; rebuilt events and safe copy changes export. Seven
variable precedence cases pass in `/tmp/folio-v2-final3-variables/report.json`.
These results were read from receipts, making 36 positive native cases in
total. Full application regression is tracked separately in the delivery report.

`/tmp/folio-v2/exports.json` records all three final H.264/AAC exports at native
dimensions, 30 fps, 534 frames / 17.8 seconds and 48 kHz audio. The measured
source mix is -27.38 to -27.39 LUFS and -9.34 dBTP, with no clipping. These are
the analysis filter's input measurements, not its proposed normalization output.
Audio was measured, not heard; artistic balance is not established by loudness
numbers. Native frame inspection and decoded export verification do not alone
prove subjective full-speed motion quality.

## Remaining visual tradeoffs

- Category names appear only after every sheet lands at beat 19.05 / 10.583s.
  This avoids the corridor/label conflict but makes most of Arrange a deal into
  unnamed columns. The complete named result holds for 1.639s before Create.
- The wide decorative result is smaller than portrait's because labels, actual
  glyph height and the gap take precedence inside its short card. It is now
  visible, but the payoff has less visual force at small playback sizes.
- Long stress labels retain their exact content and readable floor. If they
  consume the artwork region, decorative art is omitted. This is acceptable
  spatial behavior but makes Create less demonstrative; it is not equal
  artistic quality across all supported copy. Extreme words may still require
  a mid-word wrap after normal wrapping and font fitting are exhausted.
- The abstract Drafts completion is a bounded metaphor, not a real product
  editing workflow. A more elaborate result would require supplied product
  material or a new approved story, not invented capabilities.

## Architecture boundary

The world remains six documents and three groups with authored routes. Native
HyperFrames owns time, media and rendering; model state is sampled without a
second player. Roots own instances, variable inheritance and disposal. The
builder binds semantic events to native audio; changed events or sound settings
must reject export until rebuilt. See README for the precise supported contract
and the implementation report for test evidence.

The builder emits one world per project. Multiple native mounts are an
integration concern with separately assembled audio, not an automatic world
planner. Arbitrary counts, routes, fonts/scripts and local tempo ramps remain
outside the family. Global BPM changes transpose this demonstration bed. The
general worker still uses the existing film entry point; this sequence and its
bounded recipe writer are a local production path.
