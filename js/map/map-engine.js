/**
 * 県境のシンプルな白地図。道路・淡色タイルは使わない。
 * 親要素の CSS transform で地図を拡大しない。
 */

const PREF_GEOJSON = new URL("../../data/japan-prefectures.geojson", import.meta.url).href;
const SEA = "#6e9bb8";

let leafletPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-leaflet]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.dataset.leaflet = "1";
      css.href = new URL("../../vendor/leaflet/leaflet.css", import.meta.url).href;
      document.head.appendChild(css);
    }
    const script = document.createElement("script");
    script.src = new URL("../../vendor/leaflet/leaflet.js", import.meta.url).href;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet を読み込めませんでした"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

let prefGeoPromise = null;

function loadPrefGeo() {
  if (!prefGeoPromise) {
    prefGeoPromise = fetch(PREF_GEOJSON)
      .then((res) => {
        if (!res.ok) throw new Error("県境データを読み込めませんでした");
        return res.json();
      })
      .catch((err) => {
        prefGeoPromise = null;
        throw err;
      });
  }
  return prefGeoPromise;
}

function featurePrefId(feature) {
  return String(feature?.properties?.id || "").padStart(2, "0");
}

function fillStyle(feature, currentId) {
  const focus = featurePrefId(feature) === currentId;
  return {
    stroke: false,
    fillColor: focus ? "#eceeef" : "#c4c8cd",
    fillOpacity: focus ? 0.92 : 0.62
  };
}

function strokeStyle(feature, currentId) {
  const focus = featurePrefId(feature) === currentId;
  return {
    fill: false,
    color: focus ? "#3d424a" : "#7a8088",
    weight: focus ? 3.4 : 1.5,
    opacity: 1,
    lineJoin: "round",
    lineCap: "round"
  };
}

function waitSize(el) {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      n += 1;
      if ((el.clientWidth >= 80 && el.clientHeight >= 80) || n > 40) {
        resolve();
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

function isRemotePoint(pref, point) {
  if (!point) return false;
  const dLat = Math.abs(point.latitude - pref.centerLatitude);
  const dLng = Math.abs(point.longitude - pref.centerLongitude);
  return dLat > 1.4 || dLng > 1.6;
}

function prefMaxZoom(pref) {
  return Math.min(11.4, (Number(pref?.defaultZoom) || 8.5) + 1.6 + (Number(pref?.zoomBoost) || 0));
}

function zoomForPoint(pref, point) {
  if (isRemotePoint(pref, point)) return Math.min(prefMaxZoom(pref), Math.max(7, pref.defaultZoom || 8));
  return pref.defaultZoom;
}

export function mapCenter(pref, point) {
  if (isRemotePoint(pref, point)) return [point.latitude, point.longitude];
  return [pref.centerLatitude, pref.centerLongitude];
}

function clampZoom(zoom, pref) {
  return Math.min(prefMaxZoom(pref), Math.max(5.5, Number(zoom) || 7.5));
}

function prefLatLngBounds(L, pref) {
  const b = pref?.bounds;
  if (!b) return null;
  return L.latLngBounds([b.south, b.west], [b.north, b.east]);
}

function applyPrefView(map, L, pref, point, mapMode) {
  if (pref?.national || pref?.slug === "japan") {
    const bounds = prefLatLngBounds(L, pref);
    if (bounds) {
      map.fitBounds(bounds, { padding: [12, 12], maxZoom: 6.3, animate: false });
      return;
    }
    map.setView([pref.centerLatitude, pref.centerLongitude], pref.defaultZoom || 5.25, { animate: false });
    return;
  }
  if (mapMode === "station" && point) {
    map.setView([point.latitude, point.longitude], Math.min(prefMaxZoom(pref), Math.max(9.2, (pref.defaultZoom || 8) + 1.2)), { animate: false });
    return;
  }
  if (isRemotePoint(pref, point)) {
    map.setView([point.latitude, point.longitude], clampZoom(zoomForPoint(pref, point), pref), { animate: false });
    return;
  }
  const bounds = prefLatLngBounds(L, pref);
  if (bounds) {
    map.fitBounds(bounds, {
      paddingTopLeft: [22, 96],
      paddingBottomRight: [22, 28],
      maxZoom: prefMaxZoom(pref),
      animate: false
    });
    return;
  }
  map.setView(mapCenter(pref, point), clampZoom(pref.defaultZoom, pref), { animate: false });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function createMap(container, { prefecture, point, interactive = false, mapMode = "prefecture" }) {
  const L = await loadLeaflet();
  const prefGeo = await loadPrefGeo().catch(() => null);
  await waitSize(container);
  if (container._amedasMap) {
    container._amedasMap.setView(prefecture, point, mapMode);
    return container._amedasMap;
  }
  if (container._leaflet_id) {
    try {
      container._leaflet?.remove?.();
    } catch {
      /* ignore */
    }
    container._leaflet_id = null;
    container.innerHTML = "";
  }

  let currentPref = prefecture;
  let currentPoint = point;
  let currentMode = mapMode;
  let focusPrefId = prefecture?.national ? "" : prefecture?.id;
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false,
    dragging: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    boxZoom: false,
    keyboard: false,
    tap: false,
    minZoom: 4.5,
    maxZoom: 11.5,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    fadeAnimation: false,
    zoomAnimation: false,
    markerZoomAnimation: false
  });
  map.getContainer().style.background = SEA;
  map.createPane("prefFillPane");
  map.getPane("prefFillPane").style.zIndex = 350;
  map.createPane("prefStrokePane");
  map.getPane("prefStrokePane").style.zIndex = 460;
  map.getPane("prefStrokePane").style.pointerEvents = "none";

  let fillLayer = null;
  let strokeLayer = null;
  const paintPrefs = () => {
    const currentId = focusPrefId || (currentPref?.national ? "" : currentPref?.id);
    if (fillLayer) fillLayer.setStyle((feature) => fillStyle(feature, currentId));
    if (strokeLayer) {
      strokeLayer.setStyle((feature) => strokeStyle(feature, currentId));
      strokeLayer.eachLayer((layer) => {
        if (featurePrefId(layer.feature) === currentId) layer.bringToFront();
      });
    }
  };
  if (prefGeo) {
    fillLayer = L.geoJSON(prefGeo, {
      pane: "prefFillPane",
      interactive: false,
      style: (feature) => fillStyle(feature, prefecture.id)
    }).addTo(map);
    strokeLayer = L.geoJSON(prefGeo, {
      pane: "prefStrokePane",
      interactive: false,
      style: (feature) => strokeStyle(feature, prefecture.id)
    }).addTo(map);
  }
  applyPrefView(map, L, prefecture, point, mapMode);
  container._leaflet = map;

  const stationLayer = L.layerGroup().addTo(map);

  const refresh = () => {
    map.invalidateSize(false);
    if (currentPref) applyPrefView(map, L, currentPref, currentPoint, currentMode);
  };

  const api = {
    map,
    L,
    setView(nextPref, nextPoint, nextMode = currentMode) {
      currentPref = nextPref;
      currentPoint = nextPoint;
      currentMode = nextMode;
      if (!nextPref?.national) focusPrefId = nextPref?.id || "";
      paintPrefs();
      applyPrefView(map, L, nextPref, nextPoint, nextMode);
      refresh();
    },
    setFocusPref(prefId) {
      focusPrefId = prefId || "";
      paintPrefs();
    },
    setStations(rows = [], { showLabels = true } = {}) {
      stationLayer.clearLayers();
      for (const row of rows) {
        const station = row.station;
        if (!station) continue;
        const selected = !!row.selected;
        const label = showLabels ? escapeHtml(row.label || "") : "";
        const name = escapeHtml(row.name || station.prefName || station.name || "");
        const showName = row.showName || selected;
        const html = `
          <div class="amedas-pin ${selected ? "is-selected" : ""} ${row.kind || ""}">
            ${label ? `<strong class="amedas-box">${label}</strong>` : ""}
            ${showName && name ? `<em>${name}</em>` : ""}
            ${row.arrowDeg != null ? `<span class="amedas-mini-arrow" style="transform:rotate(${row.arrowDeg}deg)"></span>` : ""}
            <i class="amedas-dot"></i>
          </div>
        `;
        const icon = L.divIcon({
          className: "amedas-marker",
          html,
          iconSize: [1, 1],
          iconAnchor: [0, 0]
        });
        L.marker([station.latitude, station.longitude], {
          icon,
          interactive: false,
          keyboard: false,
          zIndexOffset: selected ? 400 : 0
        }).addTo(stationLayer);
      }
    },
    invalidate() {
      refresh();
    },
    destroy() {
      map.remove();
      delete container._amedasMap;
      delete container._leaflet;
    }
  };

  container._amedasMap = api;
  requestAnimationFrame(refresh);
  setTimeout(refresh, 120);
  setTimeout(refresh, 400);
  return api;
}

export const MAP_ATTRIBUTION = "都道府県界 ／ アメダス観測 © 気象庁";
