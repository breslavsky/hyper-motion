// The finish's pages in the Storybook: every example is a finish the component
// takes, on moments of the page's own film, and each is written out as a page.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {finishExamples} from '../src/finish-examples.mjs';
import {createFinish} from '../../components/finish/finish.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('every example is a finish the component takes, inside the page\'s length', () => {
  assert.deepEqual(finishExamples.map(example => example.id), ['everything', 'plain', 'stock', 'hits', 'heavy']);
  for (const example of finishExamples) {
    assert.ok(example.name && example.description.length > 60, example.id);
    for (const moment of example.moments) assert.ok(moment.at >= 0 && moment.at < example.duration, `${example.id}: ${moment.label}`);
    if (!example.recipe) continue;
    const finish = createFinish({duration: example.duration, fps: 30, ...example.recipe});
    // The same moment gives the same frame, whatever was asked before: a page seeks and renders alike.
    const once = JSON.stringify(finish.at(2.06));
    finish.at(5);
    assert.equal(JSON.stringify(finish.at(2.06)), once, example.id);
    for (const event of [...(example.recipe.flashes ?? []), ...(example.recipe.shakes ?? [])]) assert.ok(event.t < example.duration, example.id);
  }
});

test('the example with everything on flashes, shakes and parts its colours on the page\'s own moments', () => {
  const all = finishExamples.find(example => example.id === 'everything');
  const finish = createFinish({duration: all.duration, fps: 30, ...all.recipe});
  assert.equal(finish.at(1.02).flash.kind, 'white');
  assert.equal(finish.at(0.5).flash.amount, 0);
  const thrown = finish.at(2.06).shake, still = finish.at(0.5).shake;
  assert.ok(Math.hypot(thrown.x, thrown.y) > 0 && Math.hypot(still.x, still.y) === 0);
  assert.ok(finish.at(2.03).fringe > finish.at(0.5).fringe);
  // The comparison page lays nothing over the film.
  assert.equal(finishExamples.find(example => example.id === 'plain').recipe, null);
});

test('the build writes a page for each example and the component beside them', {skip: !fs.existsSync(path.join(here, '../public/pk'))}, () => {
  const out = path.join(here, '../public/pk');
  assert.equal(fs.readFileSync(path.join(out, 'finish/finish.mjs'), 'utf8'), fs.readFileSync(path.join(here, '../../components/finish/finish.mjs'), 'utf8'));
  for (const example of finishExamples) {
    const page = fs.readFileSync(path.join(out, `finish-${example.id}.html`), 'utf8');
    assert.ok(!/__[A-Z]+__/.test(page), `${example.id}: a placeholder is left in the page`);
    assert.ok(page.includes('data-finish') && page.includes("import('./finish/finish.mjs')"), example.id);
  }
});
