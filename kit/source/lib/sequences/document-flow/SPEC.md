# Document Flow — Folio 02 specification

Goal: give six persistent documents a clear protagonist and visible result.
The same Drafts sheet opens the film, joins the collection, reaches Files, and
finishes its abstract artwork under Create. Other documents retain their IDs,
labels and categories. This is an authored family, not an arbitrary world planner.

Native HyperFrames 0.9.19 renders 1080×1920, 1080×1080 and 1920×1080 at 30 fps.
The timeline is exactly 32 beats / 17.777778 seconds at 108 BPM. Recipe schema
is `document-flow.v1`; choreography is `folio-02`. No narration or captions.

## Content and visual identity

Use Geist Mono, background `#0b0b0b`, foreground `#f4f4f0`, coral `#ff6a70`
and pale blue `#bbddff`. The opening is “From scattered to sorted”; actions are
“Collect”, “Arrange”, “Create”; closing is “Find your next idea”; CTA is “Try
Folio”. Notes, Sketches and Ideas belong to Ideas; Tasks to Tasks; Files and
Drafts to Files. Category labels are never replaced by action labels.

The hero is the first document with kind `draft`, otherwise the last document.
It uses foreground-colored paper and background-colored ink. Other cards use
a 7.5% foreground tint over the background. Cards have 3px borders, 14px corners
and a 0/16/32px black 18% shadow. Groups have 2px borders, 20px corners and a
2.5% foreground fill. Coral marks recognition, selected borders and the CTA;
pale blue identifies card backs. No ambient particles or continuous decoration.

| Native layout property | Portrait | Square | Wide |
| --- | --- | --- | --- |
| Card size | 316×248 | 316×176 | 440×174 |
| Group size | 320×1080 | 320×760 | 500×760 |
| Three group center x positions | 216, 540, 864 | 216, 540, 864 | 370, 960, 1550 |
| Group center y | 1010 | 640 | 600 |
| Queue center | 540, 520 | 540, 326 | 960, 275 |
| First destination y; slot spacing | 790; 290 | 520; 198 | 470; 196 |
| Default card label size | 52px | 48px | 54px |
| Decorative art height | 116px | 56px | 48px |
| Opening hero scale | 2.15 | 2.35 | 1.65 |
| Create camera zoom | 2.1 | 2.25 | 1.8 |

All formats use three destination columns and their own source layout, camera
framing and type sizes. Document labels fit using actual bundled font metrics,
normal word wrapping first, then a 40px logical floor and an anywhere-wrap
fallback. A failure to fit is an error, not silent truncation. Projected native
QA remains necessary: a logical font floor alone does not prove readability.
Artwork is omitted when the measured label leaves less than a 12px gap above
it, using label scrollHeight and the card's border-excluded clientHeight. This
preserves copy in long stress cases but can weaken their Create payoff.

## Beat plan and camera

| Beats | Seconds at 108 BPM | Visible consequence | Sound source |
| --- | --- | --- | --- |
| 0–5 | 0–2.778 | Exact opening and enlarged Drafts; hero returns to its source at 3.8–5 | Hero arrival |
| 5–10 | 2.778–5.556 | Collect: other documents enter; scanner recognizes all six; they turn over and gather into one queue | Arrivals, scan start, six exact crossings, action start |
| 10–22 | 5.556–12.222 | Arrange: one sheet leaves the queue at a time and fills its category bottom-up; the completed named board holds | Six landings, three category-ready events, action start |
| 22–26 | 12.222–14.444 | Create: surrounding sheets dim, camera approaches Drafts, and its existing artwork completes | Action start |
| 26–32 | 14.444–17.778 | World recedes; Folio, closing and CTA enter, then hold | CTA reveal and music fade |

Scanner motion runs at beats 5.5–8.6 and fades by 8.9. It paints behind opaque
documents; each recognition time comes from crossing that document's source
center. Sheets turn over at 9–9.25 and gather at 9.3–10. Their back faces carry
no readable front labels.

The dealing order is category order, reversing the documents within each
category: Ideas, Sketches, Notes, Tasks, Drafts, Files in the Folio example.
Carries start at `10.2 + 1.5 × order` beats and last 1.35 beats. A sheet moves
horizontally in the corridor above the board, then vertically down its column,
with a finite 20px corner. Bottom-up filling keeps it out of occupied slots.
Only one sheet moves at a time; it reveals its front after clearing the queue.
All category names appear together after the last landing at beat 19.05,
leaving 2.95 beats / 1.639 seconds to read the completed board before Create.

The camera holds the whole board during collection and sorting. During Create,
other sheets dim to 6% by beat 22.23; the camera moves at 22.25–23.6. Drafts
stays at its category destination. Its photo shape fills, coral panel grows and
three panels align at 23.4–25; the completed result holds through beat 26.
The camera returns to the board at 26–27, ending at zoom 0.96. End copy enters
at 26.35–27; CTA at 27–27.5. The complete endcard holds for 4.5 beats / 2.5s.

All motion is a closed-form function of native timeline time: smoothstep
camera/reframes, cubic-out travel and a finite 3px landing. No advancing physics,
per-document player or camera drift is used. One paused native GSAP proxy
samples the state and one world transform applies the camera.

## Audio and acceptance

There are 26 semantic events: six arrivals, one scan start, six recognized
documents, six landings, three completed categories, three action starts and
one CTA. Each event can be mapped or muted by kind/target. Default music gain
is 0.32. BPM changes picture and audio together; the existing music bed uses
native playback rate and therefore changes pitch. Local tempo ramps and
pitch-preserving music stretch are not part of this contract.

Check stable IDs, required copy, action-picture alignment, exact destinations,
moving and held label geometry, occlusion, actual font metrics, contrast,
reverse seeking, isolated instance variables/clocks/disposal and native audio.
Changing events or sound without rebuilding must reject ordinary export.
Compare decoded videos with preserved v1 using the same copy/brand/format/
duration and bed. Equal inputs do not imply equal final effect loudness.

Do not add features, replace brand colors, invent screenshots, relabel
categories, hide clipping by shrinking below the floor, treat intentional
back-face stacking as a text overlap exemption, or claim artistic acceptance
from geometry tests. A contact sheet is not a full-speed motion or sound review.
