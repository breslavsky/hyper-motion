// Every scene of the kit has a card for whoever chooses a scene: what the
// viewer sees, in one sentence, and the shots it is a start for. A search and
// a model read the cards (the guide's lines explain fields instead), so a
// scene without a card is a scene nobody finds.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(HERE, '../source/lib/components', name), 'utf8'));
const catalog = read('catalog.json'), cards = read('cards.json');

test('every scene type has a card, and no card is left of a scene that is gone', () => {
  assert.deepEqual(Object.keys(cards), Object.keys(catalog));
});

test('a card says what is seen in one sentence and names the shots it is for', () => {
  for (const [type, card] of Object.entries(cards)) {
    assert.deepEqual(Object.keys(card), ['shows', 'for'], type);
    assert.ok(card.shows.length >= 40 && card.shows.length <= 260 && card.shows.endsWith('.'), `${type}: shows is ${card.shows.length} characters`);
    // Fields and limits belong to the guide: a card is read by somebody who has not chosen the scene yet.
    assert.ok(!/[{}<>]|\?:|<=/.test(card.shows), `${type}: shows explains fields`);
    assert.ok(Array.isArray(card.for) && card.for.length >= 2 && card.for.length <= 5, `${type}: for has ${card.for?.length} uses`);
    for (const use of card.for) assert.ok(typeof use === 'string' && use.length >= 4 && use.length <= 70 && !use.endsWith('.'), `${type}: "${use}"`);
    assert.equal(new Set(card.for).size, card.for.length, `${type}: a use twice`);
  }
});

test('no two scenes show the same thing in the same words', () => {
  const seen = new Map();
  for (const [type, card] of Object.entries(cards)) {
    assert.ok(!seen.has(card.shows), `${type} and ${seen.get(card.shows)}`);
    seen.set(card.shows, type);
  }
});
