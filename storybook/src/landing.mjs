// The Storybook's first page: the site's first page (landing-page.mjs) on a
// page of the Storybook.
import catalog from '../generated/catalog.json';
import {landingHtml} from './landing-page.mjs';

export function renderLanding() {
  const page = Object.assign(document.createElement('main'), {className: 'hm-landing'});
  page.innerHTML = landingHtml(catalog);
  // A clip plays only while it is on the screen.
  const seen = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) { if (isIntersecting) target.play().catch(() => {}); else target.pause(); }
  }, {threshold: .2});
  for (const clip of page.querySelectorAll('.hm-play video')) seen.observe(clip);
  return page;
}
