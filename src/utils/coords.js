// src/utils/coords.js
export const getImageZoom = (viewer) =>
  viewer.viewport.viewportToImageZoom(viewer.viewport.getZoom());

export const imgPointFromNormalized = (norm, imgSize) =>
  new OpenSeadragon.Point(norm.x * imgSize.x, norm.y * imgSize.y);

export const vpPointFromImg = (viewer, imgPt) =>
  viewer.viewport.imageToViewportCoordinates(imgPt);
