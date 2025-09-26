// src/main.js
import { initViewer } from './viewer/initViewer.js';
import { SidePanel } from './ui/SidePanel.js';
import { PoiManager } from './overlays/PoiManager.js';

const log = (...a) => { console.log(...a); const el = document.getElementById('log'); if (el) el.textContent = a.join(' '); };

const panel = new SidePanel();

const viewer = initViewer({
  tileSources: '../resources/ViaLactea/out_dzi.dzi',
  onOpen: () => {
    log('✅ DZI abierto');
    poiManager.init();
    viewer.viewport.goHome(true);
  },
  onZoom: () => poiManager.updateVisibility(),
  onAnimation: () => poiManager.updateVisibility(),
  onResize: () => poiManager.addOrUpdateOverlays()
});

let poiManager; 

const poisUrl = new URL('./config/pois.json', import.meta.url)

// 👇 Cargar JSON con fetch
fetch(poisUrl)
  .then(r => r.json())
  .then(pois => {
    poiManager = new PoiManager(viewer, pois, (poi) => {
      if (!poi) { panel.close(); return; }
      panel.open({ title: poi.title, html: `<p>${poi.desc || 'Sin descripción.'}</p>` });
    });
  })
  .catch(err => console.error('Error cargando pois.json', err));
