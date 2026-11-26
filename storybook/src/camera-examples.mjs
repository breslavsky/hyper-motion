// The camera's examples: each a page of its own (what lies on the sheet, how
// it looks) and the camera's recipe for it. scripts/prepare.mjs writes a
// composition per example; stories/camera.stories.mjs shows them.
const bars = heights => `<div class="bars">${heights.map((h, i) => `<i style="height:${h}%${i >= heights.length - 2 ? `;background:${i === heights.length - 1 ? '#ff375f' : '#bf5af2'}` : ''}"></i>`).join('')}</div>`;

const tourWorld = `
<h1 data-cam="title" style="position:absolute;left:240px;top:200px;font-size:120px;letter-spacing:-.03em;white-space:nowrap">One page. One camera.</h1>
<div class="card" data-cam="chart" style="left:1700px;top:520px;width:620px;height:380px;background:#1c1c26"><div style="font-size:34px;opacity:.7">Renders a second</div>${bars([30, 55, 45, 80, 100])}</div>
<div class="card" data-cam="button" style="left:2500px;top:1250px;width:300px;height:110px;background:#30d158;color:#04130a;font-size:44px;display:flex;align-items:center;justify-content:center">Export</div>
<div class="card" data-cam="note" style="left:520px;top:1180px;width:560px;height:240px;background:#ffd60a;color:#221a00;font-size:46px">No keyframes set by hand.</div>`;
const tourStyle = `#world{width:3200px;height:1800px}.card{position:absolute;border-radius:28px;padding:36px;font-weight:700}
.bars{display:flex;align-items:flex-end;gap:22px;height:230px;margin-top:30px}.bars i{width:70px;border-radius:10px;background:#5e5ce6}`;
const tourStops = [
  {at: 0, look: 'title', fill: 0.7}, {at: 2, look: 'chart', fill: 0.8, roll: -3}, {at: 4, look: 'button', fill: 0.35},
  {at: 5.6, look: 'note', fill: 0.6, roll: 4}, {at: 7.4, look: 'all', fill: 0.9},
];

const words = ['Every', 'word', 'gets', 'its', 'own', 'frame.'];
const rows = [['Launch film', 'Rendering', '#ffd60a'], ['Onboarding', 'Ready', '#30d158'], ['Pricing explainer', 'Draft', '#8e8e93'], ['Changelog 4.2', 'Ready', '#30d158']];
const posts = [['Monday', 'Shipped the camera.', '#5e5ce6'], ['Tuesday', 'It takes the hits of the track.', '#ff375f'], ['Wednesday', 'It blurs by its own speed.', '#30d158'], ['Thursday', 'Nobody set a keyframe.', '#ff9f0a']];

export const cameraExamples = [
  {
    id: 'tour', name: 'A tour of a page',
    description: 'Four things on one sheet and a camera that visits each: it closes in, turns a little, stands back to show the whole sheet, and in its last second rewinds its whole way to where it began.',
    width: 1920, height: 1080, style: tourStyle, world: tourWorld,
    recipe: {duration: 9, stops: tourStops, hits: [0.5, 1, 2.5, 3, 4.5, 5], life: {amount: 5, seed: 2}, rewind: 1},
  },
  {
    id: 'tripod', name: 'The same route on a tripod',
    description: 'The same sheet and the same stops with nothing riding on the way: no hits, no hand, no blur. Compare it with the tour to see what those three add.',
    width: 1920, height: 1080, style: tourStyle, world: tourWorld,
    recipe: {duration: 8, stops: tourStops, blur: 0},
  },
  {
    id: 'sentence', name: 'A line read word by word',
    description: 'One long line, far wider than the frame. The camera lands on a word with every hit and never stands back on the way (pull 0), shows the whole line, and rewinds along it to the first word.',
    width: 1920, height: 1080,
    style: `#world{width:4400px;height:1080px}.line{position:absolute;left:300px;top:380px;font-size:260px;font-weight:800;letter-spacing:-.04em;white-space:nowrap}.line span{display:inline-block;margin-right:70px}.line span:nth-child(2){color:#bf5af2}.line span:nth-child(6){color:#30d158}`,
    world: `<div class="line">${words.map((word, i) => `<span data-cam="w${i + 1}">${word}</span>`).join('')}</div>`,
    recipe: {duration: 8, stops: [...words.map((_, i) => ({at: 0.4 + i * 0.8, look: `w${i + 1}`, fill: 0.55, pull: 0, move: 0.45, roll: i % 2 ? 2 : -2})), {at: 6.2, look: 'all', fill: 0.92}],
      hits: words.map((_, i) => 0.4 + i * 0.8), punch: 0.07, life: {amount: 3, seed: 5}, rewind: 1},
  },
  {
    id: 'interface', name: 'A walk through an interface',
    description: 'An app screen laid out once. The camera starts on the whole screen, pushes in on the button, follows to the dialog it opens and to the message that confirms it.',
    width: 1920, height: 1080,
    style: `#world{width:2600px;height:1500px}.app{position:absolute;left:100px;top:100px;width:1700px;height:1100px;border-radius:36px;background:#15151c;overflow:hidden}
.side{position:absolute;left:0;top:0;bottom:0;width:340px;background:#1c1c26;padding:44px 36px;font-size:30px;line-height:2.3;color:#a1a1aa}.side b{display:block;color:#f5f5f7;font-size:38px;margin-bottom:26px}
.head{position:absolute;left:400px;top:50px;right:50px;display:flex;justify-content:space-between;align-items:center;font-size:52px;font-weight:800}
.new{font-size:30px;font-weight:700;background:#5e5ce6;border-radius:18px;padding:18px 34px}
.row{position:absolute;left:400px;right:50px;height:120px;border-radius:20px;background:#1c1c26;display:flex;align-items:center;justify-content:space-between;padding:0 36px;font-size:34px;font-weight:600}
.row i{font-style:normal;font-size:26px;padding:8px 20px;border-radius:999px;color:#0b0b10}
.dialog{position:absolute;left:1900px;top:260px;width:600px;height:520px;border-radius:32px;background:#f5f5f7;color:#0b0b10;padding:48px;font-size:34px;line-height:1.5}.dialog b{display:block;font-size:50px;margin-bottom:20px}
.field{margin-top:36px;height:86px;border-radius:16px;border:3px solid #5e5ce6;display:flex;align-items:center;padding:0 24px;font-weight:600}
.toast{position:absolute;left:1960px;top:1040px;width:480px;height:110px;border-radius:999px;background:#30d158;color:#04130a;font-size:36px;font-weight:800;display:flex;align-items:center;justify-content:center}`,
    world: `<div class="app" data-cam="app"><div class="side"><b>Studio</b>Projects<br>Templates<br>Brand<br>Exports</div>
<div class="head"><span>Projects</span><span class="new" data-cam="new">New project</span></div>
${rows.map(([name, state, colour], i) => `<div class="row" style="top:${220 + i * 150}px"><span>${name}</span><i style="background:${colour}">${state}</i></div>`).join('')}</div>
<div class="dialog" data-cam="dialog"><b>New project</b>Name it and pick a format.<div class="field">Launch film</div></div>
<div class="toast" data-cam="toast">Project created</div>`,
    recipe: {duration: 9, stops: [{at: 0, look: 'app', fill: 0.9}, {at: 2.2, look: 'new', fill: 0.3, pull: 0}, {at: 4.4, look: 'dialog', fill: 0.75, roll: -2},
      {at: 6.4, look: 'toast', fill: 0.5, pull: 0.02}, {at: 8.4, look: 'all', fill: 0.92}], hits: [2.2, 4.4, 6.4], punch: 0.05, life: {amount: 3, seed: 8}},
  },
  {
    id: 'feed', name: 'Down a tall page, in a tall frame',
    description: 'A feed five times the height of a 9:16 frame. The camera goes down it post by post, standing back a little between them, ends close on the button, and rewinds up the whole feed to the first post.',
    width: 1080, height: 1920,
    style: `#world{width:1080px;height:5400px}.post{position:absolute;left:90px;width:900px;height:900px;border-radius:56px;padding:70px;display:flex;flex-direction:column;justify-content:flex-end;font-size:92px;font-weight:800;line-height:1.05;letter-spacing:-.03em}
.post small{font-size:40px;font-weight:600;opacity:.75;margin-bottom:24px;letter-spacing:0}.follow{position:absolute;left:290px;top:4780px;width:500px;height:150px;border-radius:999px;background:#f5f5f7;color:#0b0b10;font-size:60px;font-weight:800;display:flex;align-items:center;justify-content:center}`,
    world: `${posts.map(([day, text, colour], i) => `<div class="post" data-cam="p${i + 1}" style="top:${300 + i * 1080}px;background:${colour}"><small>${day}</small>${text}</div>`).join('')}<div class="follow" data-cam="follow">Follow</div>`,
    recipe: {duration: 10, stops: [...posts.map((_, i) => ({at: 0.2 + i * 1.7, look: `p${i + 1}`, fill: 0.86, pull: 0.06, roll: i % 2 ? 1.5 : -1.5})), {at: 7.6, look: 'follow', fill: 0.6, pull: 0}],
      hits: [0.2, 1.9, 3.6, 5.3, 7.6], punch: 0.05, life: {amount: 4, seed: 4}, rewind: 1.2},
  },
];
