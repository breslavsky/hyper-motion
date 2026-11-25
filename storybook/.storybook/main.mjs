export default {
  stories: ['../generated/*.stories.mjs', '../stories/*.stories.mjs'],
  addons: ['@storybook/addon-docs'],
  framework: {name: '@storybook/html-vite', options: {}},
  staticDirs: ['../public'],
  core: {disableTelemetry: true},
  // No "Level up" checklist in the sidebar: it is Storybook's own onboarding.
  features: {sidebarOnboardingChecklist: false},
};
