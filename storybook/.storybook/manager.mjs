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

// The library's own icon before its name, and a line under it that says what
// the library is. The sidebar's header is Storybook's own, so both are added
// to it once it is there.
const credit = () => {
  const header = document.querySelector('.sidebar-header');
  if (!header) return false;
  // The name is the header's link that says it; another link there skips to the canvas.
  const name = [...header.querySelectorAll('a')].find(link => link.textContent.trim() === 'Hyper Motion');
  if (name && !document.getElementById('hm-icon')) {
    const icon = Object.assign(document.createElement('img'), {id: 'hm-icon', src: './icon.svg', alt: '', width: 22, height: 22});
    icon.style.cssText = 'flex:none;margin-right:8px;border-radius:6px;vertical-align:-5px';
    name.prepend(icon);
  }
  // What the library is, in a line under its name. The line is drawn up into
  // the header's own box, and is no link: it takes no clicks from the header.
  if (!document.getElementById('hm-says')) {
    const line = Object.assign(document.createElement('div'), {id: 'hm-says', textContent: 'After Effects alternative'});
    line.style.cssText = 'margin:-9px 0 12px;padding:0 0 0 38px;font-size:12px;line-height:16px;color:#73828c;pointer-events:none';
    header.after(line);
  }
  return true;
};
// Storybook redraws the sidebar (a narrow window, a reload of the index): keep the icon there.
new MutationObserver(credit).observe(document.documentElement, {childList: true, subtree: true});
credit();
