// "Finish": the last layer of a film on pages of its own (src/finish-examples.mjs).
// Each is a plain HyperFrames composition with the finish mounted from the
// example's recipe; the buttons jump to the moments worth looking at.
import {loadPlayer, element} from './render.mjs';

export function renderFinish(example) {
  const recipe = example.recipe && {width: example.width, height: example.height, fps: 30, duration: example.duration, ...example.recipe};
  const code = recipe
    ? `import {mountFinish} from './<kit>/finish.mjs';\n\nmountFinish(document.getElementById('root'), ${JSON.stringify(recipe, null, 2)}).attach(timeline, 0);`
    : '// Nothing is mounted: this is the page as it was written.';
  const shell = element('main', 'pk-story pk-story-sequence'), heading = element('header', 'pk-heading'), title = element('div');
  title.append(element('h1', '', example.name), element('p', '', `Finish · laid over a page · the same on every render · ${example.width} × ${example.height}`));
  const status = element('span', 'pk-status', 'Loading…');
  status.setAttribute('role', 'status');
  heading.append(title, status);
  shell.append(heading, element('p', 'pk-description', example.description));
  loadPlayer().then(() => {
    const screen = element('div', 'pk-screen'), player = element('hyperframes-player');
    for (const name of ['controls', 'muted', 'loop', 'no-load-timeout']) player.setAttribute(name, '');
    player.setAttribute('runtime-src', new URL('pk/hyperframe.runtime.iife.js', document.baseURI).href);
    player.style.setProperty('--pk-player-width', `min(1280px, calc(max(240px, calc(100vh - var(--pk-preview-reserve, 180px))) * ${example.width / example.height}))`);
    player.style.aspectRatio = String(example.width / example.height);
    player.setAttribute('aria-label', `Finish: ${example.name}`);
    const buttons = [];
    player.addEventListener('ready', () => {
      status.textContent = `${player.compositionWidth} × ${player.compositionHeight} · ${player.duration.toFixed(2)} s`;
      for (const button of buttons) button.disabled = false;
      shell.dataset.state = 'ready';
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) player.seek(example.moments[0].at); else player.play();
    }, {once: true});
    player.addEventListener('error', event => { status.textContent = event.detail?.message ?? 'Playback error.'; shell.dataset.state = 'error'; });
    player.setAttribute('src', new URL(`pk/finish-${example.id}.html`, document.baseURI).href);
    screen.append(player);
    const nav = element('nav', 'pk-sequence-nav'), list = element('ol');
    nav.setAttribute('aria-label', 'Moments of the page');
    example.moments.forEach((moment, index) => {
      const item = element('li'), button = element('button');
      button.type = 'button'; button.disabled = true; button.dataset.moment = String(index);
      button.append(element('strong', '', `${index + 1}. ${moment.label}`), element('span', '', `${moment.at.toFixed(2)} s`));
      button.addEventListener('click', () => { player.pause(); player.seek(moment.at); });
      buttons.push(button); item.append(button); list.append(item);
    });
    nav.append(list);
    const details = element('details', 'pk-recipe');
    details.open = true;
    details.append(element('summary', '', 'The whole finish of this page'), element('p', '', 'Everything the film shows stands inside one element (data-finish), which is what shakes and takes the fringe; the grain, the leak, the vignette and the flash are laid over the root. See components/finish/USAGE.md.'), element('pre', '', code));
    shell.append(screen, nav, details);
  }).catch(error => { status.textContent = error.message; shell.dataset.state = 'error'; });
  // The page's own type and ground, as a component's story has them.
  const page = element('div', 'pk-page');
  page.append(shell);
  return page;
}
