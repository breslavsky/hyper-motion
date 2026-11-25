// The Kinetic Text family's own ground: black, and the two lights of a sign
// of tubes. A Kinetic Text scene is drawn for the dark, where its letters
// are the light of the frame, and a look's paper or sky gives it a ground it
// was never drawn for. Whatever the film's style, such a scene stands on this
// ground and without the look's decoration, unless its colours were chosen on
// purpose: the scene's own `bg` or `fg`, the brand's colour tokens, or a style
// edited on the native host (the same rule as the Glass family's,
// glass/ground.mjs).
import {glassColoursChosen} from './glass/ground.mjs';

export const KINETIC_GROUND = Object.freeze({
  bg: '#000000', fg: '#f5f5f7', accent: '#9d4dff',
  palette: Object.freeze({paper: '#f5f5f7', ink: '#000000', lime: '#9d4dff', sage: '#16131f', peach: '#ff9ad5', electric: '#9d4dff',
    coral: '#ff6fb5', sky: '#000000', lilac: '#c9a8ff', butter: '#ffe1a8', brand: '#9d4dff', brand2: '#ff6fb5',
    // The two lights of a sign (scenes/text.mjs): one while its words are taken, one standing.
    signTaken: '#ff3fd8', signStanding: '#2fd4ff'}),
});

// The colours a Kinetic Text scene is mounted with: the family's ground, or the chosen ones (null).
export function kineticGround(given) {
  return glassColoursChosen(given) ? null : KINETIC_GROUND;
}
