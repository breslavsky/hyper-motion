// Pure Kinetic's Metal art direction. The material renderer keeps the upstream
// shader/preset values; these colours belong to the surrounding composition.
const METAL_VARIANTS = Object.freeze(['silver', 'gold', 'chromatic']);

const METAL_LOOK = {
  id: 'metal', name: 'Metal',
  hint: 'Liquid metal: polished silver, warm gold or chromatic reflections; calm type, precise rims and soft depth',
  palette: {
    paper: '#f1f3f5', ink: '#0b0d10', lime: '#c8d4df', sage: '#20252d',
    peach: '#e7c9b1', electric: '#91b2cf', coral: '#c99d8d', sky: '#0b0d10',
    lilac: '#bdc1d1', butter: '#e7ddc9',
  },
  rhythm: ['ink', 'sage', 'ink', 'paper', 'ink', 'sage'],
  opener: 'ink', closer: 'ink', transitions: ['glide', 'open', 'zoom', 'iris', 'glide'],
  text: 'mask', feel: {snap: 0.85, bounce: 0.2, trLength: 1.3, camera: 'settle'},
  display: {family: '"Geist", system-ui, sans-serif', weight: 680, stretch: 100,
    tracking: -0.045, upper: false, lineHeight: 0.96, accent: 'color'},
  typeScale: 0.8, deco: {grain: 0}, track: 'air', bpm: 106,
  material: {type: 'metal', variant: 'silver'},
  // A colour histogram cannot identify reflective material. The agent chooses
  // Metal from the brief; image palette matching must not infer it from grey.
  paletteMatch: false,
};

const VARIANT_PALETTES = {
  gold: {paper: '#fbf3e3', ink: '#100d09', lime: '#eed29a', sage: '#2b2418',
    peach: '#e7b787', electric: '#d4ac64', coral: '#c98f60', sky: '#100d09',
    lilac: '#d5c3af', butter: '#f3dfa9'},
  chromatic: {paper: '#f2eff9', ink: '#0d0b14', lime: '#b4dff0', sage: '#252031',
    peach: '#e2b9d8', electric: '#a9acf0', coral: '#d49cc9', sky: '#0d0b14',
    lilac: '#c6b4eb', butter: '#e5d6bb'},
};

function resolveMetalLook(look, variant = 'silver') {
  if (look.id !== 'metal') return look;
  if (!METAL_VARIANTS.includes(variant)) throw new Error(`metalVariant must be one of ${METAL_VARIANTS.join(', ')}`);
  return {...look, palette: {...look.palette, ...VARIANT_PALETTES[variant]},
    material: {type: 'metal', variant}};
}

module.exports = {METAL_VARIANTS, METAL_LOOK, resolveMetalLook};
