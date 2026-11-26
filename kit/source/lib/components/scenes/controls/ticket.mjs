// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createTyping} from '../../typing.mjs';
export function create(K) {
const { maths, dom, moves } = K.helpers;
const D=K.design;
const { clamp, lerp, prog, expoOut, smooth, lum, textOn, alpha } = maths;
const { el, set, px } = dom;
const { pulse } = moves;
const { W, H, S, spring } = K;
		/** A ticket card types its rows, then a stamp presses down on the beat. */
return ({ p, cam, accent, bg }) => {
			const s = p.scene;
			const at = p.marks?.[0] ?? p.dur * 0.66;
			const vertical = H > W * 1.2;
			const square = !vertical && W < H * 1.3;
			// Let the panel's padding sit outside the text-safe region. A square
			// receipt keeps useful column width even for a monospaced brand font.
			const panelWidth=square?K.safe.w*.96+D.space(3)*2:K.safe.w;
			const tw = vertical ? W * 0.84 : Math.min(panelWidth, 1000 * S);
			const card = el("div", "ticket", cam);
			const ink = textOn(accent),pad=D.box("card").paddingX;
			set(card, { width: px(tw), left: px((W - tw) / 2), background: accent, color: ink, boxShadow: `0 ${px(40 * S)} ${px(90 * S)} rgba(0,0,0,0.22)` });
			D.surface(card,"card");
			const head = el("div", "display", card, s.title);
			set(head, { color: ink });
			D.fitSize(head, tw-pad*2, D.type("cardTitle",5).lineHeight*2, "cardTitle");
			const rule = el("div", "", card);
			set(rule, { borderTop: `${px(3 * S)} dashed ${alpha(ink, 0.45)}` });
			const list=el("div","",card);
			set(list,{display:"flex",flexDirection:"column",gap:px(D.space(2))});
			const rows = s.rows.map(([key, value], index) => {
				const row = el("div", "", list);
				set(row, { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: px(D.space(3)) });
				const label = el("div", "mono", row, key);
				D.apply(label,"label");
				set(label, { opacity: "0.7",maxWidth:"42%",flex:"none" });
				D.truncateLine(label);label.title=key;
				const val = el("div", "bold", row, value);
				D.apply(val,"body");
				set(val, { whiteSpace: "normal",minWidth:"0",textAlign:"right" });
				const typing = createTyping(K, val, { text: value, id: `ticket.rows.${index}` });
				return {row,label,val,text:value,typing};
			});
			// Perforation stays at the divider while the receipt grows with copy.
			const notches=["left", "right"].map(side=>{
				const notch=el("div","",card);
				set(notch,{position:"absolute",[side]:px(-26*S),width:px(52*S),height:px(52*S),borderRadius:"50%",background:bg});
				return notch;
			});
			const stampCol = lum(accent) > 0.4 ? "#111111" : "#ffffff";
			const stamp = el("div", "stamp", cam);
			set(stamp, { color: stampCol, border: `${px(D.unit*2)} solid ${stampCol}`,maxWidth:px(tw-pad*2) });
			D.surface(stamp,"badge");
			D.apply(stamp,"caption");
			const stampLabel=el("div","",stamp,s.stamp);
			D.truncateLine(stampLabel);stampLabel.title=s.stamp;
			const stampSlot=el("div","",card);
			let sw=stamp.offsetWidth,sh=stamp.offsetHeight;
			const angle=11*Math.PI/180;
			set(stampSlot,{height:px(sh*Math.cos(angle)+sw*Math.sin(angle)),flex:"none"});
			if(card.offsetHeight>K.safe.h){
				D.apply(head,"cardTitle",{step:5});
				D.surface(card,"card",{density:"compact"});
				set(list,{gap:px(D.space(1))});
				for(const {val}of rows)D.apply(val,"body",{step:2});
			}
			if(card.offsetHeight>K.safe.h){
				D.surfaceGap(card,1);
				set(list,{display:"grid",gridTemplateColumns:"1fr 1fr",gap:px(D.space(2))});
				for(const {row,label,val}of rows){
					set(row,{flexDirection:"column",alignItems:"stretch",gap:"0px"});
					set(label,{maxWidth:"100%"});set(val,{textAlign:"left"});
				}
				D.apply(stamp,"caption",{step:2});
				sw=stamp.offsetWidth;sh=stamp.offsetHeight;
				set(stampSlot,{height:px(sh*Math.cos(angle)+sw*Math.sin(angle))});
			}
			if(card.offsetHeight>K.safe.h)throw new Error("Receipt copy exceeds the readable card capacity");
			const ch=card.offsetHeight,stampCenter=stampSlot.offsetTop+stampSlot.offsetHeight/2;
			for(const notch of notches)set(notch,{top:px(rule.offsetTop-26*S)});
			for(const {typing}of rows)typing.measure();
			return (l) => {
				const top = (H - ch) / 2;
				const e = spring(l, 2.2, 0.62);
				const jolt = l >= at ? pulse(l - at, 12) : 0;
				set(card, { top: px(top), transform: `translateY(${px((1 - e) * -H * 0.9)}) rotate(${((1 - e) * 8 - 1.5 + jolt * 1.2).toFixed(3)}deg) scale(${(1 - 0.025 * jolt).toFixed(4)})` });
				const span = Math.max(0.3, at - 0.55);
				rows.forEach((r, i) => {
					const from = 0.45 + (i * span) / rows.length;
					const nChars = Math.round(clamp((l - from) / Math.max(0.1, span / rows.length - 0.05)) * r.text.length);
					r.typing.reveal(nChars);
				});
				const sk = expoOut(prog(l, at - 0.07, 0.1));
				set(stamp, {
					left: px(W / 2-sw/2),top:px(top+stampCenter-sh/2),
					opacity: (0.92 * smooth((l - at + 0.07) / 0.05)).toFixed(3),
					transform: `rotate(-11deg) scale(${lerp(2.4, 1, sk).toFixed(4)})`,
				});
			};
		};
}
