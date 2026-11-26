// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** Focus pull: blur (in em of the element's own size) that clears as k goes 0 -> 1. */
export const focus = (k, amount = 0.22) => (k >= 0.999 ? "none" : `blur(${((1 - k) * amount).toFixed(4)}em)`);

