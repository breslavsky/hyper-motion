/*
 * Modified from HyperFrames Registry chart-story.html (Apache-2.0).
 * Preserved: staggered baseline bars, length-timed line/area, sequential donut
 * sweep, progress fills and the authored-frame exact-value pop/settle callout.
 * Modified: native instance clock, shared brand/type tokens, three-format HTML
 * labels, strict data validation, and truthful zero/tiny-value geometry.
 * Source, attribution and license: ../upstream/hyperframes-registry-01/RECEIPT.json
 * and ../upstream/hyperframes-registry-01/LICENSE.
 */
import metadata from '../../metadata.mjs';
import {createDesignSystem} from '../../design-system.mjs';

const NS = 'http://www.w3.org/2000/svg';
const clamp = value => Math.max(0, Math.min(1, value));
const progress = (time, start, duration) => duration > 0 ? clamp((time - start) / duration) : Number(time >= start);
const out = value => 1 - (1 - clamp(value)) ** 3;
const back = value => {const x = clamp(value) - 1;return 1 + 2.7 * x ** 3 + 1.7 * x ** 2;};
const svgNode = (parent, name, attributes = {}) => {
  const node = parent.ownerDocument.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  parent.appendChild(node);return node;
};
const attr = (node, values) => {for (const [key, value] of Object.entries(values)) node.setAttribute(key, String(value));};

function chartStory({p, cam, fg, accent, K}) {
  const s = p.scene, errors = metadata['chart-story'].validate?.(s) ?? [];
  if (errors.length) throw new Error(`chart-story: ${errors.join('; ')}`);
  const {W, H, S, safe, el, set, px, alpha, textOn} = K;
  const D = createDesignSystem(K), space = D.space, badgeBox=D.box('badge',{density:'compact'});
  const mode = s.chart ?? 'bars', items = s.items, n = items.length, unit = s.unit ?? '', chosen = (s.emphasize ?? n) - 1;
  const duration = p.ldur ?? p.dur, clock = metadata['chart-story'].times(s, duration, p.beatLen);
  const size = D.type('label').size, gap = space(2), wide = W > H * 1.25;
  const maximum = Math.max(...items.map(item => item.value)) || 1, total = items.reduce((sum, item) => sum + item.value, 0);
  const denominator = mode === 'donut' ? total : mode === 'progress' && unit.trim() === '%' ? Math.max(100, maximum) : maximum;
  const displays = items.map(item => String(item.value) + unit);
  const root = el('div', '', cam);
  Object.assign(root.dataset, {registryItem: 'chart-story', registryMode: mode, registryValues: JSON.stringify(items.map(item => item.value)), registryEmphasize: String(chosen + 1)});
  set(root, {position: 'absolute', inset: '0', color: fg});
  const box = (node, x, y, w, h) => set(node, {position: 'absolute', left: px(x), top: px(y), width: px(w), ...(h === undefined ? {} : {height: px(h)})});
  const role = (node, name, index) => {node.dataset.registryRole = name;if (index !== undefined) node.dataset.registryIndex = String(index + 1);return node;};
  const label = (copy, parent, name, index) => {
    const node = role(el('div', '', parent, copy), name, index);
    const textRole = name === 'title' ? 'sceneTitle' : name === 'value' ? 'value' : name === 'callout-value' ? 'calloutValue' : 'label';
    D.apply(node, textRole);
    set(node, {color: fg, overflowWrap: 'normal', whiteSpace: /^(value|calloutValue)$/.test(textRole) ? 'nowrap' : 'normal'});
    if(name==='label'||name==='callout-label')D.truncateLine(node);
    return node;
  };
  const fit = (node, width, height) => {
    if(node.dataset.designOverflow==='ellipsis'){
      set(node,{width:px(width),height:'auto'});return;
    }
    return D.fit(node, {role: node.dataset.designRole, w: width, h: height,
      wrap: /^(value|calloutValue)$/.test(node.dataset.designRole) ? 'nowrap' : 'normal'});
  };
  const title = s.title ? label(s.title, root, 'title') : null;
  let titleH = 0;
  if (title) {
    box(title, safe.x, safe.y, safe.w);
    fit(title, safe.w, D.type('sceneTitle').lineHeight * 3);
    titleH = title.scrollHeight + space(3);
  }
  const contentY = safe.y + titleH, contentH = safe.h - titleH;
  const colours = items.map((_, i) => i === chosen ? accent : alpha(fg, [.92, .76, .62, .5, .4][i]));
  const entries = items.map((item, i) => {
    const entry = el('div', '', root);entry.dataset.registryLegend = String(i + 1);
    const mark = label(String(i + 1), entry, 'key', i), name = label(item.label, entry, 'label', i), value = label(displays[i], entry, 'value', i);
    value.dataset.registryExactValue = String(item.value);value.dataset.registryUnit = unit;
    set(value, {fontVariantNumeric: 'tabular-nums'});
    set(mark, {color: fg, borderLeft: `${px(2 * D.unit)} solid ${colours[i]}`, paddingLeft: px(space(1))});
    return {entry, mark, name, value};
  });
  const shapes = [], tickLabels = [];
  let svg, axis, line, lineLength = 0, area, ringTrack;
  let callout, calloutValue;
  let chartX = safe.x, chartY = contentY, chartW = safe.w, chartH = contentH;

  // The HTML ledger keeps exact numeric values and full label DOM text.
  // Compact names use one clipped line at the shared label size.
  function layoutLedger(x, y, width, columns, inline = false, highlight = false) {
    const cellW = (width - gap * (columns - 1)) / columns, keyW = size + space(1), heights = [];
    const valueW = inline ? Math.max(...entries.map(row => {set(row.value, {width: 'max-content'});return row.value.offsetWidth;})) : 0;
    const rowGap = inline ? space(1) : gap;
    let fractures = 0;
    for (const [index, row] of entries.entries()) {
      const inset = inline && highlight && index === chosen ? space(1) : 0;
      const textW = cellW - keyW - space(1) - (inline ? valueW + 3 * space(1) : 0);
      box(row.entry, 0, 0, cellW);
      box(row.mark, 0, inset, keyW);
      box(row.name, keyW + space(1), inset, textW);
      box(row.value, inline ? cellW - valueW - space(1) : keyW + space(1), inset, inline ? valueW : textW);
      // Exact values still determine capacity; compact names intentionally
      // ellipsize without forcing a different chart layout or smaller type.
      row.name.style.overflowWrap = 'normal';row.value.style.whiteSpace = 'nowrap';
      fractures += Number(row.value.scrollWidth > (inline ? valueW : textW) + 1);
      const nameH = row.name.scrollHeight;
      if (inline) heights.push(Math.max(nameH, row.value.scrollHeight) + 2 * inset);
      else {set(row.value, {top: px(nameH + space(1))});heights.push(nameH + space(1) + row.value.scrollHeight);}
    }
    let cursor = y;
    for (let start = 0; start < n; start += columns) {
      const height = Math.max(...heights.slice(start, start + columns));
      for (let index = start; index < Math.min(start + columns, n); index++) box(entries[index].entry, x + (index - start) * (cellW + gap), cursor, cellW, height);
      cursor += height + rowGap;
    }
    return {height: cursor - y - rowGap, fractures};
  }
  const makeCallout = (parent, availableWidth) => {
    const holder = role(el('div', '', parent), 'callout');
    set(holder, {background: accent, color: textOn(accent), boxSizing: 'border-box', transformOrigin: '50% 100%'});
    D.surface(holder,'badge',{density:'compact'});
    set(holder,{display:'flex',flexDirection:'column'});
    const value = label(displays[chosen], holder, 'callout-value', chosen);
    set(value, {color: textOn(accent), textAlign: 'center', fontVariantNumeric: 'tabular-nums'});
    value.dataset.registryExactValue = String(items[chosen].value);value.dataset.registryUnit = unit;
    // Measure the loaded brand font, including the unit. Character-count
    // estimates under-reserve wide glyphs such as the percent sign.
    set(value, {width: 'max-content'});
    const width = Math.min(availableWidth, Math.max(space(8), value.scrollWidth + 2 * badgeBox.paddingX));
    box(holder, 0, 0, width);fit(value, width - 2 * badgeBox.paddingX, D.type('calloutValue').lineHeight);
    return {holder, value, width, height: value.scrollHeight + 2 * badgeBox.paddingY};
  };
  if (mode === 'progress') {
    const rowGap = space(1), trackH = space(1);
    const valueW = Math.max(...entries.map(row => {set(row.value, {width: 'max-content'});return row.value.offsetWidth;})) + 2 * badgeBox.paddingX;
    const nameW = safe.w - valueW - space(2);
    if (nameW <= 0) throw new Error('chart-story: exact values leave no room for progress labels');
    const minimumRows = entries.map((row, i) => {
      box(row.name, 0, 0, nameW);
      return Math.max(row.name.scrollHeight, D.type('value').lineHeight + (i === chosen ? 2 * space(1) : 0)) + trackH + space(1);
    });
    const extra = contentH - rowGap * (n - 1) - minimumRows.reduce((sum, height) => sum + height, 0);
    if (extra < -1) throw new Error('chart-story: progress rows need more vertical room');
    svg = svgNode(root, 'svg', {width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true'});box(svg, 0, 0, W, H);
    // Graphics sit behind the label and callout DOM, not over their paint.
    root.insertBefore(svg, entries[0].entry);
    let cursorY = contentY;
    for (const [i, row] of entries.entries()) {
      const y = cursorY, rowH = minimumRows[i] + Math.max(0, extra) / n, textH = rowH - trackH - space(1);
      cursorY += rowH + rowGap;
      box(row.entry, safe.x, y, safe.w, rowH);row.mark.style.display = 'none';
      box(row.name, 0, 0, nameW);fit(row.name, nameW, textH);
      box(row.value, safe.w - valueW, 0, valueW);fit(row.value, valueW, textH - (i === chosen ? 2 * space(1) : 0));
      set(row.value, {textAlign: 'right'});
      if (i === chosen) {
        callout = role(el('div', '', row.entry), 'callout');
        box(callout, safe.w - valueW, 0, valueW, textH);set(callout, {background: accent, transformOrigin: '100% 50%'});
        D.surface(callout,'badge',{density:'compact',layout:'absolute'});
        callout.appendChild(row.value);D.surfaceContent(callout,row.value);
        box(row.value, badgeBox.paddingX, badgeBox.paddingY, valueW - 2 * badgeBox.paddingX);
        fit(row.value, valueW - 2 * badgeBox.paddingX, textH - 2 * badgeBox.paddingY);set(row.value, {color: textOn(accent), textAlign: 'center'});calloutValue = row.value;
        callout.style.height = px(row.value.scrollHeight + 2 * badgeBox.paddingY);
      }
      const yy = y + rowH - trackH;
      svgNode(svg, 'rect', {x: safe.x, y: yy, width: safe.w, height: trackH, rx: trackH / 2, fill: alpha(fg, .12)});
      const fraction = items[i].value / denominator;
      const node = svgNode(svg, 'rect', {x: safe.x, y: yy, width: 0, height: trackH, rx: 0, fill: i === chosen ? accent : alpha(fg, .58)});
      shapes.push({node, index: i, fraction, width: safe.w * fraction, height: trackH});
    }
  } else {
    let wideLedger;
    if (wide) {
      chartW = safe.w * .61;
      let width = safe.w - chartW - gap, layout = layoutLedger(0, 0, width, 1), inline = false;
      if (layout.height > contentH + 1 || layout.fractures) {
        // Five long rows use a wider inline ledger instead of smaller text.
        chartW = safe.w * .42;width = safe.w - chartW - gap;inline = true;
        layout = layoutLedger(0, 0, width, 1, true);
      }
      if (layout.height > contentH + 1 || layout.fractures) throw new Error('chart-story: supplied legend cannot fit whole words and exact values');
      wideLedger = {width, height: layout.height, inline};
    }
    const chip = makeCallout(root, chartW * .88), chipW = chip.width;
    callout = chip.holder;calloutValue = chip.value;
    let headH = chip.height + space(2), ledgerCallout = false;
    if (wide) {
      layoutLedger(safe.x + chartW + gap, contentY + (contentH - wideLedger.height) / 2, wideLedger.width, 1, wideLedger.inline);
    } else {
      const candidates = Array.from({length: Math.min(3, n)}, (_, i) => ({columns: i + 1, inline: false, ...layoutLedger(safe.x, 0, safe.w, i + 1)}));
      candidates.push({columns: 1, inline: true, ...layoutLedger(safe.x, 0, safe.w, 1, true, true)});
      const fitting = candidates.filter(candidate => !candidate.fractures && contentH - candidate.height - gap >= headH + 110 * S);
      const compact = candidates.find(candidate => candidate.inline && !candidate.fractures && contentH - candidate.height - gap >= 110 * S);
      // Among layouts with room for the chart, whole words/values come first;
      // then choose the shortest ledger. No scene-specific label exceptions.
      if (!fitting.length && !compact) throw new Error('chart-story: supplied legend cannot fit whole words and exact values');
      const choice = (fitting.length ? fitting : [compact]).sort((a, b) => a.height - b.height || a.columns - b.columns)[0];
      chartH = contentH - choice.height - gap;
      layoutLedger(safe.x, contentY + chartH + gap, safe.w, choice.columns, choice.inline, choice.inline);
      if (!fitting.length && compact) {
        // Dense square frames emphasize the existing ledger value. Reusing that
        // text frees the redundant callout header without shrinking any role.
        const value = entries[chosen].value, x = parseFloat(value.style.left), width = value.offsetWidth;
        calloutValue.remove();entries[chosen].entry.appendChild(callout);callout.appendChild(value);
        box(callout, x - badgeBox.paddingX, 0, width + 2 * badgeBox.paddingX, value.scrollHeight + 2 * badgeBox.paddingY);
        set(value, {position: 'relative', left: '0', top: '0', color: textOn(accent), textAlign: 'center'});
        calloutValue = value;headH = 0;ledgerCallout = true;
        root.dataset.registryCalloutPlacement = 'ledger';
      }
    }
    if (chartH < headH + 110 * S) throw new Error('chart-story: supplied data leaves no readable chart area');
    if (mode === 'donut') {
      const diameter = Math.min(chartW, chartH), cx = chartX + chartW / 2, cy = chartY + chartH / 2;
      svg = svgNode(root, 'svg', {viewBox: '0 0 560 560', width: diameter, height: diameter, 'aria-hidden': 'true'});box(svg, cx - diameter / 2, cy - diameter / 2, diameter, diameter);
      const radius = 185, stroke = 54;
      ringTrack = svgNode(svg, 'circle', {cx: 280, cy: 280, r: radius, fill: 'none', stroke: alpha(fg, .12), 'stroke-width': stroke});
      const polar = degrees => {const angle = (degrees - 90) * Math.PI / 180;return [280 + radius * Math.cos(angle), 280 + radius * Math.sin(angle)];};
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const fraction = items[i].value / total, start = sum * 360;sum += fraction;
        const end = sum * 360, a = polar(start), b = polar(end), middle = polar(start + (end - start) / 2);
        const d = fraction === 0 ? `M${a[0]} ${a[1]}` : fraction >= 1 - 1e-12
          ? `M${a[0]} ${a[1]} A${radius} ${radius} 0 0 1 ${middle[0]} ${middle[1]} A${radius} ${radius} 0 0 1 ${b[0]} ${b[1]}`
          : `M${a[0]} ${a[1]} A${radius} ${radius} 0 ${fraction > .5 ? 1 : 0} 1 ${b[0]} ${b[1]}`;
        const node = svgNode(svg, 'path', {d, fill: 'none', stroke: colours[i], 'stroke-width': stroke, 'stroke-linecap': 'butt'}), length = node.getTotalLength();
        attr(node, {'stroke-dasharray': `${length} ${length || 1}`, 'stroke-dashoffset': length});
        shapes.push({node, index: i, fraction, length});
      }
      if (!ledgerCallout) {
      const inner = diameter * .37;
      calloutValue.style.width = px(Math.max(space(5), inner - 2 * badgeBox.paddingX));
      const calloutLabel = label(items[chosen].label, callout, 'callout-label', chosen);
      set(calloutLabel, {color: textOn(accent), textAlign: 'center', marginTop: '0', whiteSpace: 'nowrap'});
      calloutLabel.style.width = px(Math.max(space(5), inner - 2 * badgeBox.paddingX));
      // This compact duplicate uses the same single-line label policy as its
      // ledger entry; exact values remain untruncated in the separate value.
      const centerLabelFits = inner - 2 * badgeBox.paddingX > 0;
      if (!centerLabelFits) calloutLabel.remove();
      const centerH = calloutValue.scrollHeight + (centerLabelFits ? calloutLabel.scrollHeight + badgeBox.gap : 0) + 2 * badgeBox.paddingY;
      if (centerH <= inner && calloutValue.scrollWidth <= inner - 2 * badgeBox.paddingX + 1) {
        box(callout, cx - inner / 2, cy - centerH / 2, inner, centerH);set(callout, {transformOrigin: '50% 50%'});
      } else {
        // Long exact values keep their full spelling in a separate header chip.
        calloutLabel.remove();
        fit(calloutValue, chipW - 2 * badgeBox.paddingX, D.type('calloutValue').lineHeight);
        if (diameter + gap + chipW <= chartW) {
          const left = chartX + (chartW - diameter - gap - chipW) / 2;
          box(svg, left, chartY + (chartH - diameter) / 2, diameter, diameter);
          box(callout, left + diameter + gap, chartY + (chartH - chip.height) / 2, chipW, chip.height);
        } else {
          box(callout, chartX + (chartW - chipW) / 2, chartY, chipW, chip.height);
          const small = Math.min(chartW, chartH - headH);
          box(svg, chartX + (chartW - small) / 2, chartY + headH + (chartH - headH - small) / 2, small, small);
        }
      }
      }
    } else {
      chartY += headH;chartH -= headH;
      // Plot directly in render pixels. A stretched 1000x560 viewBox turned the
      // line's circular points into ellipses and changed stroke weights by format.
      svg = svgNode(root, 'svg', {viewBox: `0 0 ${chartW} ${chartH}`, width: chartW, height: chartH, 'aria-hidden': 'true'});box(svg, chartX, chartY, chartW, chartH);
      const left = chartW * .08, right = chartW * .92;
      const base = chartH - D.type('label').lineHeight - space(1), top = Math.min(space(4), base * .22), band = (right - left) / n;
      axis = svgNode(svg, 'path', {d: `M${left} ${base}H${right}`, fill: 'none', stroke: alpha(fg, .32), 'stroke-width': D.unit});
      const axisLength = axis.getTotalLength();attr(axis, {'stroke-dasharray': axisLength, 'stroke-dashoffset': axisLength});axis.dataset.registryLength = String(axisLength);
      const points = items.map((item, i) => ({x: mode === 'line' ? left + (right - left) * i / (n - 1) : left + band * (i + .5), y: base - (item.value / maximum) * (base - top)}));
      if (mode === 'line') {
        const d = points.map((point, i) => `${i ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
        area = svgNode(svg, 'path', {d: `${d} L${right} ${base} L${left} ${base}Z`, fill: accent, opacity: 0});area.dataset.registryRole = 'line-area';
        line = svgNode(svg, 'path', {d, fill: 'none', stroke: alpha(fg, .82), 'stroke-width': 2 * D.unit, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'});
        lineLength = line.getTotalLength();attr(line, {'stroke-dasharray': `${lineLength} ${lineLength}`, 'stroke-dashoffset': lineLength});line.dataset.registryRole = 'line-stroke';
      }
      for (let i = 0; i < n; i++) {
        const point = points[i], fraction = items[i].value / maximum;
        const node = mode === 'bars' ? svgNode(svg, 'rect', {x: point.x - Math.min(band * .62, 50 * D.unit) / 2, y: base, width: Math.min(band * .62, 50 * D.unit), height: 0, rx: 0, fill: colours[i]})
          : svgNode(svg, 'circle', {cx: point.x, cy: point.y, r: 0, fill: i === chosen ? accent : fg});
        shapes.push({node, index: i, fraction, height: (base - top) * fraction, y: base});
        const tick = label(String(i + 1), root, 'axis-key', i);
        box(tick, chartX + point.x - size, chartY + base + space(1), size * 2);
        set(tick, {textAlign: 'center'});tickLabels.push(tick);
      }
      const anchor = chartX + points[chosen].x;
      if (!ledgerCallout) box(callout, Math.max(chartX, Math.min(chartX + chartW - chipW, anchor - chipW / 2)), chartY - headH, chipW, chip.height);
    }
    // Newly appended SVGs cannot cover the HTML reading layer.
    root.insertBefore(svg, entries[0].entry);
  }
  svg.id = K.uid('chart-story-geometry');svg.dataset.registryGeometry = mode;
  for (const shape of shapes) Object.assign(shape.node.dataset, {registryDatum: String(shape.index + 1), registryTargetValue: String(items[shape.index].value), registryFraction: String(shape.fraction)});
  const frames = Math.max(1, Math.round(clock.rollDuration * 30));
  const token = String(items[chosen].value), decimals = token.includes('e') ? null : (token.split('.')[1]?.length ?? 0);
  const counter = Array.from({length: frames + 1}, (_, frame) => frame === frames ? token
    // The ordinary decimal rows retain the final token's precision. Scientific
    // sub-millionth values wait at zero before their exact token, rather than
    // creating longer transient exponent strings that cannot fit the callout.
    : (decimals === null ? '0' : (items[chosen].value * out(frame / frames)).toFixed(decimals)));
  calloutValue.textContent = '';
  const number = el('span', '', calloutValue, token), numberNode = number.firstChild;
  if (unit) el('span', '', calloutValue, unit);
  return localSeconds => {
    const l = Math.max(0, Number.isFinite(localSeconds) ? localSeconds : 0), entry = out(progress(l, clock.enter, clock.enterDuration));
    const hold = progress(l, clock.settled, clock.driftEnd - clock.settled), drift = l >= clock.driftEnd ? 0 : Math.sin(hold * Math.PI * 2) * H * -.005;
    set(root, {opacity: entry.toFixed(6), transform: `translateY(${px((1 - entry) * 24 * S + drift)})`});
    Object.assign(root.dataset, {registryTime: l.toFixed(6), registryProgress: progress(l, clock.build, clock.buildDuration).toFixed(6),
      registryPhase: l < clock.build ? 'enter' : l < clock.callout ? 'build' : l < clock.settled ? 'emphasis' : 'hold',
      registrySettled: String(l >= clock.callout + clock.rollDuration)});
    for (const [i, row] of entries.entries()) {
      const fade = out(progress(l, clock.labels[i], clock.labelDuration));
      set(row.entry, {opacity: fade.toFixed(6), transform: `translateY(${px((1 - fade) * 8 * S)})`});
    }
    for (const [i, tick] of tickLabels.entries()) set(tick, {opacity: out(progress(l, clock.labels[i], clock.labelDuration)).toFixed(6)});
    if (axis) {
      const u = progress(l, clock.axis, clock.axisDuration), ease = u < .5 ? 2 * u ** 2 : 1 - (-2 * u + 2) ** 2 / 2;
      attr(axis, {'stroke-dashoffset': Number(axis.dataset.registryLength) * (1 - ease)});
    }
    if (line) {
      const front = progress(l, clock.build, clock.lineDuration);attr(line, {'stroke-dashoffset': lineLength * (1 - front)});line.dataset.registryProgress = front.toFixed(6);
      area.setAttribute('opacity', String(.14 * out(progress(l, clock.area, clock.areaDuration))));
    }
    if (ringTrack) ringTrack.setAttribute('opacity', String(out(progress(l, clock.axis, clock.axisDuration))));
    for (const shape of shapes) {
      const slot = clock.items[shape.index], raw = progress(l, slot.at, slot.duration), amount = mode === 'donut' ? raw : out(raw);
      shape.node.dataset.registryProgress = raw.toFixed(6);
      if (mode === 'bars') attr(shape.node, {height: shape.height * amount, y: shape.y - shape.height * amount, rx: Math.min(D.radius(1), shape.height * amount / 2)});
      else if (mode === 'progress') attr(shape.node, {width: shape.width * amount, rx: Math.min(shape.height / 2, shape.width * amount / 2)});
      else if (mode === 'line') attr(shape.node, {r: (shape.index === chosen ? 4 : 2.5) * D.unit * Math.max(0, back(raw))});
      else attr(shape.node, {'stroke-dashoffset': shape.length * (1 - amount), opacity: shape.fraction > 0 ? 1 : 0});
    }
    const pop = progress(l, clock.callout, clock.calloutDuration), roll = progress(l, clock.callout, clock.rollDuration);
    set(callout, {opacity: out(progress(l, clock.callout, .25 * clock.scale)).toFixed(6), transform: `scale(${(.82 + .18 * back(pop)).toFixed(6)})`});
    numberNode.nodeValue = roll >= 1 ? token : counter[Math.min(frames, Math.floor(roll * frames))];
    callout.dataset.registryExact = String(roll >= 1);callout.dataset.registryProgress = roll.toFixed(6);
  };
}

export const sceneFactories = {'chart-story': chartStory};
export default sceneFactories;
// The scene's factory (scenes/folders.mjs).
export const factory = sceneFactories["chart-story"];
