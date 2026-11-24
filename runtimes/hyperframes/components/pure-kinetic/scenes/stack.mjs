// Standalone version of Pure Kinetic's successive, emphatic word stack.
const clamp = (value) => Math.max(0, Math.min(1, value));
const expoOut = (value) => value >= 1 ? 1 : 1 - 2 ** (-10 * clamp(value));

export default function createStack(ctx, data) {
  if (!Array.isArray(data.words) || data.words.length < 2 || data.words.length > 4 ||
      data.words.some((word) => typeof word !== "string" || !word.trim())) {
    throw new Error("stack.words must contain two to four nonempty strings.");
  }
  const { root, safe, style, duration } = ctx;
  const scale = ctx.scale ?? Math.min(ctx.width, ctx.height) / 1080;
  const gap = 6 * scale;
  const wrap = ctx.el("div", root, {
    position: "absolute", left: `${safe.x}px`, top: `${safe.y}px`,
    width: `${safe.w}px`, height: `${safe.h}px`,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: `${gap}px`,
  });
  // Reserve room for the 1.15x entrance overshoot. A phrase may wrap, but
  // every item keeps one shared type size within its allocated height budget.
  const lineWidth = safe.w * .81;
  const lineHeight = (safe.h * .82 - gap * (data.words.length - 1)) / data.words.length;
  const lines = data.words.map((word, index) => {
    const node = ctx.text(wrap, word, "title", {
      color: style.fg, textAlign: "center", textWrap: "balance", lineHeight: ".94",
      transformOrigin: "50% 56%", flexShrink: "0", overflow: "visible",
    });
    node.dataset.field = `words[${index}]`;
    return node;
  });
  const sizes = lines.map((node) => {
    const size = ctx.fit(node, lineWidth, lineHeight, {
      max: Math.max(ctx.type.big, 520 * scale), min: ctx.type.title, wrap: true,
    });
    return Number.isFinite(size) ? size : parseFloat(node.style.fontSize);
  });
  const size = Math.min(...sizes);
  for (const node of lines) node.style.fontSize = `${size}px`;

  // Finish the complete phrase early enough for a readable hold. Four-second
  // scenes settle by 1.9 s; short scenes compress the same gesture, while long
  // scenes retain a deliberate cadence without delaying the final word.
  const tempo = Math.min(1, duration / 4);
  const entrance = .3 * tempo;
  const at = .06 * tempo;
  const finalLanding = Math.min(duration * .475, 2.8);
  const step = Math.min(duration / 4, duration * .8 / lines.length,
    (finalLanding - entrance - at) / (lines.length - 1));
  const times = lines.map((_, index) => at + index * step);
  const draw = (seconds) => {
    const t = Math.max(0, Math.min(duration, seconds));
    lines.forEach((node, index) => {
      const since = t - times[index];
      const k = expoOut(since / entrance);
      const dim = index < lines.length - 1 && t >= times[index + 1];
      node.style.opacity = String(clamp(since / (.05 * tempo)) * (dim ? .26 : 1));
      // A settled line leaves the compositor transform layer. Identity
      // transforms can rasterize differently after a scene is hidden/reused.
      node.style.transform = since >= entrance ? "none" : `scale(${(1.15 - .15 * k).toFixed(5)})`;
      node.style.color = index === lines.length - 1 && since >= 0 ? style.accent : style.fg;
    });
  };
  draw(0);
  return {
    draw,
    events: times.map((time, index) => ({ time, kind: index === times.length - 1 ? "hit" : "tick" })),
  };
}
