// The built site's root page says in plain HTML what the first page says, and
// nothing but the first page's own text is put into it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {landingHtml} from '../src/landing-page.mjs';
import {TITLE, withLanding} from '../scripts/static-landing.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../generated/catalog.json', import.meta.url), 'utf8'));
const BUILT = '<!doctype html><html><head><title>storybook - Storybook</title></head><body>\n<div id="root"></div>\n<script>window.x = 1;</script></body></html>';

test('the first page is whole as text, with no script of its own', {skip: !fs.existsSync(new URL('../storybook-static/index.json', import.meta.url)) && 'no built site to check the links against'}, () => {
  const html = landingHtml(catalog);
  for (const words of ['Ultimate Hyper Frames<br>Components Pack', 'Your AI agent can do HTML to video', 'Free &amp; Open Source', 'Apple Glass', 'Flat Motion', 'B-Rolls', 'What every scene does', 'What it is for', `${catalog.length} scenes`]) assert.ok(html.includes(words), words);
  assert.ok(!/<script|\son\w+=/i.test(html));
  // Every link inside the site leads to a page that exists.
  const index = JSON.parse(fs.readFileSync(new URL('../storybook-static/index.json', import.meta.url), 'utf8'));
  for (const [, id] of html.matchAll(/\?path=\/(?:docs|story)\/([^"]+)"/g)) assert.ok(index.entries[id], id);
});

test('the built page carries the first page, its styles and its title', () => {
  const page = withLanding(BUILT, {body: landingHtml(catalog), css: '.hm-landing { color: red; }'});
  assert.ok(page.includes(`<title>${TITLE}</title>`));
  assert.ok(page.includes('<style>.hm-landing { color: red; }</style>'));
  assert.match(page, /<div id="root"><main class="hm-landing">[\s\S]*What it is for[\s\S]*<\/main><\/div>/);
  assert.ok(page.includes('window.x = 1;'));
});

test('a built page of another shape is refused, not guessed at', () => {
  assert.throws(() => withLanding(BUILT.replace('<div id="root"></div>', '<div id="app"></div>'), {body: '', css: ''}), /once/);
  assert.throws(() => withLanding(BUILT.replace(/<title>.*<\/title>/, ''), {body: '', css: ''}), /title/);
});
