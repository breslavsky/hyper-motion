// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
/** The product's logo as a node, for the scenes that draw it and for the film's own layers. */
export function logoNodeFor(K) {
const { maths, dom } = K.helpers;
const D=K.design;
const { textOn } = maths;
const { el, set, px } = dom;
const { plan, images } = K;
		const logoNode = (parent, size, bg) => {
			const logo = plan.brand?.logo ? images[plan.brand.logo] : null;
			const n = el("div", "", parent);
			set(n, { width: px(size), height: px(size), borderRadius: px(size * 0.24), background: bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flex: "none" });
			if (logo) {
				const im = el("img", "", n);
				im.src = logo.src;
				set(im, { width: "78%", height: "78%", objectFit: "contain" });
			} else {
				const t = el("div", "display", n, (plan.brand?.name ?? "K").trim().charAt(0).toUpperCase());
				D.forSurface(size/(D.unit*32)).apply(t,"initials");
				set(t, { color: textOn(bg) });
			}
			return n;
		};
		return logoNode;
}

export function createBuiltin(K) {
		/** Scenes that drive their own camera. */
		const SELF_CAMERA = new Set(["prompt", "ui-macro", "morph", "laptop", "browser", "dock", "ride", "lens-wall", "laptop3d", "synth3d"]);

		return { SELF_CAMERA, logoNode: logoNodeFor(K) };

}
