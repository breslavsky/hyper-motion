import {finishExamples} from '../src/finish-examples.mjs';
import {renderFinish} from '../src/finish-page.mjs';

const story = id => { const example = finishExamples.find(item => item.id === id); return {name: example.name, render: () => renderFinish(example)}; };
export default {title: 'Finish', parameters: {controls: {disable: true}, layout: 'fullscreen'}};
export const Everything = story('everything');
export const Plain = story('plain');
export const Stock = story('stock');
export const Hits = story('hits');
export const Heavy = story('heavy');
