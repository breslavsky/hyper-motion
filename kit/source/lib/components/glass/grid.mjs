// The one grid of the Glass family. Every measure a Glass scene lays its
// panel out by has a name here, and every one is a step of the design system
// (design-system.mjs: the Radix space and type ladders, the card recipe), so
// a panel of steps, a chart and a control panel share their insets, rows and
// gaps by construction. A scene takes its measures from `glassGrid(K)` and
// writes no bare number or multiplier of its own. Lengths are render pixels
// of the scene's frame; `units` holds the same grid in design units.
import {glassPanelWidth} from './layout.mjs';

// Design units. One unit is three render pixels in a 1080-short-side frame.
export const GLASS_UNITS = Object.freeze({
  // The panel: its inset, the gap between its blocks, its corner.
  card: Object.freeze({paddingX: 16, paddingY: 16, gap: 12, radius: 16}),
  // Gaps, smallest first: a label and its value; a mark and its text; the
  // panel's blocks; rows of a list that should breathe; a title and what it
  // heads; columns.
  gap: Object.freeze({hair: 4, item: 8, block: 12, group: 16, section: 24, column: 32}),
  // A single-line row: with the block gap, rows pitch at 44.
  row: 32,
  // A mark that leads a row or a column: a step's number, a status, a bullet.
  mark: Object.freeze({size: 32, radius: 8, stroke: 4 / 3}),
  // A glyph beside a title is the title's own size.
  icon: 24,
  // A box to tick stands beside body text and is sized to it: as tall as a
  // line of that text, its tick three quarters of it, on the mark's stroke.
  check: Object.freeze({size: 24, radius: 6, glyph: 18, stroke: 4 / 3}),
  // How far a part travels as it comes in, hops or settles.
  move: Object.freeze({settle: 4, hop: 8, rise: 12}),
});

// The roles of the type on a panel and how many lines each may take before
// it is set a step smaller. Related text shares one step (design.fitGroup).
export const GLASS_TYPE = Object.freeze({
  title: Object.freeze({role: 'cardTitle', lines: 3}),
  body: Object.freeze({role: 'body', lines: 5}),
  item: Object.freeze({role: 'body', lines: 3}),
  label: Object.freeze({role: 'body', lines: 2}),
  // A mark's figure is a title at its smallest step: five eighths of the mark.
  mark: Object.freeze({role: 'cardTitle', lines: 1, step: 'smallest'}),
});

// A panel is airy when its content has room and dense when it would have to
// be scaled down to fit the frame: the same parts, one gap token smaller.
export const GLASS_DENSITY = Object.freeze({
  airy: Object.freeze({section: 'section', rows: 'group', lead: 'group', columns: 'column', stack: 'block'}),
  dense: Object.freeze({section: 'block', rows: 'item', lead: 'block', columns: 'section', stack: 'item'}),
});

// Seconds of the family's shared moves, before a scene's own retiming.
export const GLASS_TIME = Object.freeze({open: .42, pop: .3, fade: .26, between: .34, hop: .32, stagger: .07});

// Where a panel stands over the picture and how large it is. A Glass scene
// is also an overlay for footage (b-roll): the film names one of nine places
// and one of two sizes, and the family puts the panel there (glass/world.mjs),
// the same for every scene. A small panel is the whole panel at six tenths:
// its type stays readable only while it is set in its role's first step, so
// a small panel takes shorter texts (the scenes' `small` limits).
export const GLASS_PLACES = Object.freeze(['top-left', 'top', 'top-right', 'left', 'middle', 'right', 'bottom-left', 'bottom', 'bottom-right']);
export const GLASS_SIZES = Object.freeze({normal: 1, small: .6});

// The scale of a panel `box` (its width and height in frame pixels at rest)
// and how far its centre is moved from the frame's, so that it stands at
// `place` against the edges of the safe area. A panel wider or taller than
// the safe area is centred on that axis.
export function glassPlacement(K, {place = 'middle', size = 'normal'} = {}, box) {
  if (!GLASS_PLACES.includes(place)) throw new Error(`Glass place must be one of ${GLASS_PLACES.join(', ')}`);
  if (!Object.hasOwn(GLASS_SIZES, size)) throw new Error(`Glass size must be one of ${Object.keys(GLASS_SIZES).join(', ')}`);
  const scale = GLASS_SIZES[size], w = box.w * scale, h = box.h * scale, safe = K.safe;
  const along = (at, start, room, length, whole) => {
    if (length >= room) return start + room / 2 - whole / 2;
    return (at < 0 ? start + length / 2 : at > 0 ? start + room - length / 2 : start + room / 2) - whole / 2;
  };
  const column = place.endsWith('left') ? -1 : place.endsWith('right') ? 1 : 0;
  const row = place.startsWith('top') ? -1 : place.startsWith('bottom') ? 1 : 0;
  return {place, size, scale, dx: along(column, safe.x, safe.w, w, K.W), dy: along(row, safe.y, safe.h, h, K.H), width: w, height: h};
}

// A frame wide enough for columns; a square or tall one stacks its parts.
export const glassWide = K => K.W >= K.H * 1.2;

// The step of the design system's space ladder that measures `value` pixels.
function spaceStep(D, value) {
  for (let step = 1; step <= 9; step++) if (Math.abs(D.space(step) - value) < .01) return step;
  throw new Error(`A Glass gap of ${value}px is no step of the space ladder`);
}

export function glassGrid(K) {
  const D = K.design, unit = D.unit, card = D.box('card');
  const scaled = values => Object.freeze(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value * unit])));
  for (const key of Object.keys(GLASS_UNITS.card)) {
    // The panel's numbers are the card recipe's: a change there is a change here.
    if (Math.abs(card[key] - GLASS_UNITS.card[key] * unit) > 1e-6) throw new Error(`Glass grid: card.${key} is not the card recipe's`);
  }
  const width = glassPanelWidth(K);
  // `step` is the step a role is set in before fitting: its largest, or its
  // smallest for text that is a figure in a box and never the thing read.
  const type = Object.freeze(Object.fromEntries(Object.entries(GLASS_TYPE).map(([name, {role, lines, step}]) => {
    const spec = step === 'smallest' ? D.steps(role).at(-1) : D.type(role);
    return [name, Object.freeze({role, lines, step: spec.step, height: spec.lineHeight * lines, lineHeight: spec.lineHeight, size: spec.size})];
  })));
  return Object.freeze({
    unit, units: GLASS_UNITS, wide: glassWide(K),
    card: scaled(GLASS_UNITS.card), gap: scaled(GLASS_UNITS.gap), mark: scaled(GLASS_UNITS.mark), check: scaled(GLASS_UNITS.check), move: scaled(GLASS_UNITS.move),
    row: GLASS_UNITS.row * unit, icon: GLASS_UNITS.icon * unit,
    // The panel's width and the width of what stands inside its insets.
    width, content: width - 2 * GLASS_UNITS.card.paddingX * unit,
    // The width of one of `count` equal columns across the content.
    column: count => (width - 2 * GLASS_UNITS.card.paddingX * unit - GLASS_UNITS.gap.column * unit * (count - 1)) / count,
    // The width left beside a leading mark in a row.
    beside: (lead = GLASS_UNITS.mark.size * unit, gap = GLASS_UNITS.gap.group * unit) => width - 2 * GLASS_UNITS.card.paddingX * unit - lead - gap,
    // What to add above a lead shorter than a line so it is centred on the first line.
    leadDrop: (lineHeight, lead) => Math.max(0, (lineHeight - lead) / 2),
    // What to add above a text so its first line is centred on a taller lead.
    firstLine: (lineHeight, lead = GLASS_UNITS.mark.size * unit) => Math.max(0, (lead - lineHeight) / 2),
    // The gaps of a density, by what they separate: a title and its body,
    // rows, a row's lead and its text, columns, a column's lead and its text.
    density: name => Object.freeze({
      ...Object.fromEntries(Object.entries(GLASS_DENSITY[name]).map(([part, token]) => [part, GLASS_UNITS.gap[token] * unit])),
      // The step of the space ladder that is the gap between the panel's
      // blocks: a panel declares it (design.surfaceGap) and never writes a
      // bare gap, so the design audit knows the panel's own gap from a drift.
      sectionStep: spaceStep(D, GLASS_UNITS.gap[GLASS_DENSITY[name].section] * unit),
    }),
    type, time: GLASS_TIME,
  });
}
