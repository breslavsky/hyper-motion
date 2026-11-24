// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import metadata from '../metadata.mjs';
import {createOwnKit} from '../own-kit.mjs';
import {portraitGlassWidth} from '../glass/layout.mjs';
import {timedGlassFactories} from '../timing.mjs';
export function createFamily(K) {
const kit=createOwnKit();
const sceneFactories={};
const { panel, orbs, figure, counted, unit } = kit;
function backdrop({K,root,cam,palette,accent,bg,p}){
  if(!K.glassBackground)return orbs(K,cam,palette,accent,bg,p.index);
  const {element}=K.glassBackground;
  element.classList.add('pk-glass-background');
  element.setAttribute('aria-hidden','true');
  K.set(element,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'});
  root.insertBefore(element,root.querySelector(':scope > .layer'));
  return null;
}
const definition_widgets={...metadata["widgets"],build(args){
			const {p,cam,fg,accent,bg,K}=args;
			const { W, H, el, set, px, spring, clamp, expoOut, prog, alpha } = K;
			const S = unit(K);
			const s = p.scene;
			const light=backdrop(args);
			const n = s.items.length;
            const portraitWidth=portraitGlassWidth(K),gridWidth=portraitWidth??K.safe.w;
            const tileBox=K.design.box('card',{density:'compact'});
			const vertical = H > W * 1.2;
			let cols = n === 4 ? 2 : vertical ? 1 : n;
			let gap = K.design.space(2);
			const wrap = el("div", "center", cam);
			set(wrap, { gap: px(K.design.space(4)) });
			const head = s.title ? el("div", "bold", wrap, s.title) : null;
			if (head) {
				set(head, { color: fg });
				K.design.fitSize(head, gridWidth, K.design.steps('sceneTitle').at(-1).lineHeight*2, 'sceneTitle');
			}
			const minTileW = Math.max(...s.items.map(item=>{
                const probe=el('span','',wrap,item.value);K.design.apply(probe,'metric',{step:6});
                set(probe,{position:'absolute',whiteSpace:'nowrap'});const width=probe.offsetWidth;probe.remove();return width;
            })) + tileBox.paddingX*2;
            cols=Math.max(1,Math.min(cols,Math.floor((gridWidth+gap)/(minTileW+gap))));
            const compact=cols===1&&n>=3;
            if(compact)gap=K.design.space(1);
            const columnWidth=(gridWidth-gap*(cols-1))/cols;
            const tw=portraitWidth!==null||compact?columnWidth:Math.min(columnWidth,Math.max(520*S,minTileW));
			const tilePad=tileBox.paddingX;
            const valueH=K.design.type('metric',compact?6:7).lineHeight;
            const th = compact?Math.max(K.design.type('label').lineHeight*2,valueH)+tilePad*2:Math.max(tileBox.paddingY*2+tileBox.gap+K.design.type('label').lineHeight+K.design.type('metric').lineHeight, Math.min(tw*.72,330*S,(K.safe.h-(head?.offsetHeight??0)-K.design.space(4)-gap*(Math.ceil(n/cols)-1))/Math.ceil(n/cols)));
			const grid = el("div", "", wrap);
			set(grid, { display: "grid", gridTemplateColumns: `repeat(${cols}, ${px(tw)})`, gap: px(gap) });
			const {items: starts, settled} = this.anchors(s, p.dur);
			const countDuration = settled - starts.at(-1) - 0.1;
			const tiles = s.items.map((item, i) => {
				const tile = panel(K, grid, { ground: bg, radius: 5, tint: i === 0 ? accent : undefined });
                const tileBorder=parseFloat(getComputedStyle(tile).borderLeftWidth),contentW=tw-(tilePad+tileBorder)*2;
				set(tile, { height: px(th+tileBorder*2), display: "flex", flexDirection: compact?'row':'column', alignItems: compact?'center':'stretch', justifyContent: "space-between", textAlign: "left" });
				K.design.surface(tile,'card',{density:'compact'});
                const label = el("div", "mono", tile, item.label);
				set(label, { color: alpha(fg, 0.62), whiteSpace: "nowrap" }); K.design.apply(label, 'label');
				const value = el("div", "bold", tile, item.value);
				set(value, { color: fg, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });
				K.design.fitLine(value, contentW, valueH, 'metric');
                if(compact){set(value,{flex:'none'});K.design.fitSize(label,contentW-value.offsetWidth-tileBox.gap,K.design.type('label').lineHeight*2,'label');}
				else {K.design.truncateLine(label);label.title=item.label;}
				return { tile, value, f: figure(item.value), at: starts[i] };
			});
			return (l, _duration, backdropTime=l) => {
				light?.(backdropTime);
				if (head) set(head, { opacity: clamp(l / 0.25).toFixed(3) });
				for (const t of tiles) {
					const e = spring(l - t.at, 2.6, 0.62);
					set(t.tile, { opacity: clamp((l - t.at) / 0.12).toFixed(3), transform: `translateY(${px((1 - e) * 60 * S)}) scale(${(0.86 + 0.14 * e).toFixed(4)})` });
					if (t.f) t.value.textContent = counted(t.f, expoOut(prog(l, t.at + 0.1, countDuration)));
				}
			};
		}};
sceneFactories["widgets"]=given=>definition_widgets.build(given);
const definition_sheet={...metadata["sheet"],build(args){
			const {p,cam,fg,accent,bg,K}=args;
			const { W, H, el, set, px, spring, clamp, prog, expoOut, smooth, alpha, textOn, makeCursor } = K;
			const S = unit(K);
			const s = p.scene;
			const light=backdrop(args);
			const vertical = H >= W;
			const sw = portraitGlassWidth(K)??Math.min(K.safe.w, W * (vertical ? 0.9 : 0.7));
			const sheet = panel(K, cam, { ground: bg, radius: 6 });
			set(sheet, { position: "absolute", left: px((W - sw) / 2), bottom: px(H - K.safe.y - K.safe.h + (vertical ? 0 : H * 0.05)), width: px(sw), display: "flex", flexDirection: "column", textAlign: "left" });
			const sheetBox=K.design.surface(sheet,'card',{density:'compact'});
            const rowBox=K.design.box('field',{density:'compact'});
            const grab = el("div", "", sheet);
			set(grab, { alignSelf: "center", width: px(90 * S), height: px(10 * S), borderRadius: px(K.design.radius(1)), background: alpha(fg, 0.3), marginBottom: px(K.design.space(1)) });
			const title = el("div", "bold", sheet, s.title);
			set(title, { color: fg, marginBottom: px(K.design.space(1)) });
			K.design.fitSize(title, sw - sheetBox.paddingX*2, K.design.steps('cardTitle').at(-1).lineHeight * 2, 'cardTitle');
			const t = this.anchors(s, p.dur);
			const rowsRoot=el('div','',sheet);set(rowsRoot,{display:'flex',flexDirection:'column',gap:px(K.design.space(1))});
			const rows = s.rows.map((name, i) => {
				const row = el("div", "", rowsRoot);
				set(row, { display: "flex", alignItems: "center", background: alpha(fg, 0.07) });
				K.design.surface(row,'field',{density:'compact'});
                const tick = el("div", "", row);
				const d = 44 * S;
				set(tick, { width: px(d), height: px(d), borderRadius: "50%", flex: "none", boxSizing: "border-box", border: `${px(3 * S)} solid ${alpha(fg, 0.35)}`, display: "flex", alignItems: "center", justifyContent: "center" });
				tick.innerHTML = `<svg viewBox="0 0 24 24" width="70%" height="70%"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${textOn(accent)}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="24" stroke-dashoffset="24"/></svg>`;
				const label = el("div", "", row, name);
				set(label, { color: fg, whiteSpace: "nowrap" });
				K.design.fitSize(label, sw - sheetBox.paddingX*2 - rowBox.paddingX*2 - d - rowBox.gap, K.design.type('body').lineHeight*2, 'body');
				return { row, tick, label, path: tick.querySelector("path"), at: t.rows[i] };
			});
			const button = el("div", "bold", sheet);
			set(button, { marginTop: px(K.design.space(1)), padding: `${px(K.design.space(2))} 0`, borderRadius: px(K.design.radius(4)), background: accent, color: textOn(accent), textAlign: "center", boxShadow: `0 ${px(14 * S)} ${px(34 * S)} ${alpha(accent, 0.4)}` }); K.design.apply(button, 'button');
			button.dataset.designControl='button';button.dataset.designControlLayout='stretch';
			const control = K.design.control('button');
			set(button, {height: px(control.height), minHeight: px(control.height), boxSizing: 'border-box', padding: `${px(control.paddingY)} ${px(control.paddingX)}`, borderRadius: px(control.radius), flex: 'none'});
			const buttonLabel=el("div","",button,s.cta);
			K.design.truncateLine(buttonLabel);buttonLabel.title=s.cta;
			if(sheet.offsetHeight>K.safe.h-(vertical?0:H*.05)&&H<=W){
                const colW=(sw-sheetBox.paddingX*2-K.design.space(1))/2;
                set(rowsRoot,{display:'grid',gridTemplateColumns:'1fr 1fr'});
                for(const r of rows){
                    set(r.row,{position:'relative',display:'flex'});
                    set(r.tick,{position:'absolute',left:px(rowBox.paddingX),top:px(rowBox.paddingY)});
                    set(r.label,{textIndent:px(44*S+rowBox.gap)});
                    K.design.fitSize(r.label,colW-rowBox.paddingX*2,K.design.steps('body').at(-1).lineHeight*3,'body');
                }
            }
            const cursor = makeCursor(cam, 100 * S);
			let target = null;
			return (l, _duration, backdropTime=l) => {
				light?.(backdropTime);
				const e = spring(l - t.open, 2.1, 0.7);
				set(sheet, { transform: `translateY(${px((1 - e) * (sheet.offsetHeight + H * 0.12))})` });
				for (const r of rows) {
					const k = expoOut(prog(l, r.at, 0.3));
					const on = smooth((l - r.at) / 0.1);
					set(r.tick, { background: on > 0 ? alpha(accent, on) : "transparent", borderColor: on > 0.5 ? accent : alpha(fg, 0.35), transform: `scale(${(1 + 0.2 * Math.sin(prog(l, r.at, 0.3) * Math.PI)).toFixed(4)})` });
					r.path.setAttribute("stroke-dashoffset", String((1 - k) * 24));
				}
				const dip = Math.sin(clamp(prog(l, t.press, 0.24)) * Math.PI);
				set(button, { transform: `scale(${(1 - 0.05 * dip).toFixed(4)})`, filter: `brightness(${(1 + 0.12 * dip).toFixed(3)})` });
				if (!target && e > 0.98) target = { x: sheet.offsetLeft + button.offsetLeft + button.offsetWidth * 0.62, y: sheet.offsetTop + button.offsetTop + button.offsetHeight * 0.55 };
				const at = target ?? { x: W / 2, y: H * 0.8 };
				cursor(l, { fx: at.x + 260 * S, fy: at.y + 200 * S, x: at.x, y: at.y, start: t.press - 0.5, arrive: t.press - 0.05, click: t.press, ringColor: alpha(textOn(accent), 0.7) });
			};
		}};
sceneFactories["sheet"]=given=>definition_sheet.build(given);
return {sceneFactories:timedGlassFactories(sceneFactories)};
}
