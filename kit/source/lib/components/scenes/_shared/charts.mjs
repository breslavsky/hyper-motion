// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
export const SVG = "http://www.w3.org/2000/svg";
export const svgEl = (tag, attrs, parent) => {
	const n = document.createElementNS(SVG, tag);
	for (const k in attrs) n.setAttribute(k, String(attrs[k]));
	if (parent) parent.appendChild(n);
	return n;
};
/** 1200000 -> 1.2M style when the number is large, so it stays big on screen. */
export const compact = (v) => {
	const a = Math.abs(v);
	if (a >= 1e9) return { n: v / 1e9, s: "B", d: 1 };
	if (a >= 1e6) return { n: v / 1e6, s: "M", d: 1 };
	if (a >= 1e4) return { n: v / 1e3, s: "K", d: 0 };
	return { n: v, s: "", d: String(v).split(".")[1]?.length ?? 0 };
};

