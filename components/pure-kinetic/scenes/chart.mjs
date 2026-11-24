// Pure Kinetic's staggered bar growth, separated from its planner and scene engine.
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const px = (value) => `${value}px`;
const spring = (time, frequency = 2.6, damping = 0.62) => {
  if (time <= 0) return 0;
  const omega = Math.PI * 2 * frequency;
  const damped = omega * Math.sqrt(1 - damping * damping);
  const value = 1 - Math.exp(-damping * omega * time)
    * (Math.cos(damped * time) + damping * omega / damped * Math.sin(damped * time));
  return value > 1 ? 1 + (value - 1) * 0.5 : value;
};

/** A responsive bar chart. Negative values require a separate, signed-axis design. */
export default function createChart(ctx, data) {
  if (!Array.isArray(data.labels) || data.labels.length < 2 || data.labels.length > 6
      || !Array.isArray(data.values) || data.values.length !== data.labels.length
      || data.labels.some((label) => typeof label !== 'string' || !label.trim())
      || data.values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('chart requires 2–6 nonempty labels and matching nonnegative finite values');
  }
  const { safe, type, style, duration } = ctx;
  const scale = ctx.scale ?? Math.min(ctx.width, ctx.height) / 1080;
  const portrait = ctx.height > ctx.width * 1.2;
  const narrow = ctx.width < ctx.height * 1.2;
  const count = data.values.length;
  const width = Math.min(safe.w, ctx.width * (narrow ? 0.86 : 0.78));
  const height = Math.min(safe.h - 16 * scale, ctx.height * 0.8);
  const left = safe.x + (safe.w - width) / 2;
  const top = safe.y + (safe.h - height) / 2;
  const wrapper = ctx.el('div', ctx.root, {
    position: 'absolute', left: px(left), top: px(top), width: px(width), height: px(height),
  });
  wrapper.dataset.chartLayout = 'columns';
  const gap = 28 * scale;
  const titleHeight = data.title ? Math.min(height * 0.23, type.title * 2.3) : 0;
  if (data.title) {
    const title = ctx.text(wrapper, data.title, 'title', {
      position: 'absolute', left: '0', top: '0', color: style.fg,
      textAlign: 'center', lineHeight: '1.08',
    });
    title.dataset.field = 'title';
    ctx.fit(title, width, titleHeight, { max: type.title, min: type.label, wrap: true });
  }
  const chartTop = titleHeight + (data.title ? gap : 0);
  const chartHeight = height - chartTop;
  const plot = ctx.el('div', wrapper, {
    position: 'absolute', left: '0', top: px(chartTop), width: px(width), height: px(chartHeight),
  });
  const columnGap = width * 0.03;
  const columnWidth = (width - columnGap * (count - 1)) / count;
  const labelHeight = type.label * 2.5;
  const valueTexts = data.values.map((value) => `${value}${data.suffix ?? ''}`);
  const minimumValueWidth = Math.max(...valueTexts.map((text) => {
    const probe = ctx.text(plot, text, 'label', {
      position: 'absolute', visibility: 'hidden', width: 'max-content',
      fontSize: px(type.label), whiteSpace: 'nowrap', letterSpacing: '0',
      fontVariantNumeric: 'tabular-nums',
    });
    const measured = probe.scrollWidth + 6 * scale;
    probe.remove();
    return measured;
  }));
  // Measure the actual typeface and words, including non-Latin text. Reflow the
  // chart before reducing any label below the shared readability floor.
  let horizontal = portrait || minimumValueWidth > columnWidth;
  if (!horizontal) {
    for (const label of data.labels) {
      const probe = ctx.text(plot, label, 'label', {
        position: 'absolute', visibility: 'hidden', width: px(columnWidth),
        fontSize: px(type.label), lineHeight: '1.18', whiteSpace: 'normal',
        overflowWrap: 'normal', wordBreak: 'normal', letterSpacing: '0',
      });
      horizontal ||= probe.scrollWidth > columnWidth + 1 || probe.scrollHeight > labelHeight + 1;
      probe.remove();
    }
  }
  wrapper.dataset.chartLayout = horizontal ? 'rows' : 'columns';
  const maximum = Math.max(...data.values, 1e-9);
  // A single time domain preserves the spring character at every clip duration.
  const tempo = 4 / duration;
  const starts = data.values.map((_, index) => duration * (0.06 + index * 0.34 / Math.max(1, count - 1)));
  const bars = [];
  if (horizontal) {
    const rowGap = 14 * scale;
    const rowHeight = (chartHeight - rowGap * (count - 1)) / count;
    const labelWidth = width * (narrow ? 0.46 : 0.36);
    const valueWidth = Math.max(width * (portrait ? 0.18 : 0.16), minimumValueWidth);
    const barLeft = labelWidth + gap;
    const barWidth = width - barLeft - valueWidth - gap;
    if (barWidth < type.label) throw new Error('chart values and suffix leave insufficient width for a readable bar');
    const barHeight = Math.min(rowHeight * 0.5, 70 * scale);
    for (let index = 0; index < count; index += 1) {
      const row = ctx.el('div', plot, {
        position: 'absolute', left: '0', top: px(index * (rowHeight + rowGap)),
        width: px(width), height: px(rowHeight),
      });
      const label = ctx.text(row, data.labels[index], 'body', {
        position: 'absolute', left: '0', top: '50%', color: style.fg,
        transform: 'translateY(-50%)', lineHeight: '1.18', letterSpacing: '0',
      });
      label.dataset.field = `labels.${index}`;
      ctx.fit(label, labelWidth - 3 * scale, rowHeight, { max: type.body, min: type.label, wrap: true });
      label.style.width = px(labelWidth);
      const bar = ctx.el('div', row, {
        position: 'absolute', left: px(barLeft), top: px((rowHeight - barHeight) / 2),
        width: '0', height: px(barHeight), borderRadius: px(barHeight * 0.18),
        background: data.values[index] === maximum ? style.accent : style.fg,
        opacity: data.values[index] === maximum ? '1' : '0.85',
      });
      const value = ctx.text(row, valueTexts[index], 'body', {
        position: 'absolute', left: px(width - valueWidth), top: '50%', color: style.fg,
        transform: 'translateY(-50%)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', letterSpacing: '0',
      });
      value.dataset.field = `values.${index}`;
      ctx.fit(value, valueWidth - 3 * scale, rowHeight, { max: type.body, min: type.label, wrap: false });
      value.style.width = px(valueWidth);
      bars.push({ bar, value, extent: barWidth * data.values[index] / maximum, at: starts[index] });
    }
  } else {
    const valueHeight = type.body * 1.3;
    const barBottom = labelHeight + 16 * scale;
    const barHeight = Math.max(0, chartHeight - barBottom - valueHeight - 18 * scale);
    for (let index = 0; index < count; index += 1) {
      const x = index * (columnWidth + columnGap);
      const bar = ctx.el('div', plot, {
        position: 'absolute', left: px(x), bottom: px(barBottom), width: px(columnWidth),
        height: '0', borderRadius: `${px(columnWidth * 0.12)} ${px(columnWidth * 0.12)} 0 0`,
        background: data.values[index] === maximum ? style.accent : style.fg,
        opacity: data.values[index] === maximum ? '1' : '0.85',
      });
      const value = ctx.text(plot, valueTexts[index], 'body', {
        position: 'absolute', left: px(x), bottom: px(barBottom), color: style.fg,
        textAlign: 'center', fontVariantNumeric: 'tabular-nums', letterSpacing: '0',
      });
      value.dataset.field = `values.${index}`;
      ctx.fit(value, columnWidth, valueHeight, { max: type.body, min: type.label, wrap: false });
      const label = ctx.text(plot, data.labels[index], 'label', {
        position: 'absolute', left: px(x), bottom: '0', color: style.fg,
        textAlign: 'center', lineHeight: '1.18', letterSpacing: '0',
      });
      label.dataset.field = `labels.${index}`;
      ctx.fit(label, columnWidth, labelHeight, { max: type.label, min: type.label, wrap: true });
      bars.push({ bar, value, extent: barHeight * data.values[index] / maximum, at: starts[index], barBottom });
    }
  }
  return {
    events: starts.map((time, index) => ({ time, kind: 'tick', target: `values.${index}` })),
    draw(localSeconds) {
      const local = clamp(localSeconds, 0, duration);
      for (const item of bars) {
        const elapsed = (local - item.at) * tempo;
        const growth = local >= duration * 0.92 ? 1 : clamp(spring(elapsed), 0, 1.035);
        if (horizontal) item.bar.style.width = px(item.extent * growth);
        else {
          item.bar.style.height = px(item.extent * growth);
          item.value.style.bottom = px(item.barBottom + item.extent * growth + 8 * scale);
        }
        item.value.style.opacity = String(clamp(elapsed / 0.15));
      }
    },
    dispose() { wrapper.remove(); },
  };
}
