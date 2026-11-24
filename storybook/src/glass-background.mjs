const samples = {
  image: {image: 'assets/glass-bahamas.webp'},
  video: {video: 'assets/glass-street.mp4'},
};

// The Storybook manager survives preview navigation. Keep the selected File
// in memory per story and mint a blob URL only while its player is mounted.
let session = window;
try {
  if (window.parent.location.origin === location.origin) session = window.parent;
} catch { /* A cross-origin embed keeps its selections in this document. */ }
const choices = session[Symbol.for('pure-kinetic.story-backgrounds')] ??= new Map();

export function backgroundPicker(storyId, remount) {
  const choice = choices.get(storyId);
  const controls = document.createElement('div'); controls.className = 'pk-background';
  const label = document.createElement('label'); label.textContent = 'Background ';
  const select = document.createElement('select');
  for (const [value, title] of [['component','From recipe'], ['image','Photo'], ['video','Video']]) {
    select.add(new Option(title,value));
  }
  if (choice?.file) select.add(new Option(choice.file.name,'file'));
  select.value = choice?.kind ?? 'component';
  select.onchange = () => {
    if (select.value === 'component') choices.delete(storyId);
    else choices.set(storyId, {kind: select.value, background: samples[select.value]});
    remount();
  };
  label.append(select);
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'image/*,video/*'; fileInput.hidden = true;
  const browse = document.createElement('button'); browse.type = 'button';
  browse.textContent = 'Upload file…'; browse.onclick = () => fileInput.click();
  const error = document.createElement('span'); error.setAttribute('role','alert');
  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const kind = file.type.split('/')[0];
    if (!Object.hasOwn(samples, kind)) {
      error.textContent = 'Choose an image or video file.'; return;
    }
    const asset = 'assets/' + encodeURIComponent(file.name);
    choices.set(storyId, {kind:'file', file, asset, background:{[kind]:asset}});
    remount();
  };
  controls.append(label,browse,fileInput,error);
  return {controls,choice};
}
