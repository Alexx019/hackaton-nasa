// src/viewer/initViewer.js
export function initViewer({ tileSources, onOpen, onZoom, onAnimation, onResize }) {
  const viewer = OpenSeadragon({
    id: 'osd',
    prefixUrl: 'https://openseadragon.github.io/openseadragon/images/',
    tileSources,
    showNavigator: true,
    navigatorAutoFade: false,
    animationTime: 0.2,
    blendTime: 0.1,
    maxZoomPixelRatio: 2,
    gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true, dragToPan: true, scrollToZoom: true },
    gestureSettingsTouch: { clickToZoom: false, dblClickToZoom: true, pinchToZoom: true, flickEnabled: true }
  });

  if (onOpen)      viewer.addHandler('open', onOpen);
  if (onZoom)      viewer.addHandler('zoom', onZoom);
  if (onAnimation) viewer.addHandler('animation', onAnimation);
  if (onResize)    viewer.addHandler('resize', onResize);

  viewer.addHandler('open-failed', e => console.error('open-failed', e));
  viewer.addHandler('add-item-failed', e => console.error('add-item-failed', e));
  viewer.addHandler('tile-load-failed', e => console.warn('tile-load-failed', e?.message || e));

  return viewer;
}
