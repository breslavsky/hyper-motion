// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/ground.mjs';
// ---- picker: a grid where the selection hops and lands -------------------------------------------------
// A big grid of icon tiles, close up; a selection ring hops from tile to tile while the grid slides to
// keep it near the middle; on the last hop the pick lifts out, the rest dim, and its name lands.
// Seen in Raycast's 2026 teaser (the emoji picker).
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, lum, alpha, mixHex, hash, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const icons = (s.items?.length ? s.items : ["😀", "🤖", "🫣", "🔥", "💧", "🎙️", "🚀", "🎨", "📈", "🧠", "⚡", "🌈", "🍕", "🎧", "📦", "🔒", "💬", "🌍"]).slice(0, 24);
	const label = DOUBLE(s.text || "");
	const cols = vertical ? 4 : 7;
	const tile = (vertical ? W * 0.2 : W * 0.115);
	const gap = D.space(2);
	const rowsN = Math.ceil(icons.length / cols);
	const gridW = cols * tile + (cols - 1) * gap;
	const gridH = rowsN * tile + (rowsN - 1) * gap;
	const tileBg = light ? "#ffffff" : mixHex(bg, "#ffffff", 0.08);
	const world = el("div", "", cam);
	set(world, { position: "absolute", left: "0", top: "0", width: px(W), height: px(H), willChange: "transform" });
	const pos = (i) => ({ x: (i % cols) * (tile + gap), y: Math.floor(i / cols) * (tile + gap) });
	const tiles = icons.map((ic, i) => {
		const t = el("div", "", world, ic);
		const P = pos(i);
		set(t, { position: "absolute", left: px(P.x), top: px(P.y), width: px(tile), height: px(tile), borderRadius: px(tile * 0.24), background: tileBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${px(tile * 0.06)} ${px(tile * 0.2)} ${alpha("#000000", light ? 0.1 : 0.35)}`, willChange: "transform" });
		D.forSurface(tile / (D.unit * 48)).apply(t, "cardTitle");
		if (/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Component}\s]+$/u.test(String(ic))) t.dataset.designGlyphArt = "icon";
		return t;
	});
	const ring = el("div", "", world);
	set(ring, { position: "absolute", left: "0", top: "0", width: px(tile + 12 * S), height: px(tile + 12 * S), borderRadius: px(tile * 0.28), boxSizing: "border-box", border: `${px(5 * S)} solid ${accent}`, boxShadow: `0 0 ${px(30 * S)} ${alpha(accent, 0.55)}`, zIndex: "5" });
	// The hop path: a few tiles across the grid, ending on the pick.
	const n = icons.length;
	const pick = typeof s.pick === "number" ? Math.min(n - 1, s.pick) : Math.min(n - 1, cols + 3);
	const path = [0, 1, 2].map((k) => Math.floor(hash(k * 3.7 + 1) * n)).concat([pick]);
	path[0] = Math.min(n - 1, cols + 1);
	const hopT = (k) => 0.55 + k * Math.max(0.32, (d0 * 0.45) / path.length);
	const tLand = hopT(path.length - 1) + 0.3;
	const nameN = label ? el("div", "display", cam, label) : null;
	if (nameN) set(nameN, { position: "absolute", left: "0", width: px(W), top: px(H * (vertical ? 0.78 : 0.8)), textAlign: "center", color: fg, opacity: "0" });
	if(nameN)D.apply(nameN,"sceneTitle");
	return (l) => {
		// Where the ring is: eased hops between tiles.
		let k = 0;
		while (k < path.length - 1 && l >= hopT(k + 1)) k++;
		const from = pos(path[k]);
		const to = pos(path[Math.min(path.length - 1, k + 1)]);
		const h = k < path.length - 1 ? E.softInOut(prog(l, hopT(k + 1) - 0.24, 0.24)) : 1;
		const rx = from.x + (to.x - from.x) * (k < path.length - 1 ? h : 0);
		const ry = from.y + (to.y - from.y) * (k < path.length - 1 ? h : 0);
		const appear = E.softLand(prog(l, hopT(0) - 0.15, 0.3));
		set(ring, { opacity: appear.toFixed(3), transform: `translate(${px(rx - 6 * S)}, ${px(ry - 6 * S)}) scale(${(1.15 - 0.15 * appear).toFixed(4)})` });
		// The grid slides so the ring stays near the middle; it lands centred on the pick.
		const land = E.softInOut(prog(l, tLand - 0.2, 0.6));
		const pk = pos(pick);
		const cx = rx + tile / 2;
		const cy = ry + tile / 2;
		const fx = cx + (pk.x + tile / 2 - cx) * land;
		const fy = cy + (pk.y + tile / 2 - cy) * land - (nameN ? H * 0.06 * land : 0);
		const z = 1.12 + 0.12 * land;
		const a = E.softLand(prog(l, 0, 0.6));
		set(world, { transform: `translate(${px(W / 2 - fx * z)}, ${px(H / 2 - fy * z + (1 - a) * 60 * S)}) scale(${z.toFixed(4)})`, opacity: clamp(a * 2).toFixed(3) });
		const lift = E.popOver(clamp((l - tLand) / 0.45));
		tiles.forEach((t, i) => {
			const isPick = i === pick && l >= tLand;
			const sel = i === path[k] || (k < path.length - 1 && i === path[k + 1] && h > 0.5);
			set(t, { opacity: l >= tLand && !isPick ? (1 - 0.65 * clamp((l - tLand) / 0.3)).toFixed(3) : "1", transform: `scale(${(isPick ? 1 + 0.3 * lift : sel ? 1.06 : 1).toFixed(4)})`, zIndex: isPick ? "6" : "1" });
		});
		if (nameN) {
			const nk = E.softLand(prog(l, tLand + 0.15, 0.45));
			set(nameN, { opacity: clamp(nk * 3).toFixed(3), transform: `translateY(${px((1 - nk) * 40 * S)})` });
		}
		void gridW;
		void gridH;
	};
};
