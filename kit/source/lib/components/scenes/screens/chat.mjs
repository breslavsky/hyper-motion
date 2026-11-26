// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- chat -------------------------------------------------------------------------------
export const factory = ({ p, cam, fg, accent, K }) => {
	const { W, H, S, el, set, px, spring, clamp, textOn, alpha, prog, expoOut } = K;
	const s = p.scene;
	const D=K.design;
	const marks = p.marks ?? s.messages.map((_, i) => 0.2 + i * p.beatLen * 1.5);
	const vertical = H > W * 1.2;
	const colW = vertical ? W * 0.88 : Math.min(W * 0.62, 1240 * S);
	const col = el("div", "", cam);
	set(col, { position: "absolute", left: px((W - colW) / 2), width: px(colW), display: "flex", flexDirection: "column", gap: px(D.space(3)) });
	D.surfaceGap(col,3);
	const them = alpha(fg, 0.1);
	const bubbles = s.messages.map((m) => {
		const row = el("div", "", col);
		set(row, { display: "flex", justifyContent: m.me ? "flex-end" : "flex-start" });
		const b = el("div", "", row, m.text);
		set(b, { maxWidth: "80%", background: m.me ? accent : them, color: m.me ? textOn(accent) : fg, transformOrigin: m.me ? "100% 100%" : "0 100%" });
		D.surface(b,"field",{shape:"pill"});
		D.apply(b,"body");
		// Typing dots before their messages.
		let dots = null;
		if (!m.me) {
			dots = el("div", "", row);
			set(dots, { position: "absolute", background: them, display: "flex" });
			D.surface(dots,"field",{shape:"pill"});
			for (let i = 0; i < 3; i++) {
				const d = el("div", "", dots);
				set(d, { width: px(20 * S), height: px(20 * S), borderRadius: "50%", background: alpha(fg, 0.55) });
			}
		}
		return { row, b, dots };
	});
	const heights = bubbles.map((x) => x.row.offsetHeight + D.space(3));
	return (l) => {
		let shown = 0;
		let newest=bubbles.findLastIndex((_,i)=>l>=marks[i]);
		const next=newest+1;
		// Typing may reserve spare room, but cannot replace a message before
		// that message has appeared on its own authored event.
		if(next<bubbles.length&&bubbles[next].dots&&l>=marks[next]-.45&&
			(newest<0||heights[newest]+heights[next]<=K.safe.h))newest=next;
		let first=Math.max(0,newest),capacity=0;
		for(let i=newest;i>=0;i--){if(capacity+heights[i]>K.safe.h&&i<newest)break;capacity+=heights[i];first=i;}
		bubbles.forEach(({ row, b, dots }, i) => {
			const at = marks[i];
			const typing = dots && l >= at - 0.45 && l < at;
			const k = K.ease.softLand(prog(l, at, 0.32));
			const on = l >= at;
			const inWindow=i>=first&&i<=newest;
			set(row, { display: inWindow&&(on || typing) ? "flex" : "none" });
			// Landed bubbles bob a little, out of step with each other, so the thread feels alive.
			const bob = Math.sin(l * 1.6 + i * 1.3) * 4 * S * clamp((l - at - 0.4) / 0.6);
			set(b, { visibility: on ? "visible" : "hidden", transform: `translateY(${px(bob + (1 - k) * 26 * S)}) scale(${(1.1 - 0.1 * k).toFixed(4)})`, opacity: K.smooth((l - at) / 0.08).toFixed(3) });
			// The typing row eases the conversation up as it appears, and the message takes over
			// the space the dots already made, so the column never jumps.
			const tk = dots ? K.smooth(prog(l, at - 0.45, 0.24)) : 0;
			if (dots) {
				set(dots, { opacity: (tk * (1 - clamp((l - at) / 0.06))).toFixed(3) });
				[...dots.children].forEach((d, j) => set(d, { transform: `translateY(${px(Math.sin(l * 14 - j) * 5 * S)})` }));
			}
			if (inWindow&&(on || typing)) shown += heights[i] * (dots ? tk : expoOut(prog(l, at, 0.3)));
		});
		set(col, { top: px(K.safe.y+(K.safe.h-shown)/2) });
	};
};

