// Keep the picture audit's copy and size evidence separate from validated
// single-line paint. A production fitBox alone cannot waive clipping.
import {ellipsisIssues} from './text-overflow-audit.mjs';

export function pictureTextBoxes(found, measured) {
  return found.map(text => {
    const matches = measured.filter(row => row.text === text.text &&
      ['x', 'y', 'w', 'h'].every(key => Math.abs(row.box[key] - text[key]) < .001));
    const match = matches.length === 1 ? matches[0] : null;
    if (!match) return text;
    if (!match.ellipsis) {
      // Vertical font calibration is not valid for a rotated, skewed, reflected
      // or perspective-projected Range rectangle. Missing proof is conservative.
      if (match.inkAxisAligned !== true) return text;
      // A font's Range rectangle includes reserved ascender/descender space.
      // Reveal masks may clip that empty space without cutting any glyph ink.
      const ink = match.inkLines?.filter(rect => [rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) && rect.w > 0 && rect.h > 0);
      if (!ink?.length || !Number.isFinite(match.seen)) return text;
      return {...text, auditBox: union(ink), auditSeen: match.seen, auditInk: ink};
    }
    if (ellipsisIssues(match).length) return text;
    return {...text, auditBox: match.ellipsis.viewport, auditSeen: 1,
      auditInk: match.paintedLines.filter(rect => rect.w > 0 && rect.h > 0)};
  });
}

const union = rects => {
  const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
  return {x, y, w: Math.max(...rects.map(r => r.x + r.w)) - x, h: Math.max(...rects.map(r => r.y + r.h)) - y};
};

export const pictureBounds = text => text.auditBox ?? text;

/** Join animated glyphs without losing any glyph's measured painted bounds. */
export function pictureLines(found) {
  const out = [];
  for (const t of found) {
    const last = out[out.length - 1];
    if (last && t.glyph && last.glyph && Math.abs(t.y - last.y) < t.h * .6 && t.x - (last.x + last.w) < t.h * .9 && t.x >= last.x) {
      last.text += t.x - (last.x + last.w) > t.h * .18 ? ` ${t.text}` : t.text;
      last.w = t.x + t.w - last.x;
      last.h = Math.max(last.h, t.h);
      last.seen = Math.min(last.seen, t.seen); last.over ||= t.over;
      if (last.auditBox && t.auditBox) {
        last.auditBox = union([last.auditBox, t.auditBox]);
        last.auditSeen = Math.min(last.auditSeen, t.auditSeen);
        last.auditInk = [...last.auditInk, ...t.auditInk];
      } else {
        delete last.auditBox; delete last.auditSeen; delete last.auditInk;
      }
    } else out.push({...t});
  }
  return out;
}

export function pictureTextOverlap(a, b) {
  // Unmatched rows retain the original ink approximation. Calibrated rows use
  // their painted lines; ellipsis never collides through its invisible suffix.
  const ink = text => text.auditInk ?? [{x: text.x, y: text.y + text.h * .18, w: text.w, h: text.h * .64}];
  return ink(a).some(x => ink(b).some(y => {
    const area = Math.max(0, Math.min(x.x + x.w, y.x + y.w) - Math.max(x.x, y.x)) *
      Math.max(0, Math.min(x.y + x.h, y.y + y.h) - Math.max(x.y, y.y));
    return area > .3 * Math.min(x.w * x.h, y.w * y.h);
  }));
}
