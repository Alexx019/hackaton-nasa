// src/utils/coords.js

// Zoom de imagen (independiente del viewport)
export const getImageZoom = (viewer) =>
  viewer.viewport.viewportToImageZoom(viewer.viewport.getZoom());

// Normalizado (0..1) -> px de la imagen
export const imgPointFromNormalized = (norm, imgSize) =>
  new OpenSeadragon.Point(norm.x * imgSize.x, norm.y * imgSize.y);

// px de la imagen -> coords de viewport
export const vpPointFromImg = (viewer, imgPt) =>
  viewer.viewport.imageToViewportCoordinates(imgPt);

/**
 * Convierte lat/lon (grados decimales) a coordenadas normalizadas (x,y) en [0,1]
 * para mapas equirectangulares.
 *
 * @param {number} lat - Latitud en grados decimales (-90 a 90)
 * @param {number} lon - Longitud en grados decimales
 * @param {Object} bounds - Límites del mapa
 * @param {number} bounds.latMin - Latitud mínima (típicamente -90)
 * @param {number} bounds.latMax - Latitud máxima (típicamente 90)
 * @param {number} bounds.lonMin - Longitud mínima (típicamente -180)
 * @param {number} bounds.lonMax - Longitud máxima (típicamente 180)
 * @param {string} [bounds.lonRange] - Rango de longitud: "[-180,180]" o "[0,360]"
 * @returns {{x: number, y: number}} Coordenadas normalizadas (0-1)
 * 
 * Nota: y=0 es arriba (latMax), y=1 es abajo (latMin) - típico en imágenes
 */
export function normalizedFromLatLon(lat, lon, bounds) {
  const {
    latMin = -90, latMax = 90,
    lonMin = -180, lonMax = 180,
    lonRange = "[-180,180]"
  } = bounds || {};

  // Validar entrada
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    console.error('normalizedFromLatLon: lat/lon deben ser números', { lat, lon });
    return { x: 0, y: 0 };
  }

  // Normalizar longitud si viene en formato 0-360 pero el mapa usa -180/180
  let LON = lon;
  if (lonRange === "[0,360]" && lonMin <= -180 && lonMax >= 180) {
    // Convertir 0-360 → -180/180
    LON = ((lon + 180) % 360) - 180;
  } else if (lonRange === "[-180,180]" && lonMin >= 0 && lonMax >= 180) {
    // Convertir -180/180 → 0-360 si el mapa lo requiere
    LON = lon < 0 ? lon + 360 : lon;
  }

  // Calcular coordenadas normalizadas
  // x: izquierda=lonMin → 0, derecha=lonMax → 1
  const x = (LON - lonMin) / (lonMax - lonMin);

  // y: arriba=latMax → 0, abajo=latMin → 1 (flip vertical típico de imágenes)
  const y = 1 - (lat - latMin) / (latMax - latMin);

  // Debug para coordenadas sospechosas
  if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) {
    console.warn(`Coordenadas posiblemente fuera de rango: lat=${lat}° lon=${lon}° → norm(${x.toFixed(3)}, ${y.toFixed(3)})`);
  }

  return { x, y };
}

/**
 * Convierte coordenadas normalizadas de vuelta a lat/lon
 * @param {number} x - Coordenada X normalizada (0-1)
 * @param {number} y - Coordenada Y normalizada (0-1)
 * @param {Object} bounds - Límites del mapa (mismo formato que normalizedFromLatLon)
 * @returns {{lat: number, lon: number}} Coordenadas geográficas
 */
export function latLonFromNormalized(x, y, bounds) {
  const {
    latMin = -90, latMax = 90,
    lonMin = -180, lonMax = 180
  } = bounds || {};

  // Convertir de vuelta
  const lon = lonMin + x * (lonMax - lonMin);
  const lat = latMax - y * (latMax - latMin); // flip Y

  return { lat, lon };
}

/**
 * Calcula la distancia entre dos puntos lat/lon usando la fórmula de Haversine
 * @param {number} lat1 - Latitud del primer punto
 * @param {number} lon1 - Longitud del primer punto  
 * @param {number} lat2 - Latitud del segundo punto
 * @param {number} lon2 - Longitud del segundo punto
 * @returns {number} Distancia en kilómetros
 */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calcula información del tile DZI para un punto específico de la imagen
 * @param {OpenSeadragon.Point} imagePoint - Punto en coordenadas de imagen
 * @param {OpenSeadragon.Point} imageSize - Tamaño total de la imagen
 * @param {number} currentZoom - Zoom actual de la imagen
 * @returns {Object} Información del tile
 */
export function getTileInfoFromImagePoint(imagePoint, imageSize, currentZoom) {
  // Calcular el nivel de tile apropiado basado en el zoom
  // En DZI, el nivel 0 es la imagen más pequeña (1x1 o similar)
  // Cada nivel duplica las dimensiones
  
  const maxLevel = Math.ceil(Math.log2(Math.max(imageSize.x, imageSize.y))) - 8; // -8 para tile size 256
  const level = Math.min(maxLevel, Math.max(0, Math.floor(Math.log2(currentZoom)) + maxLevel - 2));
  
  // Tamaño del tile (típicamente 256px)
  const tileSize = 256;
  
  // Calcular las dimensiones del nivel actual
  const levelScale = Math.pow(2, level - maxLevel);
  const levelWidth = Math.ceil(imageSize.x * levelScale);
  const levelHeight = Math.ceil(imageSize.y * levelScale);
  
  // Escalar el punto de imagen al nivel actual
  const scaledX = imagePoint.x * levelScale;
  const scaledY = imagePoint.y * levelScale;
  
  // Calcular columna y fila del tile
  const col = Math.floor(scaledX / tileSize);
  const row = Math.floor(scaledY / tileSize);
  
  // Calcular cuántos tiles hay en este nivel
  const tilesWide = Math.ceil(levelWidth / tileSize);
  const tilesHigh = Math.ceil(levelHeight / tileSize);
  
  // Posición dentro del tile (0-255)
  const tileX = Math.floor(scaledX % tileSize);
  const tileY = Math.floor(scaledY % tileSize);
  
  return {
    level: level,
    col: col,
    row: row,
    tileX: tileX,
    tileY: tileY,
    tilePath: `${level}/${col}_${row}.jpg`,
    tilesWide: tilesWide,
    tilesHigh: tilesHigh,
    levelWidth: levelWidth,
    levelHeight: levelHeight,
    imagePoint: {
      x: imagePoint.x,
      y: imagePoint.y
    }
  };
}

/**
 * Genera la URL completa del tile para una estructura DZI
 * @param {string} dziBasePath - Ruta base del DZI (sin extensión)
 * @param {Object} tileInfo - Información del tile obtenida de getTileInfoFromImagePoint
 * @returns {string} URL completa del tile
 */
export function getTileUrl(dziBasePath, tileInfo) {
  return `${dziBasePath}_files/${tileInfo.level}/${tileInfo.col}_${tileInfo.row}.jpg`;
}

/**
 * Valida si un tile existe (útil para verificar antes de mostrar)
 * @param {string} tileUrl - URL del tile
 * @returns {Promise<boolean>} Promesa que resuelve true si el tile existe
 */
export async function validateTileExists(tileUrl) {
  try {
    const response = await fetch(tileUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn(`[Tile Validation] Error verificando tile: ${tileUrl}`, error);
    return false;
  }
}
