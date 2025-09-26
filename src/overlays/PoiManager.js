// src/overlays/PoiManager.js
import { getImageZoom, imgPointFromNormalized, vpPointFromImg } from '../utils/coords.js';

export class PoiManager {
  /**
   * @param {OpenSeadragon.Viewer} viewer
   * @param {Array<{id:string,x:number,y:number,title:string,desc?:string,minZoom?:number}>} pois
   * @param {(poi)=>void} onClick
   */
  constructor(viewer, pois, onClick) {
    this.viewer = viewer;
    this.pois = pois;
    this.onClick = onClick;
    this.overlayEls = new Map();
    this.poiVisible = new Map();
    this.imgSize = null;
    this.EPS = 0.05; // histéresis

    // cerrar panel al clicar fuera
    this.viewer.addHandler('canvas-click', () => this.onClick?.(null));
  }

  init() {
    const item = this.viewer.world.getItemAt(0);
    this.imgSize = item.getContentSize(); // {x,y}
    this.addOrUpdateOverlays();
  }

  createPoiElement(poi) {
    const el = document.createElement('div');
    el.className = 'poi';
    el.id = `poi-${poi.id}`;
    el.style.display = 'none';
    el.style.pointerEvents = 'none';

    const dot = document.createElement('div');
    dot.className = 'poi-btn';
    dot.title = poi.title;

    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.textContent = poi.title;

    el.appendChild(dot);
    el.appendChild(tip);

    const stopAll = (e) => {
      OpenSeadragon.cancelEvent(e);
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('mousedown', stopAll);
    el.addEventListener('touchstart', stopAll, { passive: false });
    el.addEventListener('click', (e) => { stopAll(e); this.onClick?.(poi); });

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
      const imgPt = imgPointFromNormalized({ x: poi.x, y: poi.y }, this.imgSize);
      const vpPt = vpPointFromImg(this.viewer, imgPt);

      if (this.viewer.getOverlayById(el)) {
        this.viewer.updateOverlay(el, vpPt, OpenSeadragon.Placement.CENTER);
      } else {
        this.viewer.addOverlay({ element: el, location: vpPt, placement: OpenSeadragon.Placement.CENTER });
      }
    }
    this.updateVisibility();
  }

  updateVisibility() {
    const imgZoom = getImageZoom(this.viewer);
    for (const poi of this.pois) {
      const el = this.overlayEls.get(poi.id);
      if (!el) continue;

      const minZ = poi.minZoom ?? 1.5;
      const wasVisible = this.poiVisible.get(poi.id) ?? false;
      const shouldBeVisible = wasVisible
        ? (imgZoom >= minZ - this.EPS)
        : (imgZoom >= minZ + this.EPS);

      this.poiVisible.set(poi.id, shouldBeVisible);
      if (shouldBeVisible) {
        el.style.display = 'block';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      } else {
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      }
    }
  }
}
