// src/overlays/PoiManager.js
import { getImageZoom, imgPointFromNormalized, vpPointFromImg } from '../utils/coords.js';

const DEBUG = true;              // logs activos
const DEFAULT_MIN_ZOOM = 0.05;   // umbral por defecto
const EPS = 0;                   // sin histéresis; sube si notas parpadeo

export class PoiManager {
  /**
   * @param {OpenSeadragon.Viewer} viewer
   * @param {Array<{id:string,x:number,y:number,title:string,desc?:string,minZoom?:number, classes?:string[]}>} pois
   * @param {(poi|null)=>void} onClick
   */
  constructor(viewer, pois, onClick) {
    this.viewer = viewer;
    this.pois = pois;
    this.onClick = onClick;

    this.overlayEls = new Map();    // id -> HTMLElement
    this.overlayTrackers = new Map(); // id -> MouseTracker
    this.poiVisible = new Map();    // id -> bool
    this.imgSize = null;

    // Cerrar panel al clicar el lienzo, salvo si el click viene de un .poi
    this.viewer.addHandler('canvas-click', (e) => {
      const t = e?.originalEvent?.target;
      if (t && typeof t.closest === 'function' && t.closest('.poi')) {
        if (DEBUG) console.log('[canvas-click] ignorado (click sobre .poi)');
        e.preventDefaultAction = true; // por si acaso
        return;
      }
      if (DEBUG) console.log('[canvas-click] cerrar panel');
      if (typeof this.onClick === 'function') this.onClick(null);
    });
  }

  /** Llamar cuando el visor abre o cuando ya tengas POIs; es idempotente. */
  init() {
    const item = this.viewer.world.getItemAt(0);
    if (!item) {
      if (DEBUG) console.warn('[POI] init(): aún no hay item; me suscribo a open…');
      this.viewer.addOnceHandler('open', () => this.init());
      return;
    }

    this.imgSize = item.getContentSize();
    if (DEBUG) console.log('[POI] imgSize =', this.imgSize);

    this.addOrUpdateOverlays();
    this.updateVisibility();
    if (DEBUG) console.log('[POI] init() completo; overlays añadidos:', this.overlayEls.size);
  }

  createPoiElement(poi) {
    const el = document.createElement('div');
    el.className = 'poi' + (poi.classes?.length ? ' ' + poi.classes.join(' ') : '');
    el.id = `${poi.id}`;
    el.style.display = 'none';
    el.style.pointerEvents = 'none'; // lo activamos cuando es visible

    const dot = document.createElement('div');
    dot.className = 'poi-btn';
    dot.title = poi.title;

    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.textContent = poi.title;

    el.appendChild(dot);
    el.appendChild(tip);

    // MouseTracker PROPIO del overlay: bloquea el flujo hacia el viewer
    const tracker = new OpenSeadragon.MouseTracker({
      element: el,
      pressHandler: (ev) => { ev.preventDefaultAction = true; },
      releaseHandler: (ev) => { ev.preventDefaultAction = true; },
      clickHandler: (ev) => {
        ev.preventDefaultAction = true;              // <- clave: evita canvas-click
        if (DEBUG) console.log('[POI click]', poi.id, poi.title);
        if (typeof this.onClick === 'function') this.onClick(poi);
      },
      // Por si quieres soporte táctil fino:
      enterHandler: (ev) => { ev.preventDefaultAction = true; },
      exitHandler:  (ev) => { ev.preventDefaultAction = true; }
    });
    tracker.setTracking(true);
    this.overlayTrackers.set(poi.id, tracker);

    return el;
  }

  addOrUpdateOverlays() {
    if (!this.imgSize) return;

    for (const poi of this.pois) {
      let el = this.overlayEls.get(poi.id);
      if (!el) {
        el = this.createPoiElement(poi);
        this.overlayEls.set(poi.id, el);
      }

      // normalizado (0..1) -> px imagen -> viewport
      const imgPt = imgPointFromNormalized({ x: poi.x, y: poi.y }, this.imgSize);
      const vpPt  = vpPointFromImg(this.viewer, imgPt);

      if (this.viewer.getOverlayById(el)) {
        this.viewer.updateOverlay(el, vpPt, OpenSeadragon.Placement.CENTER);
      } else {
        this.viewer.addOverlay({ element: el, location: vpPt, placement: OpenSeadragon.Placement.CENTER });
      }

      if (DEBUG) {
        console.log(
          `[POI] overlay ${poi.id} @ img(${imgPt.x.toFixed(1)},${imgPt.y.toFixed(1)}) → vp(${vpPt.x.toFixed(4)},${vpPt.y.toFixed(4)})`
        );
      }
    }

    this.updateVisibility();
  }

  updateVisibility() {
    const imgZoom = getImageZoom(this.viewer);
    if (DEBUG) console.log(`[ZOOM] imgZoom = ${imgZoom.toFixed(3)}`);

    for (const poi of this.pois) {
      const el = this.overlayEls.get(poi.id);
      if (!el) continue;

      const minZ = poi.minZoom ?? DEFAULT_MIN_ZOOM;
      const wasVisible = this.poiVisible.get(poi.id) ?? false;

      // Con EPS=0 el corte es exacto:
      const shouldBeVisible = wasVisible
        ? (imgZoom >= minZ - EPS)
        : (imgZoom >= minZ + EPS);

      this.poiVisible.set(poi.id, shouldBeVisible);

      if (shouldBeVisible) {
        el.style.display = 'block';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';   // <- importante para que el overlay reciba eventos
      } else {
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      }

      if (DEBUG) {
        const appearAt = (minZ + EPS).toFixed(4);
        const hideAt   = (minZ - EPS).toFixed(4);
        console.log(`[POI ${poi.id}] minZ=${minZ} | appear>=${appearAt} | hide<${hideAt} | visible=${shouldBeVisible}`);
      }
    }
  }
}
