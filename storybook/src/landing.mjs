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

// What every scene of the library does, whatever its kind.
const FEATURES = [
  ['Three formats', 'Every scene is laid out for 16:9, 9:16 and 1:1: columns in a wide frame, rows in a tall one, nothing cut.'],
  ['On the beat', 'A scene is as long as its beats, and its moves can be pinned to beats of the music: a click, a reveal, a landing.'],
  ['Sound cues', 'Each scene says what it sounds like and when: a key typed, a button clicked, a panel that opens. Play them or score them.'],
  ['Placed where you say', 'A glass panel stands at one of nine places in the frame, full size or small, clear of what the footage shows.'],
  ['Over your footage', 'Glass laid on a video that plays on its own track bends that video under it, through the film\'s reframes and zooms.'],
  ['Your brand', 'Colours, a font from sixteen bundled families, forty-three looks, and glass, dark glass or metal for the 3D surfaces.'],
  ['Text that fits', 'Every text is measured with its font against its box. A long line is set smaller, wrapped or refused, never cut.'],
  ['Checked for agents', 'A recipe a scene cannot draw is refused with the reason and the number it needs, before anything is rendered.'],
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
  // The way to each part of the page, as a repository's page lists its chapters.
  const nav = el('nav', 'hm-nav');
  for (const kind of KINDS) nav.append(Object.assign(el('a', '', kind.name), {href: `#hm-${kind.id}`}));
  nav.append(Object.assign(el('a', '', 'Features'), {href: '#hm-features'}));
  hero.append(nav);
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
    const list = el('p', 'hm-list');
    for (const entry of entries.slice(0, 14)) list.append(Object.assign(el('a', '', entry.type), {href: way(entry), target: '_top'}));
    if (entries.length > 14) list.append(el('span', '', `and ${entries.length - 14} more`));
    words.append(list);
    card.append(words);
    kinds.append(card);
  }
  page.append(kinds);
  const features = el('section', 'hm-features');
  features.id = 'hm-features';
  features.append(el('h2', '', 'What every scene does'));
  const grid = el('div', 'hm-feature-grid');
  for (const [name, says] of FEATURES) { const item = el('article'); item.append(el('h3', '', name), el('p', '', says)); grid.append(item); }
  features.append(grid);
  page.append(features);
  const foot = el('footer', 'hm-foot');
  foot.append('Developed with ', Object.assign(el('a', '', 'Motion Fab'), {href: 'https://www.motionfab.app', target: '_blank', rel: 'noopener'}), '. Beta: scenes and their fields may still change.');
  page.append(foot);
  return page;
}
