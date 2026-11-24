import sequences from '../generated/sequences.json';
import {renderSequence} from '../src/render.mjs';

const example = sequences.find(item => item.id === 'folio');
export default {
  title: 'Pure Kinetic/Sequences/folio',
  tags: ['autodocs'],
  globals: example.globals,
  parameters: {controls: {disable: true}, docs: {description: {component: example.description}}},
  render: (_args, context) => renderSequence(example, context.globals),
};
export const Continuous = {name: 'Folio — Continuous Story'};
