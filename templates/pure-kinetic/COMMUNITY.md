# Community components, batch 01

Five published motion techniques became native components: `polar`,
`letterflip`, `accordion`, `explode`, and `scan`. The catalogue now contains
100 types, including 17 derived from community techniques. This is a bounded
first batch, not a claim that every technique in the remote library has been
converted. The library exposes search and retrieval, not a popularity ranking.

The public examples were research inputs. Their compositions, fonts, colours
and media are not shipped. Each implementation uses the existing component
contract: private DOM and native clock, centrally supplied brand tokens,
measured responsive layout, and one local schedule for motion and sound.
Source UUIDs and recipe URLs are in `tools/techniques.json` and the component
`SOURCE.json`; the field passports and sample event schedules are in
`tools/community-passports.json`. Canonical editable fields remain in
`source/lib/components/metadata.cjs`.

## Boundaries that matter

- Text fitting respects the common label floor: 36 px on a 1080 px short side,
  39.6 px in portrait. Field limits and cross-field validation reject content
  outside the component contract before building. Fitting alone does not
  provide reading time; check the final film at its actual pace and BPM.
- Accordion images correspond one-to-one with its labels. Scan categories
  use explicit 1-based indexes or deterministic round-robin assignment.
  Its optional image is divided into fixed cells, not analyzed for objects.
- Fonts and colours can change centrally or per native instance. Changing
  content updates the visual schedule; the mixed soundtrack still requires
  the normal rebuild/audio step. Muting a component preserves visual cues.
- These are scene components. They do not introduce a second film player or
  turn unrelated scenes into one persistent actor/world simulation.
- None existed in the original frozen 95-component engine. Reference
  acceptance explicitly records them as native-only; it still checks native
  clocks, geometry, state and reverse seeking. The earlier 402-case migration
  receipt remains historical and is not relabeled as testing 100 components.

## Reproduce acceptance

From the template directory, with the pinned dependencies installed:

```sh
node --test tools/migration-components.test.mjs tools/migration-timing.test.mjs tools/community-*.test.mjs
node tools/community-native.mjs --out /tmp/pk-community-native
node tools/community-shapes-native.mjs --out /tmp/pk-community-shapes
node tools/community-depth-native.mjs --out /tmp/pk-community-depth
node tools/community-scan-native.mjs --out /tmp/pk-community-scan
node tools/audit.mjs --scenes polar,letterflip,accordion,explode,scan --looks editorial,sting,liquid,frost,noir --aspects 9:16,16:9,1:1 --twice --json /tmp/pk-community-audit.json
```

`community-native` mounts two copies of each new definition with different
content, fonts and colours, and checks independent clocks and reverse DOM.
The family probes cover joined scripts and emoji; depth projections and real
images; scan crossings, exact destination slots and sound-event timestamps.
They are separate from the text audit. A final HyperFrames `check` also measures
reading time, which the older picture audit does not.

`tools/community-demo.json` is the English six-scene demonstration. Copy the
template's `source/` to a new project, use this file as `film.json`, set `aspect`
to `9:16`, `1:1` or `16:9`, then run `node lib/film.cjs fit` and the normal audio
step. The renderable project remains fully editable in HyperFrames.

`tools/community-acceptance.json` records the measured batch checks, source
hashes and limitations. Separate snapshots stay separate; a later scene fix
requires its affected probes to run again. Local exports and acceptance do not
deploy a worker or rewrite saved user projects.
