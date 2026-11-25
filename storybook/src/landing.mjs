// The Storybook's first page: what the library is, and its three kinds of
// scenes, each with one scene of it playing and the way into its section.
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

const KINDS = [
  {id: 'glass', name: 'Apple Glass', shows: 'glass-search', film: {},
    says: 'Thick optical glass that bends the picture behind it: search, prompts, messages, calls, ratings, steps. Over your own footage too.'},
  {id: '3d', name: '3D', shows: 'synth3d', film: {},
    says: 'Real objects under a real camera: a laptop a hand opens, a machine two hands play, phones, cards, a wall of pictures under a lens.'},
  {id: 'flat', name: 'Flat Motion', shows: 'slam', film: {},
    says: 'Kinetic type, charts, interface mock-ups and transitions in forty-three looks: the scenes a launch film is cut from.'},
];

// One scene playing on its own: the kit's preview page, driven by this page's clock.
function playing(entry) {
  const frame = el('div', 'hm-play');
  const view = el('iframe');
  view.title = `${entry.type}, playing`; view.loading = 'lazy'; view.setAttribute('scrolling', 'no'); view.tabIndex = -1;
  const film = makeFilm(entry, defaultArgs(entry), {aspect: 'landscape', material: 'example'});
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
  hero.append(el('p', 'hm-badge', 'Free & Open Source'), el('h1', '', 'Ultimate Hyper Frames Components Pack'), el('p', 'hm-lead', 'For your AI agent'));
  const total = catalog.length;
  hero.append(el('p', 'hm-facts', `${total} scenes for HyperFrames films, each one a recipe an agent can write: its fields, its limits and its sound cues are checked by code. MIT licence.`));
  const actions = el('p', 'hm-actions');
  const browse = Object.assign(el('a', 'hm-button', 'Browse the components'), {href: docs(catalog.find(entry => entry.type === 'glass-search')), target: '_top'});
  const code = Object.assign(el('a', 'hm-link', 'GitHub'), {href: 'https://github.com/breslavsky/hyper-motion', target: '_blank', rel: 'noopener'});
  actions.append(browse, code);
  hero.append(actions);
  page.append(hero);

  const kinds = el('section', 'hm-kinds');
  for (const kind of KINDS) {
    const entries = catalog.filter(entry => kindOf(entry) === kind.id), shown = catalog.find(entry => entry.type === kind.shows) ?? entries[0];
    const card = el('article', 'hm-kind');
    card.append(playing(shown));
    const words = el('div', 'hm-words');
    const heading = el('h2');
    heading.append(Object.assign(el('a', '', kind.name), {href: docs(entries[0]), target: '_top'}), el('span', '', `${entries.length} scenes`));
    words.append(heading, el('p', '', kind.says));
    const list = el('p', 'hm-list');
    for (const entry of entries.slice(0, 14)) list.append(Object.assign(el('a', '', entry.type), {href: docs(entry), target: '_top'}));
    if (entries.length > 14) list.append(el('span', '', `and ${entries.length - 14} more`));
    words.append(list);
    card.append(words);
    kinds.append(card);
  }
  page.append(kinds);
  return page;
}
