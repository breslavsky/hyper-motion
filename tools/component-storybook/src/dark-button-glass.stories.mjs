export default {
  title: 'Glass/References',
  globals: {aspect: 'square', brandbook: '__default__', material: 'dark-glass'},
  parameters: {layout: 'fullscreen', controls: {disable: true}},
};

export const DarkButtonGlass = {
  name: 'Dark Button Glass',
  args: {backdrop: 'black'},
  render({backdrop}) {
    const frame = document.createElement('iframe');
    frame.title = 'Dark Button Glass';
    const url = new URL('pk/dark-button-glass.html', document.baseURI);
    if (backdrop === 'stripes') url.searchParams.set('backdrop', 'stripes');
    frame.src = url.href;
    frame.style.cssText = 'display:block;width:100%;height:100vh;border:0;background:#000';
    return frame;
  },
};
