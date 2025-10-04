// src/overlays/PoiManager.js
import {
  getImageZoom,
  imgPointFromNormalized,
  vpPointFromImg,
  normalizedFromLatLon,
  latLonFromNormalized,
  getTileInfoFromImagePoint
} from '../utils/coords.js';

const DEBUG = true;
const DEFAULT_MIN_ZOOM = 0.05;
const EPS = 0.01; // Pequeña histéresis para evitar parpadeos

export class PoiManager {
  constructor(viewer, pois, onClick, bounds) {
    this.viewer = viewer;
    this.pois = pois;
    this.onClick = onClick;
    this.bounds = bounds || { latMin:-90, latMax:90, lonMin:-180, lonMax:180, lonRange:"[-180,180]" };

    this.overlayEls = new Map();
    this.overlayTrackers = new Map();
    this.poiVisible = new Map();
    this.imgSize = null;

    if (DEBUG) {
      console.log(`[POI] Inicializando con ${pois.length} POIs y bounds:`, this.bounds);
    }

    // Cerrar panel al clicar el lienzo, salvo si el target está dentro de un .poi
    this.viewer.addHandler('canvas-click', (e) => {
      const t = e?.originalEvent?.target;
      if (t && typeof t.closest === 'function' && t.closest('.poi')) {
        if (DEBUG) console.log('[canvas-click] ignorado (click sobre .poi)');
        e.preventDefaultAction = true;
        return;
      }
      if (typeof this.onClick === 'function') this.onClick(null);
    });

    // Configurar click derecho para crear POI
    this.setupPoiCreation();
  }

  setupPoiCreation() {
    // Interceptar click derecho en el canvas
    this.viewer.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Evitar menú contextual del navegador
      
      const viewportPoint = this.viewer.viewport.pointFromPixel(
        new OpenSeadragon.Point(
          e.offsetX || e.layerX,
          e.offsetY || e.layerY
        )
      );
      
      const imagePoint = this.viewer.viewport.viewportToImageCoordinates(viewportPoint);
      
      if (DEBUG) {
        console.log('[POI Creation] Click derecho en:', {
          viewport: viewportPoint,
          image: imagePoint
        });
      }
      
      this.createPoiAtImagePoint(imagePoint);
    });
  }

  createPoiAtImagePoint(imagePoint) {
    if (!this.imgSize) {
      console.warn('[POI Creation] No hay imagen cargada');
      return;
    }

    // Validar que el punto está dentro de la imagen
    if (imagePoint.x < 0 || imagePoint.x >= this.imgSize.x || 
        imagePoint.y < 0 || imagePoint.y >= this.imgSize.y) {
      console.warn('[POI Creation] Punto fuera de la imagen');
      return;
    }

    // Convertir a coordenadas normalizadas
    const normalized = {
      x: imagePoint.x / this.imgSize.x,
      y: imagePoint.y / this.imgSize.y
    };

    // Convertir a lat/lon
    const latLon = latLonFromNormalized(normalized.x, normalized.y, this.bounds);

    // Obtener información del tile
    const currentZoom = getImageZoom(this.viewer);
    const tileInfo = getTileInfoFromImagePoint(imagePoint, this.imgSize, currentZoom);

    // Crear datos del nuevo POI
    const newPoi = {
      id: `poi_${Date.now()}`, // ID único basado en timestamp
      lat: Math.round(latLon.lat * 10000) / 10000, // 4 decimales
      lon: Math.round(latLon.lon * 10000) / 10000,
      title: `POI ${latLon.lat.toFixed(2)}°, ${latLon.lon.toFixed(2)}°`,
      desc: `Creado en tile ${tileInfo.level}/${tileInfo.col}_${tileInfo.row}.jpg`,
      minZoom: 0.0, // Visible desde un zoom un poco menor al actual
      tileInfo: tileInfo
    };

    if (DEBUG) {
      console.log('[POI Creation] Nuevo POI:', newPoi);
      console.log('[POI Creation] Tile info:', tileInfo);
    }

    // Mostrar modal de confirmación/edición
    this.showPoiCreationModal(newPoi);
  }

  showPoiCreationModal(poiData) {
    // Crear modal simple para editar el POI antes de guardarlo
    const modal = document.createElement('div');
    modal.className = 'poi-creation-modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h3>Crear nuevo POI</h3>
        <div class="form-group">
          <label for="poi-title">Título:</label>
          <input type="text" id="poi-title" value="${poiData.title}" />
        </div>
        <div class="form-group">
          <label for="poi-desc">Descripción:</label>
          <textarea id="poi-desc" rows="3">${poiData.desc}</textarea>
        </div>
        <div class="form-group">
          <label>Coordenadas:</label>
          <div class="coords-display">
            Lat: ${poiData.lat}°, Lon: ${poiData.lon}°
          </div>
        </div>
        <div class="form-group">
          <label>Tile:</label>
          <div class="tile-display">
            Nivel ${poiData.tileInfo.level}: ${poiData.tileInfo.col}_${poiData.tileInfo.row}.jpg
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel">Cancelar</button>
          <button type="button" class="btn-save">Guardar POI</button>
        </div>
      </div>
    `;

    // Estilos del modal
    const style = document.createElement('style');
    style.textContent = `
      .poi-creation-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
      }
      .modal-content {
        position: relative;
        background: #2a2a2a;
        color: #eee;
        padding: 20px;
        border-radius: 8px;
        min-width: 400px;
        max-width: 500px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      }
      .form-group {
        margin-bottom: 15px;
      }
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 600;
      }
      .form-group input, .form-group textarea {
        width: 100%;
        padding: 8px;
        background: #1a1a1a;
        border: 1px solid #444;
        color: #eee;
        border-radius: 4px;
      }
      .coords-display, .tile-display {
        padding: 8px;
        background: #1a1a1a;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
      }
      .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
      }
      .modal-actions button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
      }
      .btn-cancel {
        background: #666;
        color: #eee;
      }
      .btn-save {
        background: #00d8ff;
        color: #000;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);

    // Event listeners del modal
    const titleInput = modal.querySelector('#poi-title');
    const descInput = modal.querySelector('#poi-desc');
    const cancelBtn = modal.querySelector('.btn-cancel');
    const saveBtn = modal.querySelector('.btn-save');
    const backdrop = modal.querySelector('.modal-backdrop');

    const closeModal = () => {
      document.body.removeChild(modal);
      document.head.removeChild(style);
    };

    cancelBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', () => {
      const finalPoi = {
        ...poiData,
        title: titleInput.value.trim() || poiData.title,
        desc: descInput.value.trim() || poiData.desc
      };

      this.addPoi(finalPoi);
      this.savePoiToConfig(finalPoi); // Guardar en configuración
      closeModal();

      if (DEBUG) {
        console.log('[POI Creation] POI guardado:', finalPoi);
      }
    });

    // Focus en el input del título
    titleInput.focus();
    titleInput.select();
  }

  savePoiToConfig(poi) {
    // En un entorno real, aquí harías una petición al backend
    // Por ahora, guardamos en localStorage como ejemplo
    
    try {
      const existingPois = JSON.parse(localStorage.getItem('custom_pois') || '[]');
      existingPois.push({
        id: poi.id,
        lat: poi.lat,
        lon: poi.lon,
        title: poi.title,
        desc: poi.desc,
        minZoom: 0.0,
        tileInfo: poi.tileInfo,
        createdAt: new Date().toISOString()
      });
      
      localStorage.setItem('custom_pois', JSON.stringify(existingPois));
      
      console.log('[POI Creation] POI guardado en localStorage');
      
      // Opcional: mostrar notificación de éxito
      this.showNotification(`POI "${poi.title}" creado exitosamente`, 'success');
      
    } catch (error) {
      console.error('[POI Creation] Error guardando POI:', error);
      this.showNotification('Error guardando el POI', 'error');
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `poi-notification ${type}`;
    notification.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
      .poi-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        z-index: 9999;
        animation: slideInRight 0.3s ease;
      }
      .poi-notification.success { background: #00d8ff; color: #000; }
      .poi-notification.error { background: #ff4757; }
      .poi-notification.info { background: #5352ed; }
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => {
        document.body.removeChild(notification);
        document.head.removeChild(style);
      }, 300);
    }, 3000);
  }

  // Método para cargar POIs guardados
  loadCustomPois() {
    try {
      const customPois = JSON.parse(localStorage.getItem('custom_pois') || '[]');
      customPois.forEach(poi => {
        this.addPoi(poi);
      });
      if (customPois.length > 0) {
        console.log(`[POI] Cargados ${customPois.length} POIs personalizados`);
      }
    } catch (error) {
      console.error('[POI] Error cargando POIs personalizados:', error);
    }
  }

  init() {
    const item = this.viewer.world.getItemAt(0);
    if (!item) {
      if (DEBUG) console.warn('[POI] init(): aún no hay item; suscribo a open…');
      this.viewer.addOnceHandler('open', () => this.init());
      return;
    }
    this.imgSize = item.getContentSize();
    if (DEBUG) console.log('[POI] imgSize =', this.imgSize);
    this.addOrUpdateOverlays();
    this.updateVisibility();
    if (DEBUG) console.log('[POI] init() completo; overlays:', this.overlayEls.size);
  }

  createPoiElement(poi) {
    const el = document.createElement('div');
    el.className = 'poi' + (poi.classes?.length ? ' ' + poi.classes.join(' ') : '');
    el.id = `poi-${poi.id}`;
    el.style.display = 'none';
    el.style.pointerEvents = 'none';

    const dot = document.createElement('div');
    dot.className = 'poi-btn';
    dot.title = `${poi.title} (${poi.lat}°, ${poi.lon}°)`;

    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.textContent = poi.title;

    el.appendChild(dot);
    el.appendChild(tip);

    // MouseTracker por overlay para detener propagación hacia el viewer
    const tracker = new OpenSeadragon.MouseTracker({
      element: el,
      pressHandler:   (ev) => { ev.preventDefaultAction = true; },
      releaseHandler: (ev) => { ev.preventDefaultAction = true; },
      clickHandler:   (ev) => {
        ev.preventDefaultAction = true;
        if (DEBUG) console.log(`[POI click] ${poi.id}: "${poi.title}" en (${poi.lat}°, ${poi.lon}°)`);
        if (typeof this.onClick === 'function') this.onClick(poi);
      },
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

      // 🗺️ Conversión: lat/lon → normalized → px imagen → viewport
      const norm = normalizedFromLatLon(poi.lat, poi.lon, this.bounds);
      
      // Validar que las coordenadas normalizadas están en rango válido
      if (norm.x < 0 || norm.x > 1 || norm.y < 0 || norm.y > 1) {
        console.warn(`[POI] ${poi.id} fuera de bounds. Lat:${poi.lat} Lon:${poi.lon} → norm(${norm.x.toFixed(4)}, ${norm.y.toFixed(4)})`);
        continue;
      }
      
      const imgPt = imgPointFromNormalized(norm, this.imgSize);
      const vpPt  = vpPointFromImg(this.viewer, imgPt);

      if (this.viewer.getOverlayById(el)) {
        this.viewer.updateOverlay(el, vpPt, OpenSeadragon.Placement.CENTER);
      } else {
        this.viewer.addOverlay({ element: el, location: vpPt, placement: OpenSeadragon.Placement.CENTER });
      }

      if (DEBUG) {
        console.log(
          `[POI] ${poi.id} "${poi.title}" lat:${poi.lat}° lon:${poi.lon}° → norm(${norm.x.toFixed(4)}, ${norm.y.toFixed(4)}) → img(${imgPt.x.toFixed(0)}, ${imgPt.y.toFixed(0)})`
        );
      }
    }
    this.updateVisibility();
  }

  updateVisibility() {
    const imgZoom = getImageZoom(this.viewer);
    if (DEBUG && this.overlayEls.size > 0) {
      console.log(`[ZOOM] imgZoom = ${imgZoom.toFixed(3)}`);
    }

    for (const poi of this.pois) {
      const el = this.overlayEls.get(poi.id);
      if (!el) continue;

      const minZ = poi.minZoom ?? DEFAULT_MIN_ZOOM;
      const wasVisible = this.poiVisible.get(poi.id) ?? false;
      const shouldBeVisible = wasVisible
        ? (imgZoom >= minZ - EPS)
        : (imgZoom >= minZ + EPS);

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

  // Método para agregar POI dinámicamente
  addPoi(poi) {
    if (typeof poi.lat !== 'number' || typeof poi.lon !== 'number') {
      console.error('[POI] addPoi(): coordenadas inválidas', poi);
      return false;
    }
    
    this.pois.push(poi);
    this.addOrUpdateOverlays();
    if (DEBUG) console.log(`[POI] Agregado POI dinámico: ${poi.id}`);
    return true;
  }

  // Método para remover POI
  removePoi(poiId) {
    const el = this.overlayEls.get(poiId);
    if (el) {
      this.viewer.removeOverlay(el);
      this.overlayEls.delete(poiId);
    }
    
    const tracker = this.overlayTrackers.get(poiId);
    if (tracker) {
      tracker.destroy();
      this.overlayTrackers.delete(poiId);
    }
    
    this.pois = this.pois.filter(p => p.id !== poiId);
    this.poiVisible.delete(poiId);
    
    if (DEBUG) console.log(`[POI] Removido POI: ${poiId}`);
  }
}
