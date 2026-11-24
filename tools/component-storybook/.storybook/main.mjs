import {readCatalogOptions} from '../src/catalog-data.mjs';

// Repair shared links before either Storybook router reads the location.
const {materialComponents} = readCatalogOptions();
const renamed = materialComponents.includes('send-prompt') && !materialComponents.includes('glass-pullback');
const storyLinks = head => !renamed ? head : (head ?? '') + String.raw`<script>
  (() => {
    const url = new URL(location.href);
    for (const key of ['path', 'id']) {
      const value = url.searchParams.get(key);
      if (!value) continue;
      const next = value.replace(/^(\/?(?:story|docs)\/)?(pure-kinetic-glass-|glass-)glass-pullback--/, '$1$2send-prompt--');
      if (next !== value) url.searchParams.set(key, next);
    }
    if (url.href !== location.href) history.replaceState(history.state, '', url.href);
  })();
</script>`;

export default {
  stories: ['../generated/*.stories.mjs', '../stories/*.stories.mjs'],
  addons: ['@storybook/addon-docs'],
  framework: {name: '@storybook/html-vite', options: {}},
  staticDirs: ['../public'],
  managerHead: storyLinks,
  previewHead: storyLinks,
  core: {disableTelemetry: true},
};
