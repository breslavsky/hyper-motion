// A scene's docs page: the player first, so it is seen on entering the page;
// what the scene is for and its fields follow it.
import React from 'react';
import {Title, Primary, Description, Controls, Stories} from '@storybook/addon-docs/blocks';

export default () => React.createElement(React.Fragment, null,
  ...[Title, Primary, Description, Controls, Stories].map((block, key) => React.createElement(block, {key})));
