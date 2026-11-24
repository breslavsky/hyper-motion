// Measure this component under its actual camera and fit settled text and
// explicitly declared structural geometry (for example a timeline endpoint).
// Scene layout remains private: this has no access to other mounted instances.
export function fitScene(instance,context,{selfCamera}) {
  const {W,H,S,plan,stage,M,helpers,motion}=context;
  const {set,px}=helpers.dom;
  const {camera,lifeOf}=motion;
  const SELF_CAMERA=selfCamera;
  const BLEED=new Set(['marquee','wall','fullbleed']);
	const fit = () => {
		const frame = stage.getBoundingClientRect();
		const k = frame.width / W || 1; // the preview shows the stage scaled
		const margin = plan.safe ?? { top: 0, bottom: 0, left: 0, right: 0 };
		// The safe area itself: a scene is measured as it is seen, under the look's camera.
		const area = { x: W * margin.left, y: H * margin.top, w: W * (1 - margin.left - margin.right), h: H * (1 - margin.top - margin.bottom) };
		for (const b of [instance]) {
            const i=b.ps.index;
			if (!b.inner || BLEED.has(b.ps.scene.type)) continue;
			const sp = b.ps.speed ?? 1;
			const long = (b.ps.ldur ?? b.ps.dur * sp);
			const type = b.ps.scene.type;
			// A scene is hidden until its time comes: shown while it is measured.
			const shown = b.sceneRoot.style.visibility;
			b.sceneRoot.style.visibility = "visible";
			b.sceneRoot.classList.add("on");
			/** The box of all the scene's text as the viewer sees it, once it has settled. */
			const measure = () => {
				let box = null;
				// Over the whole scene, since a line may be shown and gone in its first half (the
				// first of two lines under an orb stood from edge to edge of a real film, and was
				// never measured: HISTORY 332). Once the scene has settled (the later moments) every
				// text counts. Before that, only a text that holds still from one moment to the next
				// and is gone by the time the scene settles: what is on its way in is not yet where
				// it will be read, and a text still there later is measured there (a scene that
				// opens close on a detail shows it large and cropped first, on purpose).
				let before = new Map();
				const early = new Map(); // text -> its box while it held still, early
				const late = new Set(); // the texts on screen once the scene has settled
				for (const at of [0.12, 0.22, 0.32, 0.42, 0.55, 0.7, 0.85]) {
					b.draw(long * at, long);
					const l = b.ps.dur * at;
					if (!SELF_CAMERA.has(type)) set(b.cam, { transform: camera(M.camera, l, b.ps.dur, b.ps.start + l, 0, 0, i) });
					set(b.life, { transform: lifeOf(l, b.ps.dur, i, SELF_CAMERA.has(type) || M.camera === "pan" || M.camera === "punch" || M.camera === "shake" || M.camera === "push") });
					const now = new Map();
					const measured=helpers.dom.textBoxes(b.inner);
					for(const node of b.inner.querySelectorAll('[data-layout-fit-anchor]')){
						let opacity=1,visible=true;
						for(let p=node;p&&p!==b.inner.parentElement;p=p.parentElement){
							const style=getComputedStyle(p);opacity*=Number(style.opacity);
							if(style.display==='none'||style.visibility==='hidden'){visible=false;break;}
						}
						const r=node.getBoundingClientRect();
						if(visible&&opacity>=.75&&r.width>0&&r.height>0)measured.push({text:node,x:r.x,y:r.y,w:r.width,h:r.height});
					}
					for (const t of measured) {
						if (t.mock) continue;
						const bounds=t.fitBox??t;
						if(bounds.w<=0||bounds.h<=0)continue;
						const [x0, y0, x1, y1] = [(bounds.x - frame.left) / k, (bounds.y - frame.top) / k, (bounds.x + bounds.w - frame.left) / k, (bounds.y + bounds.h - frame.top) / k];
						now.set(t.text, [x0, y0, x1, y1]);
						const was = before.get(t.text);
						const still = was && Math.max(Math.abs(was[0] - x0), Math.abs(was[1] - y0), Math.abs(was[2] - x1), Math.abs(was[3] - y1)) < W * 0.012;
						if (at < 0.5) {
							if (still) early.set(t.text, [x0, y0, x1, y1]);
							continue;
						}
						late.add(t.text);
						box = box ? [Math.min(box[0], x0), Math.min(box[1], y0), Math.max(box[2], x1), Math.max(box[3], y1)] : [x0, y0, x1, y1];
					}
					before = now;
				}
				for (const [text, [x0, y0, x1, y1]] of early) {
					if (late.has(text)) continue;
					box = box ? [Math.min(box[0], x0), Math.min(box[1], y0), Math.max(box[2], x1), Math.max(box[3], y1)] : [x0, y0, x1, y1];
				}
				return box;
			};
			try {
				let [scale, tx, ty] = [1, 0, 0];
				// The layer is moved inside the camera and measured outside it: a second look
				// takes up what the camera's own growth left.
				let paints = false;
				for (let pass = 0; pass < 3; pass++) {
					const box = measure();
					b.box = box;
					// Whether it paints the whole frame is asked of the scene as it stands once settled.
					if (!pass) {
						for (const child of b.inner.querySelectorAll(":scope > *, :scope > * > *")) {
							const r = child.getBoundingClientRect();
							const style = getComputedStyle(child);
							if (r.width >= frame.width * 0.97 && r.height >= frame.height * 0.97 && (style.backgroundImage !== "none" || !/rgba\(0, 0, 0, 0\)|transparent/.test(style.backgroundColor))) paints = true;
						}
					}
					if (!box || paints) {
						b.fitted = !box ? "no text" : "paints the frame";
						break;
					}
					const [bw, bh] = [box[2] - box[0], box[3] - box[1]];
					// Inside with a hair to spare: the frame's drift and the beat's kick, which are not
					// in this measure, carry a text at the very edge a few pixels past it.
					const [hx, hy] = [W * 0.006, H * 0.006];
					if (box[0] >= area.x + hx && box[1] >= area.y + hy && box[2] <= area.x + area.w - hx && box[3] <= area.y + area.h - hy) break;
					// A scene whose words span far more than the frame moves its own view along them (a line
					// the camera travels): there is no place to fit it into.
					if (!pass && Math.min(area.w / bw, area.h / bh) < 0.6) {
						b.fitted = "travels";
						break;
					}
					// Smaller only as far as it must be, and never so small that the type stops reading.
					const by = Math.max(0.78 / scale, Math.min(1, (area.w - W * 0.016) / bw, (area.h - H * 0.016) / bh));
					const [cx, cy] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
					const within = (centre, half, from, size) => (half * 2 >= size ? from + size / 2 : Math.min(from + size - half, Math.max(from + half, centre)));
					// A hair inside the area: the beat's kick and the frame's drift move it a few pixels.
					const [mx, my] = [W * 0.008, H * 0.008];
					const [nx, ny] = [within(cx, (bw * by) / 2, area.x + mx, area.w - 2 * mx), within(cy, (bh * by) / 2, area.y + my, area.h - 2 * my)];
					[scale, tx, ty] = [scale * by, by * tx + nx - cx * by, by * ty + ny - cy * by];
					set(b.inner, { transformOrigin: "0 0", transform: `translate(${px(tx)}, ${px(ty)}) scale(${scale.toFixed(5)})` });
					b.fitted = { scale, x: tx, y: ty };
				}
			} catch (err) {
				throw new Error(`Component ${b.ps.scene.type} could not be fitted: ${err?.message ?? err}`, {cause:err});
			}
			// The scene goes back to its first moment and out of sight. Measuring drew it at its
			// late moments, and a part a scene shows by itself (`visibility: visible` on a chat
			// bubble) stayed lit over the scenes before it in every film (HISTORY 335).
			try {
				b.draw(0, long);
			} catch {}
			b.sceneRoot.style.visibility = shown;
			b.sceneRoot.classList.toggle("on", b.lastVisible);
		}
	};
  fit();
  return instance.fitted ?? null;
}
