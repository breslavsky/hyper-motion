import {renderLanding} from '../src/landing.mjs';

export default {
  title: 'Hyper Motion',
  parameters: {controls: {disable: true}},
  render: (_args, _context) => renderLanding(),
};
export const Welcome = {name: 'Welcome'};
