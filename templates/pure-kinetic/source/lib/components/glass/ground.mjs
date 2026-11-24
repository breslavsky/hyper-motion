// The Glass family's own ground. A Glass scene does not follow the look of
// the film it stands in: it was drawn for one ground, a deep blue with a
// light ink, and a look's paper, sky or accent gives it a backdrop and an
// ink it was never checked on. Whatever the film's style, a Glass scene
// stands on this ground, unless its colours were chosen on purpose: the
// scene's own `bg` or `fg`, the brand's colour tokens, or a style edited on
// the native host. A photo or a video behind the glass (`background`) is the
// backdrop then, and the ink stays this one.
export const GLASS_GROUND = Object.freeze({
  bg: '#0b0a1a', fg: '#eef0ff', accent: '#b9f3ff',
  // The palette of the `glass` look (compiler/looks): tools/glass-ground.test.mjs holds them equal.
  palette: Object.freeze({paper: '#eef0ff', ink: '#0b0a1a', lime: '#b9f3ff', sage: '#1a1640', peach: '#ff9ad5', electric: '#5b5bff',
    coral: '#ff6fb5', sky: '#0b0a1a', lilac: '#a68bff', butter: '#ffe1a8', brand: '#5b5bff', brand2: '#ff6fb5'}),
});
const BRAND_COLOURS = Object.freeze(['background', 'foreground', 'accent', 'accent2']);
const STYLE_KEYS = Object.freeze(['palette', 'bg', 'fg', 'accent']);

// Whether somebody chose this scene's colours: then they are kept.
export function glassColoursChosen({scene, tokens = {}, style = {}, compiled = {}}) {
  return scene.bg !== undefined || scene.fg !== undefined
    || BRAND_COLOURS.some(key => tokens?.[key] !== undefined)
    || STYLE_KEYS.some(key => style[key] !== undefined && JSON.stringify(style[key]) !== JSON.stringify(compiled[key]));
}

// The colours a Glass scene is mounted with: the family's ground, or the chosen ones (null).
export function glassGround(given) {
  return glassColoursChosen(given) ? null : GLASS_GROUND;
}
