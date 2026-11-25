import {renderLanding} from '../src/landing.mjs';
import {renderInstall} from '../src/install.mjs';

export default {
  title: 'Hyper Motion',
  parameters: {controls: {disable: true}},
  render: (_args, _context) => renderLanding(),
};
export const Welcome = {name: 'Welcome'};
export const Install = {name: 'Install', render: (_args, _context) => renderInstall()};
