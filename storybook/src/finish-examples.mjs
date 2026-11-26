// The finish's examples: one page, the same in every example, and what is laid
// over it. scripts/prepare.mjs writes a composition per example;
// stories/finish.stories.mjs shows them. The page is a small film of its own
// (a line, three cards on the beats, a last word), so a flash and a shake have
// something to land on, and it stands on a ground that is not black: grain
// laid on by soft light leaves pure black and pure white alone.
const world = `
<p class="kicker">Hyper Motion</p>
<h1 id="line">Clean is not finished.</h1>
<div class="cards">
 <div class="card" id="card-1" style="background:#5e5ce6"><b>Grain</b><span>over everything</span></div>
 <div class="card" id="card-2" style="background:#ff375f"><b>Fringe</b><span>the colours part</span></div>
 <div class="card" id="card-3" style="background:#30d158;color:#04130a"><b>Shake</b><span>on the hit</span></div>
</div>
<h2 id="last">Now it is.</h2>`;
const style = `#stage{position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%,#2a3350 0%,#161a2a 55%,#0d0f18 100%)}
.kicker{position:absolute;left:160px;top:120px;font-size:34px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
#line{position:absolute;left:160px;top:190px;font-size:132px;font-weight:800;letter-spacing:-.03em;white-space:nowrap}
.cards{position:absolute;left:160px;top:470px;display:flex;gap:36px}
.card{width:480px;height:300px;border-radius:32px;padding:44px;display:flex;flex-direction:column;justify-content:flex-end;gap:10px}
.card b{font-size:64px;font-weight:800;letter-spacing:-.02em}.card span{font-size:34px;font-weight:600;opacity:.85}
#last{position:absolute;left:160px;top:850px;font-size:96px;font-weight:800;letter-spacing:-.02em;color:#ffd60a}`;

// The moments of the page: the cards land on 1, 2 and 3 s, the last word on 4.5 s.
const BEATS = [1, 2, 3], LAST = 4.5, DURATION = 7;
const flashes = [{t: 1, frames: 2, kind: 'white'}, {t: LAST, frames: 1, kind: 'white'}];
const shakes = [{t: 2, d: 0.25, amp: 0.012}, {t: 3, d: 0.25, amp: 0.012}, {t: LAST, d: 0.3, amp: 0.022}];
const hits = [...BEATS, LAST];
const moments = [{at: 0.5, label: 'At rest'}, {at: 1.02, label: 'Flash'}, {at: 2.06, label: 'Shake'}, {at: 4.56, label: 'The blow'}, {at: 6, label: 'Held'}];

export const finishExamples = [
  {
    id: 'everything', name: 'Everything on',
    description: 'The whole finish over one page: grain, the colours a little apart, darker corners, a warm light that wanders, a white frame on the first card and on the last word, and the frame thrown about on the cards between. Every frame is the same on every render.',
    recipe: {seed: 3, grain: 0.12, fringe: {rest: 0.001, hit: 0.004}, vignette: 0.35, flashes, shakes, hits, leak: {amount: 0.35, seed: 2}},
  },
  {
    id: 'plain', name: 'The same page, no finish',
    description: 'The page as it was written, for comparison: nothing is laid over it. Open it beside any other example at the same moment.',
    recipe: null,
  },
  {
    id: 'stock', name: 'A film stock',
    description: 'What a lens and a stock do when nothing happens: grain, a fringe of a pixel and darker corners, with no event at all. Felt more than seen; it is what takes the "rendered" look off a clean page.',
    recipe: {seed: 3, grain: 0.14, fringe: 0.001, vignette: 0.4},
  },
  {
    id: 'hits', name: 'Only the hits',
    description: 'No grain and no vignette: a clean picture that takes the hits of its track. A white frame, a throw of the frame that dies away in a quarter of a second, and the colours parting for a moment on each hit.',
    recipe: {seed: 3, grain: 0, vignette: 0, fringe: {rest: 0, hit: 0.005}, flashes, shakes, hits},
  },
  {
    id: 'heavy', name: 'A look of its own',
    description: 'The finish turned up until it is the look: heavy grain that stays two frames, as a film shot on twos, dark corners and a strong warm leak. Use it on purpose, not by default.',
    recipe: {seed: 5, grain: {amount: 0.3, hold: 2}, fringe: 0.002, vignette: 0.45, leak: {amount: 0.55, seed: 4}},
  },
].map(example => ({width: 1920, height: 1080, duration: DURATION, style, world, moments, beats: BEATS, last: LAST, ...example}));
