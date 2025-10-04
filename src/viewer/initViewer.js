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

  // Agregar métodos útiles al viewer
  viewer.imageToLatLon = function(imagePoint, bounds) {
    const imgSize = this.world.getItemAt(0).getContentSize();
    const normalizedX = imagePoint.x / imgSize.x;
    const normalizedY = imagePoint.y / imgSize.y;
    
    const { latMin = -90, latMax = 90, lonMin = -180, lonMax = 180 } = bounds || {};
    
    const lon = lonMin + normalizedX * (lonMax - lonMin);
    const lat = latMax - normalizedY * (latMax - latMin); // flip Y
    
    return { lat, lon };
  };

  viewer.getTileInfo = function(imagePoint) {
    const source = this.tileSources;
    if (!source || !source.getTileAtPoint) {
      // Fallback: calcular tile manualmente
      return this.calculateTileInfo(imagePoint);
    }
    
    try {
      return source.getTileAtPoint(imagePoint);
    } catch (e) {
      return this.calculateTileInfo(imagePoint);
    }
  };

  viewer.calculateTileInfo = function(imagePoint) {
    const currentZoom = this.viewport.getZoom();
    const item = this.world.getItemAt(0);
    const imgSize = item.getContentSize();
    
    // Estimar nivel de tile basado en zoom
    const maxLevel = 17; // Ajustar según tu DZI
    const level = Math.min(Math.floor(Math.log2(currentZoom * Math.max(imgSize.x, imgSize.y) / 256)), maxLevel);
    
    // Calcular coordenadas de tile
    const tileSize = 256; // Tamaño estándar de tile DZI
    const scale = Math.pow(2, level);
    const scaledImgWidth = imgSize.x / Math.pow(2, maxLevel - level);
    const scaledImgHeight = imgSize.y / Math.pow(2, maxLevel - level);
    
    const tileX = Math.floor((imagePoint.x / imgSize.x) * scaledImgWidth / tileSize);
    const tileY = Math.floor((imagePoint.y / imgSize.y) * scaledImgHeight / tileSize);
    
    return {
      level: level,
      x: tileX,
      y: tileY,
      url: `out_dzi_files/${level}/${tileX}_${tileY}.jpg`
    };
  };

  return viewer;
}
