// Frames of a scene drawn twice and compared: by Kinetic's engine as it was taken
// (reference/engine/, its files as its site served them) and by native HyperFrames components
// (source/lib/components/), each scene left where its code put it (the engine's fit into
// the safe area is off). It holds the code that was carried over, not the picture: the picture is
// tools/audit.mjs's to measure.
//
//   node kit/tools/kinetic/frames.mjs [--scenes title,slam] [--looks editorial,poster]
//                                                        [--out <folder>] [--samples 6]
//
// A case is one scene of a type, as one of Kinetic's own templates writes it
// (templates.json) or, for the types no template uses, as samples.json does, played alone in a
// look. For each, `--samples` frames across its length are
// taken from both and compared: the mean difference of a pixel (0-255) and the share of pixels
// that differ visibly. Without --scenes it takes every type a film may use but the ones changed
// from Kinetic's on purpose (changed.json). --out keeps a sheet per case: the frames of the one above the frames of the other.
// Needs the template's packages (puppeteer-core and sharp come with HyperFrames) and Chrome.
// Exit: 0 every case within the limits, 1 otherwise.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {createNativeBrowser, sharp} from "../native-browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(HERE, "../..");
const SOURCE = path.join(TEMPLATE, "source");
const require = createRequire(import.meta.url);

/** A package HyperFrames brought, from pnpm's store of the template. */
const brought = (name) => createRequire(path.join(fs.realpathSync(path.join(TEMPLATE,"node_modules/hyperframes")),"package.json"))(name);

const chrome = () => {
	if (process.env.CHROME) return process.env.CHROME;
	const cache = path.join(os.homedir(), ".cache", "puppeteer", "chrome-headless-shell");
	if (fs.existsSync(cache)) {
		for (const build of fs.readdirSync(cache).sort().reverse()) {
			const found = fs.readdirSync(path.join(cache, build), { recursive: true }).find((f) => path.basename(String(f)) === "chrome-headless-shell");
			if (found) return path.join(cache, build, String(found));
		}
	}
	for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"]) if (fs.existsSync(p)) return p;
	throw new Error("no Chrome found: set CHROME to its executable");
};

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const SAMPLES = Number(option("samples", 6));
const OUT = option("out", null);
// Within these a scene counts as the same picture: anti-aliasing and sub-pixel rounding
// move a few edge pixels, a wrong ease or a missing part moves far more.
const MEAN_MAX = Number(option("mean", 1.5));
const SHARE_MAX = Number(option("share", 0.01));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".cjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
/** Raw upstream runtime is retained only as a test reference, never shipped. */
const TAKEN = ["/reference/kinetic.js", ...["text", "data", "ui", "reel", "flow", "studio", "hands"].map((f) => `/reference/scenes/${f}.js`)];
const page = () => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/reference/kinetic.css"><link rel="stylesheet" href="/lib/fonts.css">
<style>html,body{margin:0;overflow:hidden;background:#000}</style></head><body>
<svg width="0" height="0" style="position:absolute"><defs id="filters"></defs></svg>
<div id="viewport"><div id="stage"></div></div>
<script>window.Kinetic3D = new Promise((r) => (window.__kinetic3d = r));</script>
<script type="importmap">{ "imports": { "three": "/lib/vendor/three/three.module.min.js" } }</script>
${TAKEN.map((f) => `<script src="${f}"></script>`).join("\n")}
<script type="module" src="/reference/scenes/three.js"></script>
<script>
window.play = async (plan) => { await document.fonts.ready; await setupFilm(plan, { fit: false, sparks: false, scale: false }); return plan.duration; };
window.shoot = (t) => { drawFrame(t); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))); };
</script></body></html>`;

const serve = () => new Promise((resolve) => {
	const server = http.createServer((req, res) => {
		const url = new URL(req.url, "http://x");
		if (url.pathname === "/kinetic.html") {
			res.writeHead(200, { "content-type": "text/html" });
			return res.end(page());
		}
		// /reference/ is the engine as taken (its scripts, its styles, its model loader); the fonts and
		// the three.js files it asks for beside itself are the template's.
		const taken = url.pathname.startsWith("/reference/");
		const inside = path.normalize(taken ? url.pathname.slice("/reference".length) : url.pathname);
		let file = path.join(taken ? path.join(HERE, "reference", "engine") : SOURCE, inside);
		if (taken && !fs.existsSync(file)) file = path.join(SOURCE, "lib", inside.replace(/^\/vendor\//, "/vendor/three/"));
		if (!file.startsWith(TEMPLATE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
		res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
		fs.createReadStream(file).pipe(res);
	});
	server.listen(0, "127.0.0.1", () => resolve(server));
});

/** One scene of each type, as Kinetic's templates write it, pictures left out (none are here). */
const samples = () => {
	const templates = JSON.parse(fs.readFileSync(path.join(HERE, "templates.json"), "utf8"));
	const out = new Map();
	for (const t of templates) {
		for (const scene of t.scenes) {
			if (out.has(scene.type)) continue;
			const { image, images, ...rest } = scene;
			out.set(scene.type, JSON.parse(JSON.stringify(rest).replaceAll("{name}", "Nook").replaceAll("{NAME}", "NOOK").replaceAll("{url}", "nook.app").replaceAll("{tagline}", "Bookings that run themselves")));
		}
	}
	// The types no template uses, each as a scene written for the compare (samples.json).
	for (const scene of JSON.parse(fs.readFileSync(path.join(HERE, "samples.json"), "utf8"))) if (!out.has(scene.type)) out.set(scene.type, scene);
	return out;
};

const main = async () => {
	const puppeteer = brought("puppeteer-core");
	const compiler = require(path.join(SOURCE,"lib/compiler/plan.cjs"));
	const all = samples();
	// A scene the engine here has not got (the model's own HTML, a screen recording, the 3D models) is no case.
	const has = Object.keys(require(path.join(SOURCE, "lib", "compiler", "fields.cjs")));
	// A scene of ours that is changed from Kinetic's on purpose (changed.json says why) is no case
	// either: tools/audit.mjs holds it now.
	const changed = Object.keys(JSON.parse(fs.readFileSync(path.join(HERE, "changed.json"), "utf8")).scenes);
	const asked = option("scenes", null)?.split(",") ?? [...all.keys()].filter((t) => has.includes(t) && !changed.includes(t));
	const looks = option("looks", "editorial,poster").split(",");
	const unknown = asked.filter((t) => !all.has(t));
	if (unknown.length) throw new Error(`no sample of: ${unknown.join(", ")} (add one to samples.json)`);

	const server = await serve();
	const base = `http://127.0.0.1:${server.address().port}`;
	const browser = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb"] });
	const a = await browser.newPage();
	await a.setViewport({ width: 1920, height: 1080 });
	await a.goto(`${base}/kinetic.html`);
	const native = await createNativeBrowser({options:{ fit: false, sparks: false, scale: false }});
	const b = await native.newPage();
	if (OUT) fs.mkdirSync(OUT, { recursive: true });

	const W = 480, H = 270; // frames are compared and kept at a quarter of the size
	let failed = 0;
	console.log("scene            look        mean   share  errors");
	for (const type of asked) {
		for (const look of looks) {
			const film = { aspect: "16:9", style: look, brand: { name: "Nook", url: "nook.app", colors: ["#ff7a4d", "#2433ff"] }, scenes: [all.get(type)] };
			const errors = [];
			const frames = [[], []];
			let mean = 0, share = 0;
			for (const [i, p] of [a, b].entries()) {
				if(!i){p.removeAllListeners("pageerror");p.on("pageerror",err=>errors.push(`kinetic: ${err.message}`));}
				const length = i ? (await p.play(film)).duration : await p.evaluate(plan=>window.play(plan),compiler.compile(film));
				for (let k = 0; k < SAMPLES; k++) {
					const time=(length*(k+.5))/SAMPLES;
					if(i)await p.shoot(time);else {await p.bringToFront();await p.evaluate(t=>window.shoot(t),time);}
					const shot = await p.screenshot({ type: "png" });
					frames[i].push(await sharp(shot).resize(W, H).removeAlpha().raw().toBuffer());
				}
			}
			errors.push(...b.errors.map(error=>`native: ${error}`));
			for (let k = 0; k < SAMPLES; k++) {
				const [x, y] = [frames[0][k], frames[1][k]];
				let sum = 0, off = 0;
				for (let n = 0; n < x.length; n += 3) {
					const d = Math.max(Math.abs(x[n] - y[n]), Math.abs(x[n + 1] - y[n + 1]), Math.abs(x[n + 2] - y[n + 2]));
					sum += d;
					if (d > 24) off++;
				}
				mean = Math.max(mean, sum / (x.length / 3));
				share = Math.max(share, off / (x.length / 3));
			}
			const bad = mean > MEAN_MAX || share > SHARE_MAX || errors.length > 0;
			failed += bad ? 1 : 0;
			console.log(`${type.padEnd(16)} ${look.padEnd(10)} ${mean.toFixed(2).padStart(5)}  ${(share * 100).toFixed(2).padStart(5)}%  ${errors.length ? errors[0].slice(0, 90) : ""}${bad ? "  <-- differs" : ""}`);
			if (OUT) {
				const rows = [0, 1].map((i) => frames[i].map((raw, k) => ({ input: raw, raw: { width: W, height: H, channels: 3 }, left: k * W, top: i * H })));
				await sharp({ create: { width: W * SAMPLES, height: H * 2, channels: 3, background: "#000" } }).composite(rows.flat()).jpeg({ quality: 80 }).toFile(path.join(OUT, `${type}-${look}.jpg`));
			}
		}
	}
	await native.close();
	await browser.close();
	server.close();
	console.log(`${asked.length * looks.length} cases, ${failed} differ`);
	process.exit(failed ? 1 : 0);
};

main().catch((err) => {
	console.error(err.message);
	process.exit(2);
});
