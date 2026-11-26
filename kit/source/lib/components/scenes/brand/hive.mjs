// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/hands.mjs';
// ---- hive: the product's pieces gather around its mark ----------------------------------------------
// A honeycomb of empty slots opens around the logo; the product's tools fly in from off frame and
// land in their slots, a couple of them name themselves, then the whole hive pulls into the mark and
// the name lands beside it. Seen in Enobase's launch film.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, logoNode, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const icons = (s.icons?.length ? s.icons : ["📅", "💬", "📊", "🧾", "📁", "✉️", "🧠", "⚡"]).slice(0, 12);
	const labels = (s.labels ?? []).map(DOUBLE).slice(0, 3);
	const name = DOUBLE(s.word || K.plan.brand?.name || "");
	const tile = Math.min(W, H) * (vertical ? 0.15 : 0.135);
	const sp = tile * 1.32;
	// Axial hex positions, ring by ring.
	const slots = [];
	const dirs = [
		[1, 0],
		[0, 1],
		[-1, 1],
		[-1, 0],
		[0, -1],
		[1, -1],
	];
	for (let ring = 1; ring <= 2; ring++) {
		let q = dirs[4][0] * ring;
		let r = dirs[4][1] * ring;
		for (let side = 0; side < 6; side++)
			for (let st = 0; st < ring; st++) {
				slots.push({ q, r, ring });
				q += dirs[side][0];
				r += dirs[side][1];
			}
	}
	const pos = (sl) => ({ x: W / 2 + sp * (sl.q + sl.r / 2), y: H / 2 + sp * sl.r * 0.866 });
	const world = el("div", "", cam);
	set(world, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), transformOrigin: "50% 50%" });
	const empties = slots.map((sl) => {
		const n = el("div", "", world);
		const P = pos(sl);
		set(n, { position: "absolute", left: px(P.x - tile / 2), top: px(P.y - tile / 2), width: px(tile), height: px(tile), borderRadius: px(tile * .26), background: alpha(light ? "#000000" : "#ffffff", 0.045), willChange: "transform" });
		return { n, P, ring: sl.ring };
	});
	// Which slots get a tool: spread around both rings.
	const order = slots.map((_, i) => i).sort((a, b) => hash(a * 3.3 + 1) - hash(b * 3.3 + 1));
	const used = order.slice(0, icons.length);
	const tiles = icons.map((ic, k) => {
		const si = used[k];
		const P = pos(slots[si]);
		const n = el("div", "", world);
		set(n, { position: "absolute", left: "0", top: "0", width: px(tile), height: px(tile), borderRadius: px(tile * 0.26), background: light ? "#ffffff" : "#1c1f27", boxShadow: `0 ${px(tile * 0.08)} ${px(tile * 0.25)} ${alpha("#000000", light ? 0.13 : 0.4)}, 0 0 0 ${px(1.5 * S)} ${alpha(light ? "#000000" : "#ffffff", 0.06)}`, display: "flex", alignItems: "center", justifyContent: "center", willChange: "transform", zIndex: "3" });
		D.forSurface(tile/(D.unit*48)).apply(n,"cardTitle");
		n.textContent = ic;
		const ang = hash(k * 5.7 + 2.1) * Math.PI * 2;
		const far = Math.max(W, H) * 0.75;
		return { n, P, from: { x: W / 2 + Math.cos(ang) * far, y: H / 2 + Math.sin(ang) * far }, rot: (hash(k * 1.9) - 0.5) * 60 };
	});
	const labelNs = labels.map((t, k) => {
		const n = el("div", "bold", world);
		set(n, { position: "absolute", left: "0", top: "0", background: light ? "#111111" : "#ffffff", color: light ? "#ffffff" : "#111111", whiteSpace: "nowrap", zIndex: "6", opacity: "0", transformOrigin: "0 50%" });
		D.surface(n, "badge", { density: "compact", shape: "pill" });
		D.apply(n,"label");
		const label = el("div", "", n, t);
		set(label, { maxWidth: px(K.safe.w * .4 - D.box("badge", { density: "compact" }).paddingX * 2) });
		D.truncateLine(label);label.title = t;
		return n;
	});
	const core = logoNode(world, tile * 1.15, accent);
	set(core, { position: "absolute", left: px(W / 2 - tile * 0.575), top: px(H / 2 - tile * 0.575), zIndex: "5", boxShadow: `0 ${px(tile * 0.1)} ${px(tile * 0.4)} ${alpha(accent, 0.45)}`, willChange: "transform" });
	const nameN = el("div", "display", world, name);
	set(nameN, { position: "absolute", left: "0", top: "0", color: fg, whiteSpace: "pre", opacity: "0", zIndex: "5" });
	D.apply(nameN,"display");
	D.fitLine(nameN,K.safe.w-tile*1.5,H*.2,"display");
	const nameW = nameN.offsetWidth;
	const gapN = tile * 0.35;

	const tIcons = 0.35;
	const stag = Math.min(0.08, 0.9 / icons.length);
	const tLabels = tIcons + icons.length * stag + 0.35;
	const tPull = Math.max(tLabels + labels.length * 0.45 + 0.3, p.dur * 0.62);

	return (l) => {
		const pull = E.accelExit(prog(l, tPull, 0.42));
		// Empty slots open ring by ring, from oversize.
		empties.forEach((e) => {
			const k = E.softLand(prog(l, 0.04 + e.ring * 0.08, 0.45));
			const px2 = W / 2 + (e.P.x - W / 2) * (1 - pull);
			const py2 = H / 2 + (e.P.y - H / 2) * (1 - pull);
			set(e.n, { opacity: (clamp(k * 3) * (1 - pull)).toFixed(3), transform: `translate(${px(px2 - e.P.x)}, ${px(py2 - e.P.y)}) scale(${(1.25 - 0.25 * k).toFixed(4)})` });
		});
		tiles.forEach((t, k) => {
			const a = E.softLand(prog(l, tIcons + k * stag, 0.55));
			let x = t.from.x + (t.P.x - t.from.x) * a;
			let y = t.from.y + (t.P.y - t.from.y) * a;
			x = W / 2 + (x - W / 2) * (1 - pull);
			y = H / 2 + (y - H / 2) * (1 - pull);
			set(t.n, { opacity: (1 - clamp((pull - 0.7) / 0.3)).toFixed(3), transform: `translate(${px(x - tile / 2)}, ${px(y - tile / 2)}) rotate(${(t.rot * (1 - a)).toFixed(2)}deg) scale(${((1 + 0.25 * (1 - a)) * (1 - 0.6 * pull)).toFixed(4)})` });
		});
		labelNs.forEach((n, k) => {
			const t = tiles[k % tiles.length];
			const on = E.snapSettle(prog(l, tLabels + k * 0.45, 0.3));
			const off = E.accelExit(prog(l, tLabels + k * 0.45 + 0.75, 0.2));
			set(n, { opacity: (on * (1 - off)).toFixed(3), transform: `translate(${px(t.P.x + tile * 0.55)}, ${px(t.P.y - tile * 0.62)}) scale(${(0.9 + 0.1 * on).toFixed(4)})` });
		});
		// The mark: arrives first, then takes everything in and moves aside for the name.
		const ca = E.softLand(prog(l, 0, 0.45));
		const bump = l > tPull + 0.34 ? E.popOver(clamp((l - tPull - 0.34) / 0.45)) : 1;
		const slide = name ? E.softInOut(prog(l, tPull + 0.4, 0.6)) : 0;
		const total = tile * 1.15 + gapN + nameW;
		const cx = W / 2 + (-(total / 2) + tile * 0.575) * slide;
		set(core, { transform: `translate(${px(cx - W / 2)}, 0) scale(${((1.4 - 0.4 * ca) * (l > tPull + 0.34 ? 0.92 + 0.08 * bump : 1) * (1 + 0.25 * slide)).toFixed(4)})` });
		const nk = E.softLand(prog(l, tPull + 0.55, 0.5));
		set(nameN, { opacity: clamp(nk * 3).toFixed(3), transform: `translate(${px(cx + tile * 0.575 * 1.25 + gapN + (1 - nk) * 30 * S)}, ${px(H / 2 - tile * 0.52)})` });
	};
};
