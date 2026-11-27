// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {DOUBLE} from '../_shared/ground.mjs';
// ---- wave: a voice, its waveform and the words it says ---------------------------------------------
// A player pill with a live waveform; the transcript appears under it word by word, the spoken word
// lit, like karaoke. A small label sits above. Seen in Benji Taylor's Grok voice launch.
export const factory = ({ p, cam, fg, accent, palette, bg, K }) => {
	const { W, H, S, el, set, px, clamp, prog, hash, lum, alpha, mixHex, ease: E } = K;
	const D = K.design;
	const s = p.scene;
	const d0 = p.dur;
	const vertical = H > W * 1.2;
	const light = lum(bg) > 0.45;
	const label = DOUBLE(s.label || "");
	const said = String(s.text || "Hi, I booked your table for eight.").split(/\s+/).filter(Boolean);
	const pw = vertical ? W * 0.86 : W * 0.56;
	const ph = (vertical ? 136 : 130) * S;
	const py = H * (vertical ? 0.4 : 0.38) - ph / 2;
	const pill = el("div", "", cam);
	set(pill, { position: "absolute", left: px((W - pw) / 2), top: px(py), width: px(pw), height: px(ph), background: light ? "#ffffff" : mixHex(bg, "#ffffff", 0.08), boxShadow: `0 ${px(20 * S)} ${px(60 * S)} ${alpha("#000000", light ? 0.12 : 0.4)}`, willChange: "transform" });
	const playerBox = D.surface(pill, "field", { density: "compact", shape: "pill", layout: "absolute" });
	const play = el("div", "", pill);
	const pb = ph * 0.62, playPulse = .04;
	const playLeft = playerBox.paddingX + pb * playPulse / 2;
	set(play, { position: "absolute", left: px(playLeft), top: px((ph - pb) / 2), width: px(pb), height: px(pb), borderRadius: "50%", background: accent });
	D.surfaceContent(pill, play);
	const tri = el("div", "", play);
	set(tri, { position: "absolute", left: "54%", top: "50%", width: "0", height: "0", borderLeft: `${px(pb * 0.28)} solid ${K.textOn(accent)}`, borderTop: `${px(pb * 0.18)} solid transparent`, borderBottom: `${px(pb * 0.18)} solid transparent`, transform: "translate(-50%,-50%)" });
	const time = el("div", "", pill, "0:00");
	set(time, { position: "absolute", right: px(playerBox.paddingX), top: px((ph - D.type("code").lineHeight) / 2), color: alpha(light ? "#111111" : "#ffffff", 0.55) });
	D.surfaceContent(pill, time);
	D.apply(time,"code");
	const n = vertical ? 34 : 56;
	const barStart = playLeft + pb * (1 + playPulse / 2) + playerBox.gap;
	const barArea = { x: barStart, w: pw - playerBox.paddingX - time.offsetWidth - playerBox.gap - barStart };
	const bw = barArea.w / n;
	const bars = Array.from({ length: n }, (_, i) => {
		const b = el("div", "", pill);
		set(b, { position: "absolute", left: px(barArea.x + i * bw + bw * 0.2), top: "50%", width: px(bw * 0.6), borderRadius: px(bw), background: mixHex(accent, palette.butter ?? "#ffcc66", (i / n) * 0.6) });
		D.surfaceContent(pill, b);
		return b;
	});
	let labelN = null;
	if (label) {
		labelN = el("div", "", cam, label);
		set(labelN, { position: "absolute", left: px(K.safe.x), width: px(K.safe.w), top: px(py - 84 * S), textAlign: "center", color: fg, opacity: "0.7" });
		D.apply(labelN,"label");
		D.truncateLine(labelN);labelN.title = label;
	}
	const tr = el("div", "display", cam);
	const fs = (vertical ? 84 : 84) * S;
	set(tr, { position: "absolute", left: px(W * 0.08), width: px(W * 0.84), top: px(py + ph + 70 * S), textAlign: "center", color: fg });
	D.apply(tr,"sceneTitle");
	const wordNs = said.map((w, i) => {
		if (i) tr.appendChild(document.createTextNode(" "));
		const em = /^\*.*\*[.,!?]?$/.test(w);
		const sp = el("span", "", tr, w.replace(/\*/g, ""));
		set(sp, { display: "inline-block", color: em ? accent : fg });
		if (em && K.plan?.look?.display?.accent === "serif") sp.style.fontStyle = "italic";
		return sp;
	});
	// The voice begins on the film's beat (`p.at`) and is done before the scene is.
	const tTalk = p.at.talk;
	const talkDur = Math.max(1.2, Math.min(d0 - tTalk - 0.45, said.length * 0.28));
	const wordT = (i) => tTalk + (i / said.length) * talkDur;
	return (l) => {
		const a = E.softLand(prog(l, 0, 0.5));
		set(pill, { opacity: clamp(a * 3).toFixed(3), transform: `translateY(${px((1 - a) * 30 * S)}) scale(${(1.06 - 0.06 * a).toFixed(4)})` });
		if (labelN) set(labelN, { opacity: (0.7 * E.softLand(prog(l, 0.15, 0.4))).toFixed(3) });
		const talking = l >= tTalk && l <= tTalk + talkDur;
		const env = talking ? 0.35 + 0.65 * Math.abs(Math.sin((l - tTalk) * 5.3)) * (0.6 + 0.4 * Math.sin((l - tTalk) * 1.7 + 1)) : 0.06;
		bars.forEach((b, i) => {
			const v = talking ? clamp(env * (0.35 + 0.65 * Math.abs(Math.sin(l * 11 + i * 0.9 + hash(i) * 6) * Math.cos(l * 4.7 + i * 0.37)))) : 0.08 + 0.04 * Math.sin(l * 2 + i * 0.5);
			const h = ph * 0.62 * Math.max(0.08, v);
			set(b, { height: px(h), top: px((ph - h) / 2), opacity: (0.45 + 0.55 * Math.max(0.15, v)).toFixed(3) });
		});
		const sec = Math.max(0, Math.min(talkDur, l - tTalk));
		time.textContent = `0:${String(Math.floor(sec + 0.0001) % 60).padStart(2, "0")}`;
		set(play, { transform: `scale(${(talking ? 1 + playPulse * Math.sin(l * 8) : 1).toFixed(4)})` });
		wordNs.forEach((w, i) => {
			const k = E.softLand(prog(l, wordT(i), 0.3));
			// The spoken word is lit; once the voice is done, the whole line is.
			const lit = l >= wordT(i) && (i === said.length - 1 || l < wordT(i + 1) + 0.15 || l > tTalk + talkDur + 0.2);
			set(w, { opacity: (k * (lit ? 1 : 0.42)).toFixed(3), transform: `translateY(${px((1 - k) * fs * 0.3)})` });
		});
	};
};
