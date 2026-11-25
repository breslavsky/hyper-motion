// The Storybook's first page: what the library is, its badges and links as a
// repository's page has them, and its kinds of scenes, each with one scene of
// it playing and the way into its section.
import catalog from '../generated/catalog.json';
import {defaultArgs, makeFilm} from './model.mjs';

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
  ['X', '@AntonBreslavsky', 'https://x.com/AntonBreslavsky', '#000000'],
  ['status', 'beta', null, '#f08c00'],
  ['license', 'MIT', 'https://github.com/breslavsky/hyper-motion/blob/main/LICENSE', '#2463eb'],
  ['for', 'AI agents', null, '#14161c'],
  ['renders with', 'HyperFrames', 'https://github.com/heygen-com/hyperframes', '#4f46e5'],
  ['developed with', 'Motion Fab', 'https://www.motionfab.app', '#2e5bff'],
];

// One scene playing on its own: the kit's preview page, driven by this page's clock.
function playing(entry, change = {}) {
  const frame = el('div', 'hm-play');
  const view = el('iframe');
  view.title = `${entry.type}, playing`; view.loading = 'lazy'; view.setAttribute('scrolling', 'no'); view.tabIndex = -1;
  const film = makeFilm(entry, {...defaultArgs(entry), ...change}, {aspect: 'landscape', material: 'example'});
  view.src = `./pk/preview.html#${encodeURIComponent(JSON.stringify(film))}`;
  let raf = 0;
  view.addEventListener('load', () => {
    const page = view.contentWindow, began = performance.now();
    const turn = now => {
      if (!view.isConnected) return;
      const timeline = page.__timelines?.main;
      // A beat of rest on the last frame before it begins again.
      if (timeline) { const length = timeline.duration() + .8; timeline.pause(); timeline.time(Math.min(timeline.duration(), ((now - began) / 1000) % length), false); }
      raf = requestAnimationFrame(turn);
    };
    raf = requestAnimationFrame(turn);
  });
  // The scene is drawn at the film's own size and shown as wide as its card.
  const fit = () => { view.style.transform = `scale(${frame.clientWidth / 1920})`; };
  new ResizeObserver(fit).observe(frame);
  frame.append(view);
  return frame;
}

export function renderLanding() {
  const page = el('main', 'hm-landing');
  const hero = el('header', 'hm-hero');
  const title = el('h1');
  title.append('Ultimate Hyper Frames', el('br'), 'Components Pack');
  hero.append(el('p', 'hm-badge', 'Free & Open Source'), title, el('p', 'hm-lead', 'For your AI agent'));
  const total = catalog.length;
  hero.append(el('p', 'hm-facts', `${total} scenes for HyperFrames films, each one a recipe an agent can write: its fields, its limits and its sound cues are checked by code.`));
  const badges = el('p', 'hm-badges');
  for (const [about, says, href, colour] of [...BADGES.slice(0, 2), ['scenes', String(total), null, '#0f9d58'], ...BADGES.slice(2)]) {
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
    card.append(playing(shown, kind.over));
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
  const foot = el('footer', 'hm-foot');
  foot.append('Developed with ', Object.assign(el('a', '', 'Motion Fab'), {href: 'https://www.motionfab.app', target: '_blank', rel: 'noopener'}), '. Beta: scenes and their fields may still change.');
  page.append(foot);
  return page;
}
