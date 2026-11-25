// What a search engine and a shared link read of the site: Storybook writes
// the page's own title, so the description and the card are given here.
const ABOUT = 'Hyper Motion: a free, open-source pack of motion-design scenes for HyperFrames. An After Effects alternative for AI motion graphics your agent writes as code: HTML to video, HTML to MP4.';
const about = head => `${head ?? ''}
<meta name="description" content="${ABOUT}">
<meta name="keywords" content="after effects alternative, free after effects alternative, ai motion graphics, motion graphics ai generator, html to video, html to mp4, remotion alternative, hyperframes, hyperframes components, claude code video, claude skills, motion design, kinetic typography, liquid glass">
<meta property="og:type" content="website">
<meta property="og:title" content="Hyper Motion: Ultimate Hyper Frames Components Pack">
<meta property="og:description" content="${ABOUT}">
<meta name="twitter:card" content="summary">
<meta name="twitter:creator" content="@AntonBreslavsky">`;

export default {
  managerHead: about,
  stories: ['../generated/*.stories.mjs', '../stories/*.stories.mjs'],
  addons: ['@storybook/addon-docs'],
  framework: {name: '@storybook/html-vite', options: {}},
  staticDirs: ['../public'],
  core: {disableTelemetry: true},
  // No "Level up" checklist in the sidebar: it is Storybook's own onboarding.
  features: {sidebarOnboardingChecklist: false},
};
