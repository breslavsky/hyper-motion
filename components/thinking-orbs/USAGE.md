# Thinking Orbs component

A transparent Canvas effect for an AI assistant thinking, searching, listening
or composing. Keep the project's existing GSAP on the parent page. The installer
returns a native HyperFrames mount snippet and records its entry in
`hyperframes.json`. Cite that entry path in the BUILD move's `by`.

Place the returned mount in the parent composition; adjust its start, duration,
track and `data-variable-values` for the shot. `x` and `y` are its top-left
position in composition pixels; `size` is the square's displayed size. The
effect has no background. `dark:true` draws light ink; `dark:false` draws dark
ink. `color` can supply a hex tint. Blank `label` draws no caption; a caption
inherits the parent scene's font and must fit the shot's text box.

States: `working`, `searching`, `solving`, `listening`, `connecting`, `weaving`,
`composing`, `breathing`, `shaping`. Each state uses the original published
Thinking Orbs 0.3.2 preset. The state is fixed per instance, with no morph between
states. `speed` defaults to 1, with 0 holding the initial geometry. `presetSize`
selects the original density (20, 32 or 64), independently of displayed `size`.

The component reads composition time through a paused native timeline and
supports repeated and backward seeks. It contains no network imports, React,
WebGL or autonomous animation loop. It reuses the parent's existing GSAP and
does not require an npm installation. Inspect the shot at several timestamps
with `harness check` and the template's frame-review workflow.

Keep this folder together when moving the definition: `thinking-orbs.html`,
`native.mjs`, `orb.mjs` and `vendor/`. The engine is unchanged; original authors,
MIT license and source hashes are preserved in `vendor/LICENSE` and
`vendor/SOURCE.json`; exact integrity and file hashes remain in
`vendor/INTEGRITY.json`.
