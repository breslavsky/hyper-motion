// Evaluates the app's scene schema (the builder calls of its validation library, minified, on
// stdin) with stand-in builders that record what each field is, and prints {type: {field: spec}}.
// The bundle (argument) gives the two lists the schema names. Run by extract.py.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const list = (name) => JSON.parse(src.match(new RegExp(`[,;]${name}=(\\[[^\\]]*\\])`))[1]);
const make = (spec) => {
	const known = {
		optional: () => make({ ...spec, optional: true }),
		default: () => make({ ...spec, optional: true }),
		min: (n) => make({ ...spec, min: n }),
		max: (n) => make({ ...spec, max: n }),
		int: () => make({ ...spec, int: true }),
	};
	// any other step of the chain (trim, refine, transform...) changes nothing we record
	return new Proxy({ spec }, { get: (target, key) => (key === "spec" ? spec : (known[key] ?? (() => make(spec)))) });
};
const unwrap = (v) => (v && v.spec ? v.spec : v);
const Ne = () => make({ kind: "string" });
const R = (n) => make({ kind: "string", min: 1, max: n });
const Ae = () => make({ kind: "number" });
const Mt = () => make({ kind: "bool" });
const Et = (values) => make({ kind: "enum", values });
const ae = (value) => make({ kind: "literal", value });
const ue = (of) => make({ kind: "array", of: unwrap(of) });
const ne = (fields) => make({ kind: "object", fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, unwrap(v)])) });
const ci = make({ kind: "colour" });
const fw = make({ kind: "rect" });
const li = list("li"), tu = list("tu");
const oe = {};
const unknown = new Proxy(() => make({ kind: "any" }), { get: () => () => make({ kind: "any" }) });
const mh = make({ kind: "any" }), dw = unknown, pw = unknown;
const ii = (parts) => make({ kind: "tuple", of: parts.map(unwrap) });
const schemas = eval(fs.readFileSync(0, "utf8"));
const out = {};
for (const s of schemas) {
	const { type, ...fields } = s.spec.fields;
	out[type.value] = fields;
}
process.stdout.write(JSON.stringify(out));
