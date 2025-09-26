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

// 1) Arranca el visor
viewer = initViewer({
  tileSources: '../resources/ViaLactea/out_dzi.dzi',
  onOpen: () => {
    log('✅ DZI abierto');
    // Si ya tenemos datos, inicializamos; si no, init se ejecutará cuando lleguen
    poiManager?.init(); // internamente se auto-protegerá si aún no hay world item
    viewer.viewport.goHome(true);
  },
  onZoom: () => poiManager?.updateVisibility(),
  onAnimation: () => poiManager?.updateVisibility(),
  onResize: () => poiManager?.addOrUpdateOverlays()
});

// 2) Cargar datos (resuelto desde el propio módulo, no desde el HTML)
const poisUrl = new URL('./config/pois.json', import.meta.url);

const handlePoiClick = (poi) => {
    console.log(poi);
    if (!poi) { 
        panel.close(); 
        return; 
    }
    panel.open({ title: poi.title, html: `<p>${poi.desc || 'Sin descripción.'}</p>` });
};

fetch(poisUrl)
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} al cargar pois.json`);
    return r.json();
  })
  .then(pois => {
    poisData = pois;
    console.log('📦 POIs cargados:', poisData);
    // Crear manager con callback de click
    poiManager = new PoiManager(viewer, poisData, handlePoiClick);
    // Intento de init (si el visor ya abrió, pintará; si no, quedará listo)
    poiManager.init();
  })
  .catch(err => console.error('Error cargando pois.json:', err));
