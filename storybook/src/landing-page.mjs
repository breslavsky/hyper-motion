// The first page of the site, as HTML: what the library is, its badges and
// links, its kinds of scenes each with a clip of one playing, what every scene
// does, and what it is for. It is written here once, as text, with nothing of
// a browser in it, so the Storybook's page (landing.mjs) and the built site's
// own page (scripts/static-landing.mjs), which a search engine reads without
// running a script, are the same words.
// Where a scene stands in the sidebar (catalog-data.mjs storyTitle, which is for the build and not for a page).
const SECTIONS = {glass: 'Glass', three: '3D', 'lens-wall': '3D'};
const storyTitle = entry => entry.section ? `${entry.section}/${entry.type}` : SECTIONS[entry.family] ? `${SECTIONS[entry.family]}/${entry.type}` : `Pure Kinetic/${entry.family}/${entry.type}`;
// A story's id as Storybook writes it from its title.
const idOf = title => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const docs = entry => `./?path=/docs/${idOf(storyTitle(entry))}--docs`;
const kindOf = entry => entry.section === 'Rides' || entry.family === 'glass' ? 'glass' : ['three', 'lens-wall'].includes(entry.family) ? '3d' : 'flat';

const story = id => `./?path=/story/${id}`;
// The Glass scenes shown over footage (scripts/prepare.mjs BROLLS).
const BROLLS = ['glass-like', 'glass-follow', 'glass-rating', 'glass-message', 'glass-call', 'glass-island', 'glass-checklist', 'glass-search', 'glass-ask'];
const KINDS = [
  {id: 'glass', name: 'Apple Glass', shows: 'glass-search', film: {},
    says: 'Thick optical glass that bends the picture behind it: search, prompts, messages, calls, ratings, steps. Over your own footage too.'},
  {id: '3d', name: '3D', shows: 'synth3d', film: {},
    says: 'Real objects under a real camera: a laptop a hand opens, a machine two hands play, phones, cards, a wall of pictures under a lens.'},
  {id: 'flat', name: 'Flat Motion', shows: 'ride', clip: 'flat-2', film: {},
    says: 'Kinetic type, charts, interface mock-ups and transitions in forty-three looks: the scenes a launch film is cut from.'},
  // Glass scenes laid over footage that plays on a track of its own: a talking head, b-roll.
  {id: 'b-rolls', name: 'B-Rolls', shows: 'glass-message', counts: 'overlays',
    over: {over: true, background: {clip: 'footage'}, place: 'bottom', size: 'small'},
    says: 'The same glass over your own footage: a like, a message, a call, a rating laid on a talking head, bending the video under it.'},
];
// A badge as a repository's page wears them: what it is about, and what it says.
const BADGES = [
  ['status', 'beta', null, '#f08c00'],
  ['license', 'MIT', 'https://github.com/breslavsky/hyper-motion/blob/main/LICENSE', '#2463eb'],
  ['renders with', 'HyperFrames', 'https://github.com/heygen-com/hyperframes', '#4f46e5'],
];

// The words people search by, and what the library is to each of them, said
// as it is: no more than it does.
const ASKS = [
  ['A free After Effects alternative', 'For motion graphics an agent writes as code: titles, kinetic type, charts, interface animation and glass overlays, with no timeline to drag. It is not a compositor for footage.'],
  ['AI motion graphics', 'Your AI agent picks a scene, fills in its fields and gets motion design that was drawn and timed by hand, instead of inventing animation from nothing.'],
  ['HTML to video, HTML to MP4', 'Every scene is HTML, CSS and JavaScript, each frame a pure function of time. HyperFrames renders it to MP4 or WebM.'],
  ['A Remotion alternative', 'If you render with HyperFrames rather than React: plain HTML compositions, ready-made scenes, and nothing to install from npm.'],
  ['HyperFrames components', 'More than a hundred scenes and components for HyperFrames films, added to a film of your own as one more clip.'],
  ['Claude Code, Codex, Cursor', 'Works with any agent that can run a command: Claude Code, Codex, Cursor and the rest. The Install page has a prompt to hand over as it is.'],
];

// One scene playing: a small silent clip of it from our public CDN, rendered
// by HyperFrames (scripts/landing-clips.mjs). Four live scenes are more than a
// page can carry.
const CLIPS = 'https://motion-fab-share.b-cdn.net/components/landing/';

// What every scene of the library does, whatever its kind: its name, what it
// says, and a small drawing of it (a 240 x 120 picture; ink, an accent, a soft
// fill, taken from the page's own colours).
const INK = '#14161c', ACCENT = '#2e5bff', SOFT = '#e9edf5', MUTED = '#aab3c5';
const frame = (x, y, w, h, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${SOFT}" stroke="${INK}" stroke-width="2" ${extra}/>`;
const FEATURES = [
  ['Three formats', 'Every scene is laid out for 16:9, 9:16 and 1:1: columns in a wide frame, rows in a tall one, nothing cut.',
    `${frame(14, 34, 96, 54)}${frame(128, 12, 54, 96)}${frame(196, 46, 32, 32)}
     <g fill="${ACCENT}"><rect x="26" y="52" width="20" height="18" rx="3"/><rect x="52" y="52" width="20" height="18" rx="3"/><rect x="78" y="52" width="20" height="18" rx="3"/>
     <rect x="140" y="30" width="30" height="14" rx="3"/><rect x="140" y="52" width="30" height="14" rx="3"/><rect x="140" y="74" width="30" height="14" rx="3"/><rect x="203" y="56" width="18" height="12" rx="3"/></g>`],
  ['On the beat', 'A scene is as long as its beats, and its moves can be pinned to beats of the music: a click, a reveal, a landing.',
    `<line x1="14" y1="78" x2="226" y2="78" stroke="${INK}" stroke-width="2"/>
     ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<line x1="${20 + i * 25}" y1="${i % 4 ? 70 : 62}" x2="${20 + i * 25}" y2="86" stroke="${i % 4 ? MUTED : INK}" stroke-width="2"/>`).join('')}
     ${[1, 4, 6].map(i => `<circle cx="${20 + i * 25}" cy="38" r="9" fill="${ACCENT}"/><line x1="${20 + i * 25}" y1="47" x2="${20 + i * 25}" y2="70" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="3 3"/>`).join('')}
     <text x="20" y="108" font-size="11" fill="${MUTED}" font-family="ui-monospace,monospace">1</text><text x="120" y="108" font-size="11" fill="${MUTED}" font-family="ui-monospace,monospace" text-anchor="middle">5</text><text x="220" y="108" font-size="11" fill="${MUTED}" font-family="ui-monospace,monospace" text-anchor="end">9</text>`],
  ['Sound cues', 'Each scene says what it sounds like and when: a key typed, a button clicked, a panel that opens. Play them or score them.',
    `${[10, 22, 14, 34, 20, 8, 28, 44, 18, 12, 30, 16, 8, 24, 38, 14, 10, 20, 12, 6].map((h, i) => `<rect x="${16 + i * 10.6}" y="${52 - h / 2}" width="5" height="${h}" rx="2.5" fill="${[3, 7, 14].includes(i) ? ACCENT : MUTED}"/>`).join('')}
     <g font-size="11" font-family="ui-monospace,monospace" fill="${INK}"><text x="50" y="100" text-anchor="middle">pop</text><text x="92" y="100" text-anchor="middle">click</text><text x="167" y="100" text-anchor="middle">chime</text></g>
     <g stroke="${ACCENT}" stroke-width="2"><line x1="50" y1="76" x2="50" y2="86"/><line x1="92" y1="80" x2="92" y2="86"/><line x1="167" y1="76" x2="167" y2="86"/></g>`],
  ['Placed where you say', 'A glass panel stands at one of nine places in the frame, full size or small, clear of what the footage shows.',
    `${frame(40, 12, 160, 96)}
     ${[0, 1, 2].flatMap(r => [0, 1, 2].map(c => r === 2 && c === 2 ? '' : `<circle cx="${68 + c * 52}" cy="${32 + r * 28}" r="4" fill="${MUTED}"/>`)).join('')}
     <rect x="146" y="78" width="46" height="22" rx="11" fill="${ACCENT}"/><rect x="156" y="87" width="26" height="4" rx="2" fill="#fff"/>`],
  ['Over your footage', 'Glass laid on a video that plays on its own track bends that video under it, through the film\'s reframes and zooms.',
    `${frame(40, 12, 160, 96)}<circle cx="120" cy="46" r="17" fill="${MUTED}"/><path d="M82 108c4-26 18-38 38-38s34 12 38 38z" fill="${MUTED}"/>
     <rect x="62" y="76" width="116" height="24" rx="12" fill="#fff" fill-opacity=".72" stroke="${ACCENT}" stroke-width="2"/><circle cx="76" cy="88" r="5" fill="${ACCENT}"/><rect x="88" y="85" width="62" height="5" rx="2.5" fill="${INK}"/>
     <path d="M214 30l12 8-12 8z" fill="${INK}"/>`],
  ['Your brand', 'Colours, a font from sixteen bundled families, forty-three looks, and glass, dark glass or metal for the 3D surfaces.',
    `<text x="18" y="84" font-size="64" font-weight="750" fill="${INK}" font-family="system-ui,sans-serif" letter-spacing="-3">Aa</text>
     ${[ACCENT, '#ff6b57', '#0f9d58', '#f0b400', INK].map((c, i) => `<circle cx="${132 + i * 22}" cy="42" r="10" fill="${c}"/>`).join('')}
     <rect x="122" y="66" width="30" height="30" rx="8" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="160" y="66" width="30" height="30" rx="8" fill="${INK}"/><rect x="198" y="66" width="30" height="30" rx="8" fill="${MUTED}" stroke="${INK}" stroke-width="2"/>`],
  ['Text that fits', 'Every text is measured with its font against its box. A long line is set smaller, wrapped or refused, never cut.',
    `${frame(22, 22, 196, 62)}<rect x="36" y="38" width="150" height="10" rx="5" fill="${INK}"/><rect x="36" y="58" width="112" height="10" rx="5" fill="${INK}"/>
     <g stroke="${ACCENT}" stroke-width="2" fill="none"><line x1="22" y1="100" x2="218" y2="100"/><path d="M22 94v12M218 94v12"/><path d="M30 96l-6 4 6 4M210 96l6 4-6 4"/></g>`],
  ['Checked for agents', 'A recipe a scene cannot draw is refused with the reason and the number it needs, before anything is rendered.',
    `${frame(16, 14, 124, 92)}<g font-size="12" font-family="ui-monospace,monospace" fill="${INK}"><text x="28" y="38">{ "type":</text><text x="40" y="56">"glass-ask",</text><text x="40" y="74">"beats": 2</text><text x="28" y="92">}</text></g>
     <rect x="38" y="64" width="78" height="14" rx="3" fill="none" stroke="#e5484d" stroke-width="2"/>
     <circle cx="186" cy="42" r="18" fill="#e5484d"/><path d="M178 34l16 16M194 34l-16 16" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
     <text x="186" y="84" font-size="11" font-family="ui-monospace,monospace" fill="${INK}" text-anchor="middle">needs 6 beats</text>`],
];

const esc = text => String(text).replace(/[&<>"]/g, sign => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[sign]);
const out = (text, href, attrs = '') => `<a href="${esc(href)}" target="_blank" rel="noopener"${attrs}>${text}</a>`;
const into = (text, href, attrs = '') => `<a href="${esc(href)}" target="_top"${attrs}>${text}</a>`;
const MOTION_FAB = 'https://www.motionfab.app', GITHUB = 'https://github.com/breslavsky/hyper-motion';

// `catalog`: the scenes there are (generated/catalog.json), for their count and their pages.
export function landingHtml(catalog) {
  const badges = BADGES.map(([about, says, href, colour]) => {
    const inner = `<span>${esc(about)}</span><b style="background:${colour}">${esc(says)}</b>`;
    return href ? out(inner, href, ' class="hm-shield"') : `<span class="hm-shield">${inner}</span>`;
  }).join('');
  const kinds = KINDS.map(kind => {
    const over = Boolean(kind.over);
    const entries = over ? BROLLS.map(type => catalog.find(entry => entry.type === type)).filter(Boolean) : catalog.filter(entry => kindOf(entry) === kind.id);
    const shown = catalog.find(entry => entry.type === kind.shows) ?? entries[0];
    // A B-Roll is a story of its own, not a scene's page.
    const way = entry => over ? story(`b-rolls-${entry.type}--preview`) : docs(entry);
    return `<article class="hm-kind" id="hm-${kind.id}">
<div class="hm-play"><video src="${CLIPS}${kind.clip ?? kind.id}.mp4" autoplay muted loop playsinline preload="metadata" aria-label="${esc(shown.type)}, playing"></video></div>
<div class="hm-words"><h2>${into(esc(kind.name), way(entries[0]))}<span>${entries.length} ${kind.counts ?? 'scenes'}</span></h2><p>${esc(kind.says)}</p></div>
</article>`;
  }).join('\n');
  const features = FEATURES.map(([name, says, drawing]) => `<article><div class="hm-drawing"><svg viewBox="0 0 240 120" role="img" aria-label="${esc(name)}" xmlns="http://www.w3.org/2000/svg">${drawing}</svg></div><h3>${esc(name)}</h3><p>${esc(says)}</p></article>`).join('\n');
  const asks = ASKS.map(([asked, answer]) => `<article><h3>${esc(asked)}</h3><p>${esc(answer)}</p></article>`).join('\n');
  return `<header class="hm-hero">
<p class="hm-badge">Free &amp; Open Source</p>
<h1>Ultimate Hyper Frames<br>Components Pack</h1>
<p class="hm-lead">Your AI agent can do HTML to video</p>
<p class="hm-facts">${catalog.length} scenes for HyperFrames films, each one a recipe an agent can write: its fields, its limits and its sound cues are checked by code.</p>
<p class="hm-badges">${badges}</p>
<p class="hm-follow">Follow ${out('@AntonBreslavsky', 'https://x.com/AntonBreslavsky')} on X for what comes next.</p>
<p class="hm-made">Developed with${out(`<img src="${MOTION_FAB}/brand/motionfab-logo.svg" alt="Motion Fab" height="22">`, MOTION_FAB, ' class="hm-logo" title="Motion Fab"')}</p>
<p class="hm-actions">${into('Browse the components', docs(catalog.find(entry => entry.type === 'glass-search')), ' class="hm-button"')}${into('Install', story('hyper-motion--install'), ' class="hm-button hm-quiet"')}${out('GitHub', GITHUB, ' class="hm-link"')}</p>
</header>
<section class="hm-kinds">
${kinds}
</section>
<section class="hm-features" id="hm-features"><h2>What every scene does</h2><div class="hm-feature-grid">
${features}
</div></section>
<section class="hm-asks"><h2>What it is for</h2><div class="hm-ask-grid">
${asks}
</div></section>
<footer class="hm-foot">Beta: scenes and their fields may still change.</footer>`;
}
