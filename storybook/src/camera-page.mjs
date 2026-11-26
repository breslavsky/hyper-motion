// "Camera": the shared camera on pages of its own (src/camera-examples.mjs).
// Each is a plain HyperFrames composition whose camera is mounted from the
// example's recipe; the buttons jump to its stops.
import {loadPlayer, element} from './render.mjs';

export function renderCamera(example) {
  const recipe = {width: example.width, height: example.height, ...example.recipe};
  const code = `import {mountCamera} from './<kit>/camera.mjs';\n\nmountCamera(document.getElementById('world'), ${JSON.stringify(recipe, null, 2)}).attach(timeline, 0);`;
  const shell = element('main', 'pk-story pk-story-sequence'), heading = element('header', 'pk-heading'), title = element('div');
  title.append(element('h1', '', example.name), element('p', '', `Camera · one world · one transform · no cuts · ${example.width} × ${example.height}`));
  const status = element('span', 'pk-status', 'Loading…');
  status.setAttribute('role', 'status');
  heading.append(title, status);
  shell.append(heading, element('p', 'pk-description', example.description));
  loadPlayer().then(() => {
    const screen = element('div', 'pk-screen'), player = element('hyperframes-player');
    for (const name of ['controls', 'muted', 'loop', 'no-load-timeout']) player.setAttribute(name, '');
    player.setAttribute('runtime-src', new URL('pk/hyperframe.runtime.iife.js', document.baseURI).href);
    player.style.setProperty('--pk-player-width', `min(1280px, calc(max(240px, calc(100vh - var(--pk-preview-reserve, 180px))) * ${recipe.width / recipe.height}))`);
    player.style.aspectRatio = String(recipe.width / recipe.height);
    player.setAttribute('aria-label', `Camera: ${example.name}`);
    const buttons = [];
    player.addEventListener('ready', () => {
      status.textContent = `${player.compositionWidth} × ${player.compositionHeight} · ${player.duration.toFixed(2)} s`;
      for (const button of buttons) button.disabled = false;
      shell.dataset.state = 'ready';
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) player.seek(recipe.stops[1].at); else player.play();
    }, {once: true});
    player.addEventListener('error', event => { status.textContent = event.detail?.message ?? 'Playback error.'; shell.dataset.state = 'error'; });
    player.setAttribute('src', new URL(`pk/camera-${example.id}.html`, document.baseURI).href);
    screen.append(player);
    const nav = element('nav', 'pk-sequence-nav'), list = element('ol');
    nav.setAttribute('aria-label', 'Camera stops');
    recipe.stops.forEach((stop, index) => {
      const item = element('li'), button = element('button');
      button.type = 'button'; button.disabled = true; button.dataset.stop = String(index);
      button.append(element('strong', '', `${index + 1}. ${stop.look}`), element('span', '', `${stop.at.toFixed(1)} s · fill ${stop.fill}${stop.roll ? ` · roll ${stop.roll}°` : ''}${stop.pull === 0 ? ' · straight' : ''}`));
      button.addEventListener('click', () => { player.pause(); player.seek(stop.at); });
      buttons.push(button); item.append(button); list.append(item);
    });
    nav.append(list);
    const details = element('details', 'pk-recipe');
    details.open = true;
    details.append(element('summary', '', 'The whole camera of this page'), element('p', '', 'The things of the page carry names (data-cam). The route is the stops; the rest rides on it. See components/camera/USAGE.md.'), element('pre', '', code));
    shell.append(screen, nav, details);
  }).catch(error => { status.textContent = error.message; shell.dataset.state = 'error'; });
  // The page's own type and ground, as a component's story has them.
  const page = element('div', 'pk-page');
  page.append(shell);
  return page;
}
