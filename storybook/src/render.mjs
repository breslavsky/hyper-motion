import {words} from './names.mjs';
import {makeFilm} from './model.mjs';
import definitions from '../generated/metadata.mjs';
import {createPreviewController, createVisibilityCoordinator} from './visibility.mjs';
import {backgroundPicker} from './glass-background.mjs';

let playerReady;
export function loadPlayer() {
  if (customElements.get('hyperframes-player')) return Promise.resolve();
  return playerReady ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('pk/hyperframes-player.global.js', document.baseURI).href;
    script.onload = () => customElements.whenDefined('hyperframes-player').then(resolve);
    script.onerror = () => { playerReady = null; reject(new Error('Could not load HyperFrames Player.')); };
    document.head.append(script);
  });
}
export const element = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

function enableSendReplay(player) {
  const preview = player.iframeElement.contentWindow;
  if (!preview.__storybookComponent) {
    preview.addEventListener('pk-preview-mounted', () => {
      if (player.isConnected) enableSendReplay(player);
    }, {once: true});
    return;
  }
  const slot = preview.document.querySelector('.pk-pullback-send');
  const click = preview.__storybookComponent.plan.audioEvents.find(event => event.kind === 'click');
  if (!slot || !click) return;
  const button = preview.document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Replay send');
  button.title = 'Replay send';
  slot.style.position = 'relative';
  Object.assign(button.style, {position: 'absolute', inset: '0', width: '100%', height: '100%',
    padding: '0', border: '0', borderRadius: '50%', background: 'transparent', cursor: 'pointer', pointerEvents: 'auto'});
  button.addEventListener('click', () => {
    player.seek(click.t);
    player.play();
  });
  slot.append(button);
  player.setAttribute('interactive', '');
}

function sequenceContent({globals, example}) {
  if (example) {
    const format = {'16:9': 'landscape', '9:16': 'portrait', '1:1': 'square'}[globals.aspect] ?? globals.aspect ?? 'landscape';
    const variant = example.variants[format];
    if (!variant) throw new Error(`Unknown sequence format: ${format}`);
    return {...variant, recipe: variant.recipe ?? variant.film, steps: variant.phases ?? variant.scenes,
      title: example.name, subtitle: example.continuous ? 'One story · persistent objects and a shared camera' : `${variant.scenes.length} scenes · one timeline`,
      description: example.description, sequence: true, continuous: Boolean(example.continuous), hasAudio: Boolean(example.hasAudio)};
  }
  throw new Error('A sequence story needs its example.');
}

const visibility = createVisibilityCoordinator();
const syncDocumentVisibility = () => visibility.documentVisibility(!document.hidden);
document.addEventListener('visibilitychange', syncDocumentVisibility);
syncDocumentVisibility();

class ComponentStory extends HTMLElement {
  connectedCallback() {
    if (this.started) return;
    this.started = true; this.failed = false; this.dataset.state = 'idle';
    this.mount();
  }
  disconnectedCallback() {
    this.started = false;
    this.release();
  }
  release() {
    clearTimeout(this.timer);
    this.observer?.disconnect(); this.observer = null;
    this.registration?.dispose(); this.registration = null;
    this.controller?.dispose(); this.controller = null;
    this.player?.pause(); this.player?.remove(); this.player = null;
    this.replaceChildren();
  }
  mount() {
    if (this.input.example) return this.mountSequence();
    const {entry, args, globals, storyId, viewMode = 'story'} = this.input;
    this.dataset.viewMode = viewMode;
    const shell = element('main', 'pk-story');
    const heading = element('header', 'pk-heading'), title = element('div');
    // The name as words, and under it the type a film writes.
    title.append(element('h1', '', words(entry.type)), element('p', '', `${entry.type} · ${entry.family} · ${entry.renderMode} · HyperFrames 0.9.19`));
    const status = element('span', 'pk-status', 'Preview');
    status.setAttribute('role', 'status');
    heading.append(title);
    let background;
    if (entry.family === 'glass' && entry.fields.background) {
      const picker = backgroundPicker(storyId, () => {
        this.release(); this.failed = false; this.mount();
      });
      heading.append(picker.controls); background = picker.choice;
    }
    heading.append(status); shell.append(heading); this.append(shell);
    const fail = error => {
      if (this.failed || !this.isConnected) return;
      this.failed = true; status.textContent = 'Check the component settings';
      const message = element('div', 'pk-error', error.message ?? String(error));
      message.setAttribute('role', 'alert'); shell.append(message);
      this.dataset.state = 'error';
    };
    try {
      let effectiveArgs = background ? {...args, background:background.background} : args;
      // A wall plays its own example videos in the places the story's files leave, as a project's does.
      // A laptop plays the clip of the hand that lifts its lid, in the formats that have one.
      const shape = {landscape: '16:9', portrait: '9:16', square: '1:1'}[globals.aspect] ?? globals.aspect ?? '16:9';
      // A laptop with nothing of the story's on its screen plays the sample video.
      if (entry.type === 'laptop3d' && effectiveArgs.image === undefined && effectiveArgs.video === undefined) effectiveArgs = {...effectiveArgs, video: 'assets/glass-street.mp4'};
      if (typeof definitions[entry.type]?.filled === 'function') effectiveArgs = definitions[entry.type].filled(effectiveArgs, shape);
      const film = makeFilm(entry, effectiveArgs, globals);
      const ratio = {'16:9': 16/9, '9:16': 9/16, '1:1': 1}[film.aspect];
      const screen = element('div', 'pk-screen');
      screen.style.setProperty('--pk-player-width', `min(1280px, calc((100vh - 180px) * ${ratio}))`);
      screen.style.setProperty('--pk-player-ratio', String(ratio));
      const placeholder = element('div', 'pk-placeholder', 'The preview will appear here.');
      screen.append(placeholder); shell.append(screen);
      const details = element('details', 'pk-recipe');
      details.append(element('summary', '', 'Component recipe'), element('p', '', 'Use this JSON in Pure Kinetic. Publishing the recipe generates the film’s audio.'), element('pre', '', JSON.stringify(film, null, 2)));
      if (background?.file) details.append(element('p', '', 'For export, place the uploaded file in the project’s assets folder.'));
      shell.append(details);
      this.controller = createPreviewController({
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        releaseInactive: viewMode === 'docs',
        onError: fail,
        mount: async signal => {
          this.dataset.state = 'loading'; status.textContent = 'Loading component…';
          await loadPlayer();
          if (signal.aborted || !this.isConnected) throw new DOMException('Preview no longer visible', 'AbortError');
          return new Promise((resolve, reject) => {
            const player = element('hyperframes-player'); this.player = player;
            let timer, blobUrl, settled = false, destroyed = false;
            const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
            const destroy = () => {
              if (destroyed) return; destroyed = true; cleanup();
              player.pause(); player.remove();
              if (blobUrl) URL.revokeObjectURL(blobUrl);
              if (this.player === player) {
                this.player = null;
                if (this.isConnected && !this.failed) {
                  this.dataset.state = 'idle'; status.textContent = 'Preview';
                  placeholder.hidden = false;
                }
              }
            };
            const rejectMount = error => {
              if (settled) return;
              settled = true; destroy(); reject(error);
            };
            const abort = () => rejectMount(new DOMException('Preview no longer visible', 'AbortError'));
            signal.addEventListener('abort', abort, {once: true});
            player.setAttribute('controls', ''); player.setAttribute('muted', ''); player.setAttribute('loop', '');
            player.setAttribute('runtime-src', new URL('pk/hyperframe.runtime.iife.js', document.baseURI).href);
            player.setAttribute('no-load-timeout', '');
            player.style.aspectRatio = String(ratio);
            player.setAttribute('aria-label', `${entry.type} — ${film.aspect}`);
            player.addEventListener('error', event => {
              const error = new Error(event.detail?.message ?? 'Playback failed.');
              if (!settled) rejectMount(error);
              else if (!destroyed) { destroy(); fail(error); }
            });
            player.addEventListener('ready', () => {
              if (settled || signal.aborted || !this.isConnected) return;
              settled = true; cleanup(); this.dataset.state = 'ready';
              status.textContent = `${player.compositionWidth} × ${player.compositionHeight} · ${player.duration.toFixed(2)} s`;
              if (viewMode === 'story' && entry.type === 'glass-send-prompt' && storyId.endsWith('--send-wave')) enableSendReplay(player);
              resolve({
                get paused() { return player.paused; },
                get currentTime() { return player.currentTime; },
                get duration() { return player.duration; },
                play: () => player.play(), pause: () => player.pause(), seek: at => player.seek(at), destroy,
              });
            }, {once: true});
            const url = new URL('pk/preview.html', document.baseURI); url.hash = encodeURIComponent(JSON.stringify(film));
            if (background?.file) {
              blobUrl = URL.createObjectURL(background.file);
              url.searchParams.set('localBackground',blobUrl);
            }
            player.setAttribute('src', url.href); placeholder.hidden = true; screen.append(player);
            timer = setTimeout(() => rejectMount(new Error('The component did not load within 30 seconds. Check the console and asset paths.')), 30000);
          });
        },
      });
      this.registration = visibility.register(this.controller, {docs: viewMode === 'docs'});
      this.observer = new IntersectionObserver(entries => {
        const current = entries.find(item => item.target === screen);
        if (current) this.registration?.intersection(current.isIntersecting ? current.intersectionRatio : 0);
      }, {threshold: [0, .05, .15, .3, .5, .7, .9, 1]});
      this.observer.observe(screen);
    } catch (error) { fail(error); }
  }
  // A sequence or a continuous story: a built film with its scene list and,
  // for a story with sound, a button that starts the score. It loads at once
  // and is not paused when it leaves the view.
  async mountSequence() {
    const shell = element('main', 'pk-story');
    const heading = element('header', 'pk-heading'), title = element('div');
    title.append(element('h1', '', this.input.example.name));
    const status = element('span', 'pk-status', 'Loading…');
    status.setAttribute('role', 'status');
    heading.append(title, status); shell.append(heading); this.append(shell);
    const fail = message => {
      if (this.failed || !this.isConnected) return;
      this.failed = true;
      clearTimeout(this.timer); status.textContent = 'Check the settings';
      const error = element('div', 'pk-error', message); error.setAttribute('role', 'alert'); shell.append(error);
      this.dataset.state = 'error';
    };
    try {
      const story = sequenceContent(this.input), {recipe} = story;
      shell.classList.toggle('pk-story-sequence', Boolean(story.sequence));
      shell.classList.toggle('pk-story-continuous', story.continuous);
      title.append(element('p', '', story.subtitle));
      if (story.description) shell.append(element('p', 'pk-description', story.description));
      await loadPlayer();
      if (!this.isConnected) return;
      const screen = element('div', 'pk-screen'), player = element('hyperframes-player');
      this.player = player;
      player.setAttribute('controls', ''); player.setAttribute('muted', ''); player.setAttribute('loop', '');
      player.setAttribute('runtime-src', new URL('pk/hyperframe.runtime.iife.js', document.baseURI).href);
      player.setAttribute('no-load-timeout', '');
      const ratio = {'16:9': 16/9, '9:16': 9/16, '1:1': 1}[recipe.aspect];
      player.style.setProperty('--pk-player-width', `min(1280px, calc(max(240px, calc(100vh - var(--pk-preview-reserve, 180px))) * ${ratio}))`);
      player.style.aspectRatio = String(ratio);
      player.setAttribute('aria-label', `${story.title} — ${recipe.aspect}`);
      const sceneButtons = [];
      let soundButton, initialized = false;
      player.addEventListener('error', event => fail(event.detail?.message ?? 'Playback error.'));
      // Audio must be decoded and the first native frame painted before a
      // trusted click can start the full score. Ordinary visual previews keep
      // their existing ready/autoplay behaviour.
      player.addEventListener(story.hasAudio ? 'painted' : 'ready', () => {
        if (!this.isConnected || this.failed || initialized) return;
        initialized = true;
        clearTimeout(this.timer); this.dataset.state = 'ready';
        status.textContent = `${player.compositionWidth} × ${player.compositionHeight} · ${player.duration.toFixed(2)} s`;
        sceneButtons.forEach(button => { button.disabled = false; });
        if (soundButton) soundButton.disabled = false;
        if (story.hasAudio || matchMedia('(prefers-reduced-motion: reduce)').matches) player.seek(story.steps?.[0].at ?? player.duration * .6);
        else player.play();
      });
      const url = new URL(story.url, document.baseURI);
      player.setAttribute('src', url.href); screen.append(player); shell.append(screen);
      this.timer = setTimeout(() => fail('The preview did not load within 30 seconds. Check the console and asset paths.'), 30000);
      if (story.hasAudio) {
        const audio = element('div', 'pk-audio-actions');
        soundButton = element('button', '', 'Play with sound');
        soundButton.type = 'button'; soundButton.disabled = true; soundButton.dataset.action = 'play-with-sound';
        soundButton.addEventListener('click', () => {
          player.pause(); player.seek(0); player.volume = 1; player.muted = false; player.play();
          soundButton.textContent = 'Replay with sound';
        });
        audio.append(soundButton, element('span', '', 'Music and action sounds. Adjust the volume in the player.'));
        shell.append(audio);
      }
      if (story.sequence) {
        const nav = element('nav', 'pk-sequence-nav'); nav.setAttribute('aria-label', story.continuous ? 'Story phases' : 'Film scenes');
        const list = element('ol');
        const transitions = {cut: 'Start', glide: 'Glide', open: 'Open', circle: 'Circle'};
        for (const scene of story.steps) {
          const item = element('li'), button = element('button');
          button.type = 'button'; button.disabled = true; button.dataset.sceneIndex = scene.index;
          button.setAttribute('aria-label', `View ${story.continuous ? 'phase' : 'scene'}: ${scene.label}`);
          button.append(element('strong', '', `${scene.index + 1}. ${scene.label}`),
            element('span', '', `${scene.start.toFixed(1)}–${(scene.start + scene.duration).toFixed(1)} s${story.continuous ? '' : ` · ${transitions[scene.transition] ?? scene.transition}`}`));
          button.addEventListener('click', () => { player.pause(); player.seek(scene.at); });
          sceneButtons.push(button); item.append(button); list.append(item);
        }
        nav.append(list); shell.append(nav);
      }
      const details = element('details', 'pk-recipe');
      details.append(element('summary', '', story.continuous ? 'Continuous story recipe' : story.sequence ? 'Sequence recipe' : 'Component recipe'),
        element('p', '', story.hasAudio ? 'The Folio recipe defines the documents, actions, camera and sound. Rebuild the story and audio tracks together after editing the recipe.' : 'Use this JSON in Pure Kinetic. The soundtrack is built when the recipe is published.'),
        element('pre', '', JSON.stringify(recipe, null, 2)));
      shell.append(details);
    } catch (error) { fail(error.message); }
  }
}
if (!customElements.get('pk-component-story')) customElements.define('pk-component-story', ComponentStory);
export function renderComponent(entry, args, globals, {viewMode = 'story', storyId = entry.type} = {}) {
  const host = document.createElement('pk-component-story');
  host.input = {entry, args, globals, viewMode, storyId}; return host;
}
export function renderSequence(example, globals) {
  const host = document.createElement('pk-component-story'); host.input = {example, globals}; return host;
}
