// src/main.js
import { initViewer } from './viewer/initViewer.js';
import { SidePanel } from './ui/SidePanel.js';
import { PoiManager } from './overlays/PoiManager.js';
import pois from './config/pois.json' assert { type: 'json' };

const log = (...a) => { console.log(...a); const el = document.getElementById('log'); if (el) el.textContent = a.join(' '); };

const panel = new SidePanel();

const viewer = initViewer({
  tileSources: 'resources/ViaLactea/out_dzi.dzi',
  onOpen: () => {
    log('✅ DZI abierto');
    poiManager.init();
    viewer.viewport.goHome(true);
  },
  onZoom: () => poiManager.updateVisibility(),
  onAnimation: () => poiManager.updateVisibility(),
  onResize: () => poiManager.addOrUpdateOverlays()
});

// Clic en pin → abre panel; clic en fondo → onClick(null) → cierra
const poiManager = new PoiManager(viewer, pois, (poi) => {
  if (!poi) { panel.close(); return; }
  panel.open({ title: poi.title, html: `<p>${poi.desc || 'Sin descripción.'}</p>` });
});
