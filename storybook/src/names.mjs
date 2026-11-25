// A scene is named as a film writes it (`glass-send-prompt`); a page shows
// that name as words, for reading. Only what is shown changes: the scene's
// type, its story id and its link stay the name a film writes.
const SPELT = {ui: 'UI', '3d': '3D', ai: 'AI', b: 'B'};
export const isSceneName = name => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(name));
export const words = name => String(name).replace(/(\D)(3d)$/i, '$1-$2').split('-')
  .map(word => SPELT[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
