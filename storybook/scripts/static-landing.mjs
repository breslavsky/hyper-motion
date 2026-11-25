// The built site's root page with the first page written into it. Storybook
// draws everything with scripts, so the page it builds holds no words, and a
// search engine or a link preview that runs no script reads an empty site.
// After `storybook build` this writes the first page (src/landing-page.mjs,
// the same text the Storybook shows) with its styles into the root element,
// which Storybook empties when it starts, and gives the page its own title.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {landingHtml} from '../src/landing-page.mjs';

export const TITLE = 'Hyper Motion: Ultimate Hyper Frames Components Pack';
const ROOT = '<div id="root"></div>';
// The first page is what the site opens on. An address of another page gets
// that page, so the first page is not shown before it.
const OTHER_PAGE = `<script>{const page = new URLSearchParams(location.search).get('path'); if (page && !page.endsWith('hyper-motion--welcome')) document.querySelector('#root > main').remove();}</script>`;

const once = (page, part) => {
  if (page.split(part).length !== 2) throw new Error(`static landing: the built page should hold ${JSON.stringify(part)} once`);
};

// `page`: Storybook's built index.html; `body`: the first page; `css`: its styles.
export function withLanding(page, {body, css}) {
  once(page, ROOT);
  once(page, '</head>');
  const title = page.match(/<title>[^<]*<\/title>/g) ?? [];
  if (title.length !== 1) throw new Error('static landing: the built page should hold one title');
  return page
    .replace(title[0], () => `<title>${TITLE}</title>`)
    .replace('</head>', () => `<style>${css}</style>\n</head>`)
    .replace(ROOT, () => `<div id="root"><main class="hm-landing">\n${body}\n</main></div>\n${OTHER_PAGE}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(here, '../storybook-static/index.html');
  const catalog = JSON.parse(fs.readFileSync(path.join(here, '../generated/catalog.json'), 'utf8'));
  const css = fs.readFileSync(path.join(here, '../src/landing.css'), 'utf8');
  fs.writeFileSync(file, withLanding(fs.readFileSync(file, 'utf8'), {body: landingHtml(catalog), css}));
  console.log(`static landing: written into ${path.relative(process.cwd(), file)}`);
}
