// Pure Kinetic's title gesture, expressed as an isolated, seekable component.
const clamp = (value) => Math.max(0, Math.min(1, value));
const softLand = (value) => {
  const t = clamp(value);
  return (1 - Math.exp(-3.6 * t)) / (1 - Math.exp(-3.6));
};
const graphemes = (text) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);

export default async function createTitle(ctx, data) {
  if (typeof data.text !== "string" || !data.text.replace(/\*/g, "").trim()) {
    throw new Error("title.text must contain visible text.");
  }
  if (data.sub !== undefined && typeof data.sub !== "string") {
    throw new Error("title.sub must be a string.");
  }

  const { root, safe, style, duration } = ctx;
  const plain = data.text.replace(/\*/g, "");
  const hasSub = Boolean(data.sub?.trim());
  const accentFont = style.accentFont ?? style.font;
  const serifAccent = accentFont !== style.font;
  if (serifAccent && data.text.includes("*")) {
    await root.ownerDocument.fonts.load(`italic 400 100px "${accentFont}"`, plain);
  }
  const scale = ctx.scale ?? Math.min(ctx.width, ctx.height) / 1080;
  const wrap = ctx.el("div", root, {
    position: "absolute", left: `${safe.x}px`, top: `${safe.y}px`,
    width: `${safe.w}px`, height: `${safe.h}px`,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: "1",
  });
  let label;
  let labelGlyphs;
  if (hasSub) {
    await root.ownerDocument.fonts.load('520 100px "Geist Mono"', data.sub);
    label = ctx.text(wrap, data.sub, "label", {
      fontFamily: '"Geist Mono", ui-monospace, monospace', fontWeight: "520",
      letterSpacing: "0.16em", lineHeight: "1.2", textTransform: "uppercase",
      textAlign: "center", marginBottom: `${34 * scale}px`, color: style.fg,
      opacity: ".85", flexShrink: "0",
    });
    label.dataset.field = "sub";
    ctx.fit(label, safe.w * .94, safe.h * .16, { max: ctx.type.label, min: ctx.type.label, wrap: true });
    // Preserve the measured block while the typewriter reveals its contents.
    label.style.minHeight = `${label.getBoundingClientRect().height}px`;
    labelGlyphs = graphemes(data.sub);
  }

  const line = ctx.text(wrap, "", "title", {
    textAlign: "center", lineHeight: ".94", textWrap: "balance", color: style.fg,
    flexShrink: "0", overflow: "visible",
  });
  line.dataset.field = "text";
  line.setAttribute("aria-label", plain);
  const glyphs = [];
  let accented = false;
  for (const run of data.text.split(/(\*)/)) {
    if (run === "*") { accented = !accented; continue; }
    for (const word of run.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) {
        ctx.el("span", line, {}, " ");
        continue;
      }
      const wordNode = ctx.el("span", line, {
        display: "inline-block", whiteSpace: "nowrap", position: "relative",
        color: accented ? style.accent : style.fg,
        ...(accented && serifAccent ? {
          fontFamily: `"${accentFont}", serif`, fontStyle: "italic", fontWeight: "400",
          fontStretch: "100%", letterSpacing: "-.015em",
        } : {}),
      });
      // Keep shaping intact for scripts whose letters connect.
      const units = /[\u0590-\u0dff\ufb1d-\ufdff\ufe70-\ufeff]/u.test(word) ? [word] : graphemes(word);
      for (const unit of units) {
        glyphs.push(ctx.el("span", wordNode, {
          display: "inline-block", transformOrigin: "30% 90%", willChange: "transform, opacity",
        }, unit));
      }
    }
  }
  const fitted = ctx.fit(line, safe.w * .94, safe.h * (hasSub ? .53 : .66), {
    max: Math.max(ctx.type.big, 460 * scale), min: ctx.type.title, wrap: true,
  });
  const titleSize = Number.isFinite(fitted) ? fitted : parseFloat(line.style.fontSize);

  // The original's quiet oversized echo appears only when it can be larger
  // than the title. It is decorative and intentionally spans the full frame.
  const ghost = ctx.text(root, plain, "title", {
    position: "absolute", left: "50%", top: "50%", pointerEvents: "none",
    whiteSpace: "nowrap", letterSpacing: "-.06em", lineHeight: "1",
    color: style.fg, opacity: ".05", zIndex: "0", width: "max-content", fontSize: "100px",
  });
  ghost.setAttribute("aria-hidden", "true");
  ghost.dataset.layoutAllowOverflow = "true";
  ghost.dataset.layoutAllowOverlap = "true";
  const ghostCandidate = Math.min(100 * ctx.width * .96 / Math.max(1, ghost.scrollWidth),
    100 * ctx.height * .9 / Math.max(1, ghost.scrollHeight));
  if (ghostCandidate < titleSize * 1.6) {
    // Long titles may wrap in the foreground; their optional unbroken echo
    // must never make otherwise valid content fail the readable-size limit.
    ghost.remove();
  } else {
    ctx.fit(ghost, ctx.width * .96, ctx.height * .9, {
      max: ghostCandidate, min: ctx.type.title, wrap: false,
    });
  }

  // Entrance timing stays recognizable at every duration; short clips compress
  // the gesture enough to leave a readable hold, long clips retain its snap.
  const tempo = Math.min(1, duration / 2);
  const at = .03 * tempo;
  const step = Math.min(.032, .55 / Math.max(1, glyphs.length)) * tempo;
  const landed = at + step * Math.max(0, glyphs.length - 1) + .52 * tempo;
  const draw = (seconds) => {
    const t = Math.max(0, Math.min(duration, seconds));
    glyphs.forEach((node, index) => {
      const since = t - at - index * step;
      const k = softLand(since / (.42 * tempo));
      const lean = Math.sin(clamp((since - .12 * tempo) / (.4 * tempo)) * Math.PI) * .034;
      const settled = since >= .52 * tempo;
      node.style.opacity = String(clamp(since / (.1 * tempo)));
      node.style.transform = settled ? "none" : `translateY(${((1 - k) * .4675 - lean).toFixed(5)}em) rotate(${((1 - k) * -4.8).toFixed(4)}deg)`;
      node.style.willChange = settled ? "auto" : "transform, opacity";
      node.style.filter = k < .97 && since > 0 ? `blur(${((1 - k) * .07).toFixed(5)}em)` : "none";
    });
    if (label) label.textContent = labelGlyphs.slice(0, Math.floor(clamp(t / (.5 * tempo)) * labelGlyphs.length)).join("");
    ghost.style.transform = `translate(-50%, -50%) translateX(${(.06 - .12 * t / duration) * ctx.width}px)`;
  };
  draw(0);
  return { draw, events: [{ time: at, kind: "tick" }, { time: landed, kind: "hit" }] };
}
