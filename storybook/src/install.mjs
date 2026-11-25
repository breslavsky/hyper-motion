// "Install": how an agent puts the pack into a HyperFrames film of its own.
// The steps are the kit's own (kit/source/lib/USAGE.md), short enough to
// follow without it, and a prompt to hand to an agent as it is.
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

const PROMPT = `Install the Hyper Motion components pack into this HyperFrames project and use it.

1. Get the kit: git clone --depth 1 https://github.com/breslavsky/hyper-motion /tmp/hyper-motion, then copy /tmp/hyper-motion/kit/source/lib into the project's source folder as "kit" (next to index.html). Nothing is installed from npm.
2. See what there is: node kit/scene.cjs --list. For one scene, its fields, limits and a recipe that works: node kit/scene.cjs --list glass-search.
3. Write a recipe (a film of one scene) and build it: node kit/scene.cjs recipe.json. It writes compositions/pk-<id>.html and prints "head", "mount", "duration" and "sounds".
4. Put it on the page: add the "head" lines to <head> once, and "mount" among the film's clips as printed. The page needs GSAP as window.gsap (kit/vendor/gsap/gsap.min.js); a 3D scene also needs <script type="importmap">{"imports":{"three":"./kit/vendor/three/three.module.min.js"}}</script> in <head>.
5. Give the printed "sounds" to the film's soundtrack: the kit plays nothing itself.
6. A recipe the kit cannot draw is refused with the reason. Fix the recipe and build again; do not edit the written file.

Read kit/USAGE.md for the rest: every field of a recipe, and how to lay a glass scene over the film's own footage.`;

const STEPS = [
  ['Get the kit', 'Copy one folder into the film\'s source, next to index.html. Nothing is installed from npm, and nothing is fetched while a film renders but the examples\' own media.',
    'git clone --depth 1 https://github.com/breslavsky/hyper-motion /tmp/hyper-motion\ncp -R /tmp/hyper-motion/kit/source/lib ./kit'],
  ['See what there is', 'Every scene by family, and for one scene its fields, its limits and a recipe that works.',
    'node kit/scene.cjs --list\nnode kit/scene.cjs --list glass-search'],
  ['Write a recipe and build it', 'A recipe is a film of one scene: where it starts, its track, its look and the scene\'s own fields. One the kit cannot draw is refused with the reason.',
    '{"id": "search", "aspect": "9:16", "style": "editorial", "brand": {"name": "Nook"},\n "start": 4.5, "track": 3,\n "scene": {"type": "glass-search", "beats": 6, "query": "Tuesday classes"}}\n\nnode kit/scene.cjs recipe.json'],
  ['Put it on the page', 'The command prints two style sheets for <head> and the host element for the film\'s clips. The page needs GSAP as window.gsap; a 3D scene needs the import map too.',
    '<script src="kit/vendor/gsap/gsap.min.js"></script>\n<script type="importmap">{"imports":{"three":"./kit/vendor/three/three.module.min.js"}}</script>'],
  ['Score it', 'It also prints the scene\'s sound cues with their times in the film (click, type, pop, whoosh, chime). Give them to the film\'s soundtrack: the kit plays nothing itself.', null],
];

export function renderInstall() {
  const page = el('main', 'hm-landing hm-install');
  const hero = el('header', 'hm-hero');
  hero.append(el('p', 'hm-badge', 'For an AI agent'), el('h1', '', 'Install'), el('p', 'hm-facts', 'Five steps into any HyperFrames film. Hand the prompt below to your agent, or follow the steps yourself.'));
  page.append(hero);

  const hand = el('section', 'hm-hand');
  const top = el('div', 'hm-hand-top');
  const copy = el('button', 'hm-button', 'Copy the prompt');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(PROMPT); copy.textContent = 'Copied'; }
    catch { copy.textContent = 'Select the text and copy it'; }
    setTimeout(() => { copy.textContent = 'Copy the prompt'; }, 2200);
  });
  top.append(el('h2', '', 'Paste this to your agent'), copy);
  hand.append(top, el('pre', '', PROMPT));
  page.append(hand);

  const steps = el('ol', 'hm-steps');
  for (const [name, says, code] of STEPS) {
    const step = el('li');
    step.append(el('h3', '', name), el('p', '', says));
    if (code) step.append(el('pre', '', code));
    steps.append(step);
  }
  page.append(steps);

  const more = el('footer', 'hm-foot');
  more.append('The whole of it, with every field of a recipe and glass over your own footage: ',
    Object.assign(el('a', '', 'kit/source/lib/USAGE.md'), {href: 'https://github.com/breslavsky/hyper-motion/blob/main/kit/source/lib/USAGE.md', target: '_blank', rel: 'noopener'}), '.');
  page.append(more);
  return page;
}
