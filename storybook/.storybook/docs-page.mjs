// A scene's docs page: its name as words, the player next, so it is seen on
// entering the page; what the scene is for and its fields follow it.
import React from 'react';
import {Title, Primary, Description, Controls, Stories, useOf} from '@storybook/addon-docs/blocks';
import {isSceneName, words} from '../src/names.mjs';

const Name = () => {
  const name = useOf('meta').preparedMeta.title.split('/').at(-1);
  return React.createElement(Title, null, isSceneName(name) ? words(name) : name);
};
export default () => React.createElement(React.Fragment, null,
  ...[Name, Primary, Description, Controls, Stories].map((block, key) => React.createElement(block, {key})));
