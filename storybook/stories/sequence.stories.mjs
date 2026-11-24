import sequences from '../generated/sequences.json';
import {renderSequence} from '../src/render.mjs';

const example = sequences.find(item => item.id === 'idea-to-action');
export default {
  title: 'Pure Kinetic/Sequences/idea-to-action',
  tags: ['autodocs'],
  globals: example.globals,
  parameters: {controls: {disable: true}, docs: {description: {component: example.description}}},
  render: (_args, context) => renderSequence(example, context.globals),
};
export const Sequence = {name: 'From Idea to Action'};
