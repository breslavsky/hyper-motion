// The Storybook's first page: what the library is, its badges and links as a
// repository's page has them, and its kinds of scenes, each with one scene of
// it playing and the way into its section.
import catalog from '../generated/catalog.json';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
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
  {id: 'flat', name: 'Flat Motion', shows: 'slam', film: {},
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

// One scene playing: a small silent clip of it from our public CDN, rendered
// by HyperFrames (scripts/landing-clips.mjs). Four live scenes are more than a
// page can carry. A clip plays only while it is on the screen.
const CLIPS = 'https://motion-fab-share.b-cdn.net/components/landing/';
const seen = new IntersectionObserver(entries => {
  for (const {target, isIntersecting} of entries) { if (isIntersecting) target.play().catch(() => {}); else target.pause(); }
}, {threshold: .2});
function playing(kind, entry) {
  const frame = el('div', 'hm-play');
  const clip = Object.assign(el('video'), {src: `${CLIPS}${kind.id}.mp4`, muted: true, loop: true, playsInline: true, preload: 'metadata'});
  clip.setAttribute('aria-label', `${entry.type}, playing`);
  seen.observe(clip);
  frame.append(clip);
  return frame;
}

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

export function renderLanding() {
  const page = el('main', 'hm-landing');
  const hero = el('header', 'hm-hero');
  const title = el('h1');
  title.append('Ultimate Hyper Frames', el('br'), 'Components Pack');
  hero.append(el('p', 'hm-badge', 'Free & Open Source'), title, el('p', 'hm-lead', 'For your AI agent'));
  const total = catalog.length;
  hero.append(el('p', 'hm-facts', `${total} scenes for HyperFrames films, each one a recipe an agent can write: its fields, its limits and its sound cues are checked by code.`));
  const badges = el('p', 'hm-badges');
  for (const [about, says, href, colour] of BADGES) {
    const badge = el(href ? 'a' : 'span', 'hm-shield');
    if (href) Object.assign(badge, {href, target: '_blank', rel: 'noopener'});
    const value = el('b', '', says); value.style.background = colour;
    badge.append(el('span', '', about), value);
    badges.append(badge);
  }
  hero.append(badges);
  const follow = el('p', 'hm-follow');
  const link = (text, href) => Object.assign(el('a', '', text), {href, target: '_blank', rel: 'noopener'});
  follow.append('Follow ', link('@AntonBreslavsky', 'https://x.com/AntonBreslavsky'), ' on X for what comes next. Developed with ', link('Motion Fab', 'https://www.motionfab.app'), '.');
  hero.append(follow);
  const actions = el('p', 'hm-actions');
  const browse = Object.assign(el('a', 'hm-button', 'Browse the components'), {href: docs(catalog.find(entry => entry.type === 'glass-search')), target: '_top'});
  actions.append(browse, link('GitHub', 'https://github.com/breslavsky/hyper-motion'));
  actions.lastChild.className = 'hm-link';
  hero.append(actions);
  page.append(hero);

  const kinds = el('section', 'hm-kinds');
  for (const kind of KINDS) {
    const over = Boolean(kind.over);
    const entries = over ? BROLLS.map(type => catalog.find(entry => entry.type === type)).filter(Boolean) : catalog.filter(entry => kindOf(entry) === kind.id);
    const shown = catalog.find(entry => entry.type === kind.shows) ?? entries[0];
    // A B-Roll is a story of its own, not a scene's page.
    const way = entry => over ? story(`b-rolls-${entry.type}--preview`) : docs(entry);
    const card = el('article', 'hm-kind');
    card.id = `hm-${kind.id}`;
    card.append(playing(kind, shown));
    const words = el('div', 'hm-words');
    const heading = el('h2');
    heading.append(Object.assign(el('a', '', kind.name), {href: way(entries[0]), target: '_top'}), el('span', '', `${entries.length} ${kind.counts ?? 'scenes'}`));
    words.append(heading, el('p', '', kind.says));
    card.append(words);
    kinds.append(card);
  }
  page.append(kinds);
  const features = el('section', 'hm-features');
  features.id = 'hm-features';
  features.append(el('h2', '', 'What every scene does'));
  const grid = el('div', 'hm-feature-grid');
  for (const [name, says, drawing] of FEATURES) {
    const item = el('article'), picture = el('div', 'hm-drawing');
    picture.innerHTML = `<svg viewBox="0 0 240 120" role="img" aria-label="${name}" xmlns="http://www.w3.org/2000/svg">${drawing}</svg>`;
    item.append(picture, el('h3', '', name), el('p', '', says));
    grid.append(item);
  }
  features.append(grid);
  page.append(features);
  const foot = el('footer', 'hm-foot');
  foot.append('Developed with ', Object.assign(el('a', '', 'Motion Fab'), {href: 'https://www.motionfab.app', target: '_blank', rel: 'noopener'}), '. Beta: scenes and their fields may still change.');
  page.append(foot);
  return page;
}
