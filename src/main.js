// src/main.js
import { initViewer } from './viewer/initViewer.js';
import { SidePanel } from './ui/SidePanel.js';
import { PoiManager } from './overlays/PoiManager.js';

const log = (...a) => {
  console.log(...a);
  const el = document.getElementById('log');
  if (el) el.textContent = a.join(' ');
};

const panel = new SidePanel();

let viewer;
let poiManager;
let poisData = null;

// 🔧 Configuración de límites geográficos según tu imagen
// Para Marte (ejemplo), ajusta según tu imagen específica
const bounds = {
  latMin: -90,   latMax: 90,     // Latitud: -90° (polo sur) a +90° (polo norte)
  lonMin: -180,  lonMax: 180,    // Longitud: -180° a +180° (estándar)
  lonRange: "[-180,180]"         // Formato de longitud
};

// 1) Arranca el visor
viewer = initViewer({
  tileSources: '../resources/out_dzi.dzi', 
  onOpen: () => {
    log('✅ DZI abierto');
    poiManager?.init();
    viewer.viewport.goHome(true);
  },
  onZoom: () => poiManager?.updateVisibility(),
  onAnimation: () => poiManager?.updateVisibility(),
  onResize: () => poiManager?.addOrUpdateOverlays()
});

// 2) Manejar click en POI
const handlePoiClick = (poi) => {
    console.log('POI clickeado:', poi);
    if (!poi) { 
        panel.close(); 
        return; 
    }
    
    const coordsText = `Lat: ${poi.lat}°, Lon: ${poi.lon}°`;
    const description = poi.desc || 'Sin descripción disponible.';
    
    panel.open({ 
        title: poi.title, 
        html: `
            <p><strong>Coordenadas:</strong> ${coordsText}</p>
            <p>${description}</p>
        ` 
    });
};

// 3) Cargar datos de POIs
const poisUrl = new URL('./config/pois.json', import.meta.url);

fetch(poisUrl)
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} al cargar pois.json`);
    return r.json();
  })
  .then(pois => {
    poisData = pois;
    console.log('📦 POIs cargados:', poisData);
    
    // Validar que todos los POIs tienen lat/lon
    const validPois = poisData.filter(poi => {
      if (typeof poi.lat !== 'number' || typeof poi.lon !== 'number') {
        console.warn(`POI ${poi.id} tiene coordenadas inválidas:`, poi);
        return false;
      }
      return true;
    });
    
    if (validPois.length !== poisData.length) {
      console.warn(`Se filtraron ${poisData.length - validPois.length} POIs con coordenadas inválidas`);
    }
    
    // Crear manager con POIs válidos
    poiManager = new PoiManager(viewer, validPois, handlePoiClick, bounds);
    poiManager.init();
    
    // Cargar POIs personalizados guardados
    poiManager.loadCustomPois();
  })
  .catch(err => console.error('Error cargando pois.json:', err));
