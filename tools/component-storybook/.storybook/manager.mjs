import {addons} from 'storybook/manager-api';
import {create} from 'storybook/theming';

addons.setConfig({
  theme: create({base: 'light', brandTitle: 'Pure Kinetic', brandTarget: '_self'}),
  panelPosition: 'bottom',
  layoutCustomisations: {
    showPanel: ({storyId}, current) => storyId?.startsWith('pure-kinetic-sequences-') ? false : current,
  },
});
