import {cameraExamples} from '../src/camera-examples.mjs';
import {renderCamera} from '../src/camera-page.mjs';

const story = id => { const example = cameraExamples.find(item => item.id === id); return {name: example.name, render: () => renderCamera(example)}; };
export default {title: 'Camera', parameters: {controls: {disable: true}, layout: 'fullscreen'}};
export const Tour = story('tour');
export const Tripod = story('tripod');
export const Sentence = story('sentence');
export const Interface = story('interface');
export const Feed = story('feed');
