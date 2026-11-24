// A sheet of frames drawn through the native HyperFrames compiler and seek API,
// with no running worker: what a look or a scene looks like, at a glance.
//
//   node templates/pure-kinetic/tools/sheet.mjs <film.json | -> --out sheet.jpg
//        [--looks liquid,frost] [--aspect 9:16] [--samples 8] [--scenes 2,3] [--palette brand]
//   node templates/pure-kinetic/tools/sheet.mjs --previews
//
// --previews writes the pictures of the Look panel (panels/look/previews/<look>.jpg): one frame
// of the same title in every look. Run it after a look is added or changed.
//
// One row per look (the film's own without --looks), `--samples` frames across the film; with
// `--scenes` (counted from 1) a row per scene named, in each look. Page errors are printed and make the
// exit code 1. Needs the template's packages (puppeteer-core, sharp) and Chrome, as frames.mjs.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createNativeBrowser, sharp } from "./migration-browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(HERE, "..");
const SOURCE = path.join(TEMPLATE, "source");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const PREVIEWS = args.includes("--previews");
const input = args[0] && !args[0].startsWith("--") ? args[0] : path.join(SOURCE, "film.json");
// The film of the previews: one title, the same in every look.
const film = PREVIEWS
	? { aspect: "16:9", style: "editorial", brand: { name: "Nook" }, scenes: [{ type: "title", beats: 4, text: "Meet *Nook*.", sub: "Introducing" }] }
	: JSON.parse(fs.readFileSync(input === "-" ? 0 : input, "utf8"));
const OUT = option("out", "sheet.jpg");
const SAMPLES = Number(option("samples", 8));
if (option("aspect", null)) film.aspect = option("aspect");
if (option("palette", null)) film.palette = option("palette");
const looks = PREVIEWS ? Object.keys(require(path.join(SOURCE, "lib", "compiler", "plan.cjs")).looks) : option("looks", film.style).split(",");
const only = option("scenes", null)?.split(",").map((n) => Number(n) - 1);

const { aspects } = require(path.join(SOURCE, "lib", "compiler", "plan.cjs"));
const { width, height } = aspects[film.aspect];
const browser = await createNativeBrowser();
const tab = await browser.newPage();
await tab.setViewport({ width, height });
const errors = [];
tab.on("pageerror", (err) => errors.push(err.message));
tab.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
const w = Math.round(width > height ? 480 : (480 * width) / height / (width === height ? 1 : 1.2));
const h = Math.round((w * height) / width);
if (PREVIEWS) {
	const dir = path.join(TEMPLATE, "panels", "look", "previews");
	fs.mkdirSync(dir, { recursive: true });
	for (const look of looks) {
		const played = await tab.play({ ...film, style: look });
		await tab.shoot(played.duration * 0.62);
		await sharp(await tab.screenshot({ type: "png" })).resize(360, 203).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(dir, `${look}.jpg`));
	}
	await browser.close();
	for (const e of [...new Set(errors)]) console.error(`page error: ${e}`);
	console.log(`${looks.length} previews -> ${dir}`);
	process.exit(errors.length ? 1 : 0);
}
const tiles = [];
let rows = 0;
for (const look of looks) {
	const played = await tab.play({ ...film, style: look });
	// A row per scene named, or one row of the whole film.
	const spans = only ? only.map((i) => played.scenes[i]).filter(Boolean) : [[0, played.duration]];
	for (const [start, dur] of spans) {
		for (let k = 0; k < SAMPLES; k++) {
			await tab.shoot(start + (dur * (k + 0.5)) / SAMPLES);
			tiles.push({ input: await sharp(await tab.screenshot({ type: "png" })).resize(w, h).png().toBuffer(), left: k * w, top: rows * h });
		}
		rows++;
	}
}
await sharp({ create: { width: w * SAMPLES, height: h * rows, channels: 3, background: "#000" } }).composite(tiles).jpeg({ quality: 82 }).toFile(OUT);
await browser.close();
for (const e of [...new Set(errors)]) console.error(`page error: ${e}`);
console.log(`${OUT}: ${rows} rows x ${SAMPLES} frames`);
process.exit(errors.length ? 1 : 0);
