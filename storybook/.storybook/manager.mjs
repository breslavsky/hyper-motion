import {addons} from 'storybook/manager-api';
import {create} from 'storybook/theming';
import {isSceneName, words} from '../src/names.mjs';

addons.setConfig({
  // The sidebar shows a scene's or a family's name as words (src/names.mjs).
  sidebar: {renderLabel: item => ['component', 'group'].includes(item.type) && isSceneName(item.name) ? words(item.name) : item.name},
  theme: create({base: 'light', brandTitle: 'Hyper Motion', brandUrl: './', brandTarget: '_self'}),
  panelPosition: 'bottom',
  layoutCustomisations: {
    // A sequence and the first page have no controls to show.
    showPanel: ({storyId}, current) => storyId?.startsWith('pure-kinetic-sequences-') || storyId?.startsWith('hyper-motion-') ? false : current,
    // The first page is a page, not a component: it has no format, brandbook or material to choose.
    showToolbar: ({storyId}, current) => storyId?.startsWith('hyper-motion-') ? false : current,
  },
});

// "by Motion Fab" under the name, with a link to the product the library
// grew in. The sidebar's header is Storybook's own, so the line is added to it
// once it is there.
const credit = () => {
  const header = document.querySelector('.sidebar-header');
  if (!header || document.getElementById('hm-credit')) return Boolean(header);
  const line = document.createElement('div');
  line.id = 'hm-credit';
  // The line is drawn up under the name, into the header's own box: it stands over that box, or the header takes its clicks.
  line.style.cssText = 'position:relative;z-index:2;margin:-11px 0 12px;padding:0 0 0 8px;font-size:12px;line-height:16px;color:#73828c';
  const link = Object.assign(document.createElement('a'), {href: 'https://www.motionfab.app', target: '_blank', rel: 'noopener', textContent: 'Motion Fab'});
  link.style.cssText = 'display:inline-block;padding:3px 6px 3px 0;margin:-3px 0;color:#2e5bff;text-decoration:none;font-weight:600;cursor:pointer';
  line.append('by ', link);
  header.after(line);
  return true;
};
// Storybook redraws the sidebar (a narrow window, a reload of the index): keep the line there.
new MutationObserver(credit).observe(document.documentElement, {childList: true, subtree: true});
credit();
