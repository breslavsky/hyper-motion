import settings from '../generated/settings.json';
import brandbooks from '../generated/brandbooks.json';
import {DEFAULT_BRANDBOOK, DEFAULT_FONT, DEFAULT_LOOK} from '../src/model.mjs';
import '../src/story.css';
import '../src/landing.css';
import page from './docs-page.mjs';

export default {
  globalTypes: {
    aspect: {description: 'Composition aspect ratio', toolbar: {title: 'Format', dynamicTitle: true, items: [
      {value: 'landscape', title: '16:9'}, {value: 'portrait', title: '9:16'}, {value: 'square', title: '1:1'},
    ]}},
    // A look is the kit's own: how text comes in, its transitions, its texture and its colours.
    // The brandbook beside it is only colours and a font, and changes nothing of how a scene moves.
    look: {description: 'The look: how text comes in, transitions, texture and colours', toolbar: {title: 'Look', dynamicTitle: true,
      items: settings.looks.map(value=>({value,title:`Look: ${value[0].toUpperCase()}${value.slice(1)}${value===DEFAULT_LOOK?' (default)':''}`}))}},
    brandbook: {description: 'Brand colors and font', toolbar: {title: 'Brandbook', dynamicTitle: true,
      items: [{value:DEFAULT_BRANDBOOK,title:'Default'},
        ...Object.entries(brandbooks).map(([value,book])=>({value,title:book.label}))]}},
    font: {description: 'Font family', toolbar: {title: 'Font', dynamicTitle: true,
      // "As in the brandbook" keeps the brandbook's font, or the style's own when it names none.
      items: [{value:DEFAULT_FONT,title:'Font: as in the brandbook'}, ...settings.fonts.map(value=>({value,title:value}))]}},
    material: {description: 'Surface material for 3D Liquid Glass components', toolbar: {title: '3D material', dynamicTitle: false,
      // "example" leaves each named material example on its own material; any
      // other choice switches every preview on the page.
      items: [{value:'example',title:'As in the example'},
        ...settings.materials.map(value=>({value,title:({glass:'Glass','dark-glass':'Dark Glass',metal:'Metal'})[value]??value}))]}},
  },
  initialGlobals: {aspect: 'landscape', look: DEFAULT_LOOK, brandbook: DEFAULT_BRANDBOOK, font: DEFAULT_FONT, material: 'example'},
  parameters: {
    layout: 'fullscreen',
    controls: {expanded: true, sort: 'requiredFirst'},
    // Glass first, then the scenes drawn in depth, then every other family by name.
    options: {storySort: {order: ['Hyper Motion', 'Glass', ['glass-search', 'glass-send-prompt', 'glass-ask', 'glass-island', 'glass-steps', 'glass-stepper', 'glass-checklist', 'glass-message', 'glass-call', 'glass-follow', 'glass-like', 'glass-rating', 'glass-lens', '*'], 'Rides', 'Camera', 'Finish', 'B-Rolls', '3D', 'Kinetic Text', 'Pure Kinetic']}},
    docs: {toc: true, page},
  },
};
