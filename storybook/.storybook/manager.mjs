import {addons} from 'storybook/manager-api';
import {create} from 'storybook/theming';

addons.setConfig({
  theme: create({base: 'light', brandTitle: 'Hyper Motion', brandUrl: './', brandTarget: '_self'}),
  panelPosition: 'bottom',
  layoutCustomisations: {
    showPanel: ({storyId}, current) => storyId?.startsWith('pure-kinetic-sequences-') ? false : current,
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
  line.style.cssText = 'margin:-11px 0 12px;padding:0 0 0 8px;font-size:12px;line-height:16px;color:#73828c';
  const link = Object.assign(document.createElement('a'), {href: 'https://www.motionfab.app', target: '_blank', rel: 'noopener', textContent: 'Motion Fab'});
  link.style.cssText = 'color:#2e5bff;text-decoration:none;font-weight:600';
  line.append('by ', link);
  header.after(line);
  return true;
};
// Storybook redraws the sidebar (a narrow window, a reload of the index): keep the line there.
new MutationObserver(credit).observe(document.documentElement, {childList: true, subtree: true});
credit();
