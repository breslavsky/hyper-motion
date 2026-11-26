// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
// ---- tiles: letters on cards tumbling into a word ----------------------------------------------
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, spring, clamp, hash, mixHex, textOn, beatKick } = K;
	const D = K.design;
	const s = p.scene;
	const chars = [...s.text];
	const n = chars.length;
	const vertical = H > W * 1.2;
	const tileColumns = H >= W && n > 8 ? Math.ceil(n / 2) : n;
	const tileRows = Math.ceil(n / tileColumns);
	const size = Math.min((W * (vertical ? 0.92 : 0.84)) / (tileColumns * 1.04), H * 0.3);
	const row = el("div", "", cam);
	set(row, { position: "absolute", inset: "0", perspective: px(1600 * S) });
	const total = tileColumns * size * 1.04;
	const totalHeight = tileRows * size + (tileRows - 1) * D.space(2);
	const cols = [accent, accent, mixHex(accent, "#ffffff", 0.12), mixHex(accent, "#000000", 0.06)];
	const tiles = chars.map((ch, i) => {
		const t = el("div", "", row);
		const c = cols[Math.floor(hash(i * 5.3 + p.index) * cols.length)];
		set(t, { position: "absolute", left: px(W / 2 - total / 2 + (i % tileColumns) * size * 1.04), top: px((H - totalHeight) / 2 + Math.floor(i / tileColumns) * (size + D.space(2))), width: px(size), height: px(size), borderRadius: px(size * 0.12), background: c, color: textOn(accent), display: ch.trim() ? "grid" : "none", placeItems: "center", boxShadow: `0 ${px(size * 0.05)} 0 ${mixHex(c, "#000000", 0.28)}, 0 ${px(size * 0.16)} ${px(size * 0.3)} rgba(0,0,0,0.22)` });
		D.forSurface(size / (D.unit * 48)).apply(t,"cardTitle");
		t.textContent = ch;
		return { t, r: (hash(i * 2.9 + p.index) - 0.5) * 10, y0: -(0.75 + hash(i * 3.3) * 0.4) * H, spin: (hash(i * 7.1) - 0.5) * 120, flip: 40 + hash(i * 1.1) * 60, at: p.at.first - p.at.fall + i * p.at.every + hash(i * 8.8) * 0.06 };
	});
	const start = p.start ?? 0;
	return (l) => {
		const landed = tiles[tiles.length - 1].at + 0.6;
		const kick = l > landed ? (beatKick ? beatKick(start + l) : 0) : 0;
		tiles.forEach((k, i) => {
			const e = l - k.at;
			const sp = spring(e, 2.2, 0.48);
			const hop = kick * (i % 2 ? 0.09 : 0.05) * size;
			// Once down they keep a gentle wave, like tiles on a moving table.
			const live = clamp((e - 0.5) / 0.6);
			const wave = Math.sin(l * 2.6 - i * 0.7) * live;
			set(k.t, {
				opacity: e > 0 ? "1" : "0",
				transform: `translateY(${px((1 - sp) * k.y0 - hop + wave * size * 0.08)}) rotateX(${((1 - sp) * k.flip).toFixed(3)}deg) rotate(${(k.r + (1 - sp) * k.spin + wave * 4.5).toFixed(3)}deg)`,
			});
		});
	};
};

