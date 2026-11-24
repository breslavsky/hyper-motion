// Pure Kinetic's glass controls, with an instance-local, seekable animation.
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const px = (value) => `${value}px`;
const progress = (time, at, length) => clamp((time - at) / length);
const spring = (time, frequency, damping) => {
  if (time <= 0) return 0;
  const omega = Math.PI * 2 * frequency;
  const damped = omega * Math.sqrt(1 - damping * damping);
  const value = 1 - Math.exp(-damping * omega * time)
    * (Math.cos(damped * time) + damping * omega / damped * Math.sin(damped * time));
  return value > 1 ? 1 + (value - 1) * 0.5 : value;
};
const expoInOut = (value) => value <= 0 ? 0 : value >= 1 ? 1
  : value < 0.5 ? 2 ** (20 * value - 10) / 2 : (2 - 2 ** (-20 * value + 10)) / 2;

export default function createControls(ctx, data) {
  if (!Array.isArray(data.toggles) || data.toggles.length < 2 || data.toggles.length > 4
      || data.toggles.some((label) => typeof label !== 'string' || !label.trim())) {
    throw new Error('controls requires 2–4 nonempty toggle labels');
  }
  const { safe, type, style, duration } = ctx;
  const scale = ctx.scale ?? Math.min(ctx.width, ctx.height) / 1080;
  const portrait = ctx.height > ctx.width * 1.2;
  const count = data.toggles.length;
  const panelWidth = Math.min(safe.w * 0.96, (portrait ? 900 : 1120) * scale);
  const padding = 48 * scale;
  const innerWidth = panelWidth - 2 * padding;
  const gap = 26 * scale;
  const titleHeight = data.title ? type.lead * 1.42 : 0;
  const sliderHeight = data.slider ? type.body * 1.5 + 68 * scale : 0;
  const extraGaps = (data.title ? gap : 0) + (data.slider ? gap : 0);
  const availableRows = safe.h * 0.94 - padding * 2 - titleHeight - sliderHeight - extraGaps - gap * (count - 1);
  const rowHeight = Math.min((portrait ? 164 : 142) * scale, availableRows / count);
  if (rowHeight < type.label * 1.2) throw new Error('controls has insufficient safe-area height for its rows');
  const panelHeight = padding * 2 + titleHeight + sliderHeight + extraGaps + count * rowHeight + gap * (count - 1);
  const wrapper = ctx.el('div', ctx.root, {
    position: 'absolute', left: px(safe.x + (safe.w - panelWidth) / 2),
    top: px(safe.y + (safe.h - panelHeight) / 2), width: px(panelWidth), height: px(panelHeight),
  });
  const light = ctx.el('div', wrapper, {
    position: 'absolute', left: '4%', top: '0', width: '92%', height: '100%',
    borderRadius: '50%', background: style.accent, filter: `blur(${px(75 * scale)})`, opacity: '0.22',
  });
  const secondaryLight = ctx.el('div', wrapper, {
    position: 'absolute', left: '60%', top: '10%', width: '35%', height: '60%',
    borderRadius: '50%', background: style.palette?.[1] ?? style.accent,
    filter: `blur(${px(65 * scale)})`, opacity: '0.16',
  });
  // Keep the frosted surface on its own layer. Scaling a parent containing
  // rounded controls can leave Chrome's cached shadow raster at the old scale
  // after a reverse seek, despite identical DOM geometry.
  const surface = ctx.el('div', wrapper, {
    position: 'absolute', inset: '0', borderRadius: px(56 * scale),
    background: `linear-gradient(135deg, color-mix(in srgb, ${style.bg} 92%, white), color-mix(in srgb, ${style.bg} 92%, transparent))`,
    border: `${px(2 * scale)} solid color-mix(in srgb, ${style.fg} 24%, transparent)`,
    boxSizing: 'border-box', backdropFilter: `blur(${px(28 * scale)}) saturate(1.35)`,
    boxShadow: `inset 0 ${px(2 * scale)} ${px(2 * scale)} rgba(255,255,255,.2), 0 ${px(30 * scale)} ${px(80 * scale)} rgba(0,0,0,.16)`,
  });
  surface.setAttribute('aria-hidden', 'true');
  const panel = ctx.el('div', wrapper, {
    position: 'absolute', inset: '0', boxSizing: 'border-box',
    border: `${px(2 * scale)} solid transparent`,
  });
  let rowTop = padding;
  if (data.title) {
    const title = ctx.text(panel, data.title, 'lead', {
      position: 'absolute', left: px(padding), top: px(rowTop), color: style.fg,
      lineHeight: '1.1', letterSpacing: '0.04em', textTransform: 'uppercase',
    });
    title.dataset.field = 'title';
    ctx.fit(title, innerWidth, titleHeight, { max: type.lead, min: type.label, wrap: true });
    rowTop += titleHeight + gap;
  }
  const times = data.toggles.map((_, index) => duration * (0.15 + index * 0.43 / Math.max(1, count - 1)));
  const trackHeight = Math.min(90 * scale, rowHeight * 0.78);
  const trackWidth = trackHeight * 1.7;
  const knobDiameter = trackHeight * 0.82;
  const rows = data.toggles.map((name, index) => {
    const y = rowTop + index * (rowHeight + gap);
    const label = ctx.text(panel, name, 'body', {
      position: 'absolute', left: px(padding), top: px(y), color: style.fg,
      lineHeight: '1.18',
    });
    label.dataset.field = `toggles.${index}`;
    ctx.fit(label, innerWidth - trackWidth - gap, rowHeight, { max: type.body, min: type.label, wrap: true });
    label.style.top = px(y + (rowHeight - label.getBoundingClientRect().height) / 2);
    const track = ctx.el('div', panel, {
      position: 'absolute', left: px(panelWidth - padding - trackWidth), top: px(y + (rowHeight - trackHeight) / 2),
      width: px(trackWidth), height: px(trackHeight), borderRadius: px(trackHeight),
      boxShadow: `inset 0 ${px(2 * scale)} ${px(6 * scale)} rgba(0,0,0,.18)`,
    });
    track.dataset.control = `toggles.${index}`;
    const knob = ctx.el('div', track, {
      position: 'absolute', top: px((trackHeight - knobDiameter) / 2),
      width: px(knobDiameter), height: px(knobDiameter), borderRadius: px(knobDiameter),
      background: '#ffffff', boxShadow: `0 ${px(6 * scale)} ${px(16 * scale)} rgba(0,0,0,.28)`,
    });
    return { track, knob, at: times[index] };
  });
  let slider = null;
  const sliderAt = duration * 0.65;
  if (data.slider) {
    rowTop += count * rowHeight + gap * (count - 1) + gap;
    const labelHeight = type.body * 1.5;
    const label = ctx.text(panel, data.slider, 'label', {
      position: 'absolute', left: px(padding), top: px(rowTop),
      color: style.fg, letterSpacing: '0.03em', lineHeight: '1.15',
    });
    label.dataset.field = 'slider';
    ctx.fit(label, innerWidth, labelHeight, { max: type.body, min: type.label, wrap: true });
    const track = ctx.el('div', panel, {
      position: 'absolute', left: px(padding), top: px(rowTop + labelHeight + 12 * scale),
      width: px(innerWidth), height: px(56 * scale), borderRadius: px(28 * scale),
      background: `color-mix(in srgb, ${style.fg} 16%, transparent)`, overflow: 'hidden',
    });
    slider = ctx.el('div', track, {
      position: 'absolute', left: '0', top: '0', height: '100%', width: '12%',
      borderRadius: px(28 * scale), background: style.accent,
    });
    slider.dataset.control = 'slider';
  }
  const tempo = 4 / duration;
  const seedPhase = (Number(ctx.seed) || 0) * 0.731;
  const events = times.map((time, index) => ({ time, kind: 'click', target: `toggles.${index}` }));
  if (slider) events.push({ time: sliderAt, kind: 'sparkle', target: 'slider' });
  return {
    events,
    draw(localSeconds) {
      const local = clamp(localSeconds, 0, duration);
      const elapsed = local * tempo;
      const entry = elapsed >= 1.4 ? 1 : spring(elapsed, 2.4, 0.62);
      panel.style.opacity = String(clamp(elapsed / 0.12));
      surface.style.opacity = panel.style.opacity;
      // Drop the entrance transform after landing so static text does not keep a
      // needless compositing transform across arbitrary timeline seeks.
      panel.style.transform = elapsed >= 1.4 ? 'none'
        : `translateY(${px((1 - entry) * 70 * scale)})`;
      surface.style.transform = elapsed >= 1.4 ? 'none'
        : `translateY(${px((1 - entry) * 70 * scale)})`;
      light.style.transform = `translate(${px(Math.sin(elapsed * 0.4 + seedPhase) * 24 * scale)},${px(Math.cos(elapsed * 0.35 + seedPhase) * 20 * scale)})`;
      secondaryLight.style.transform = `translate(${px(Math.cos(elapsed * 0.3 + seedPhase) * 24 * scale)},${px(Math.sin(elapsed * 0.45 + seedPhase) * 20 * scale)})`;
      for (const row of rows) {
        const since = (local - row.at) * tempo;
        const response = since >= 1.4 ? 1 : spring(since, 2.8, 0.55);
        const stretch = Math.sin(progress(since, 0, 0.25) * Math.PI);
        const knobWidth = knobDiameter * (1 + 0.24 * stretch);
        const pad = (trackHeight - knobDiameter) / 2;
        // Clamp the transient squash inside its rail even at spring overshoot.
        const x = clamp(pad + (trackWidth - knobDiameter - 2 * pad) * response, pad, trackWidth - knobWidth - pad);
        row.knob.style.left = px(x);
        row.knob.style.width = px(knobWidth);
        row.track.style.background = local >= row.at
          ? style.accent : `color-mix(in srgb, ${style.fg} 20%, transparent)`;
      }
      if (slider) slider.style.width = `${(0.12 + 0.7 * expoInOut(progress(local, sliderAt, duration * 0.18))) * 100}%`;
    },
    dispose() { wrapper.remove(); },
  };
}
