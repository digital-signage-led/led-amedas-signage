/**
 * 3コンテンツ共通の地図。位置・ズーム・ピンはここだけを変える。
 * 観測値ラベルの中身だけ各コンテンツから渡す。
 */

const GSI_PALE = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const GSI_ATTR = "地理院タイル";

let leafletPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = new URL("../../vendor/leaflet/leaflet.css", import.meta.url).href;
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = new URL("../../vendor/leaflet/leaflet.js", import.meta.url).href;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet を読み込めませんでした"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function zoomFor(pref, point, mapMode) {
  if (mapMode === "station" && point) return Math.min(11, Math.max(9.2, pref.defaultZoom + 1.6));
  if (!point) return pref.defaultZoom;
  const dLat = Math.abs(point.latitude - pref.centerLatitude);
  const dLng = Math.abs(point.longitude - pref.centerLongitude);
  if (dLat > 1.4 || dLng > 1.6) return Math.min(10.2, Math.max(8.6, pref.defaultZoom + 1.4));
  return pref.defaultZoom;
}

export function mapCenter(pref, point, mapMode) {
  if (mapMode === "station" && point) return [point.latitude, point.longitude];
  if (!point) return [pref.centerLatitude, pref.centerLongitude];
  const dLat = Math.abs(point.latitude - pref.centerLatitude);
  const dLng = Math.abs(point.longitude - pref.centerLongitude);
  if (dLat > 1.4 || dLng > 1.6) return [point.latitude, point.longitude];
  return [pref.centerLatitude, pref.centerLongitude];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function createMap(container, { prefecture, point, interactive = false, mapMode = "prefecture" }) {
  const L = await loadLeaflet();
  if (container._amedasMap) {
    container._amedasMap.setView(prefecture, point, mapMode);
    return container._amedasMap;
  }
  if (container._leaflet_id) {
    container._leaflet_id = null;
    container.innerHTML = "";
  }
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false,
    dragging: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    boxZoom: false,
    keyboard: false,
    tap: false,
    zoomSnap: 0.1,
    zoomDelta: 0.2
  });
  L.tileLayer(GSI_PALE, {
    maxZoom: 14,
    minZoom: 5,
    opacity: 1
  }).addTo(map);
  map.setView(mapCenter(prefecture, point, mapMode), zoomFor(prefecture, point, mapMode), { animate: false });

  const layer = L.layerGroup().addTo(map);

  const api = {
    map,
    L,
    setView(nextPref, nextPoint, nextMode = mapMode) {
      map.setView(mapCenter(nextPref, nextPoint, nextMode), zoomFor(nextPref, nextPoint, nextMode), { animate: false });
    },
    setStations(rows = [], { showLabels = true } = {}) {
      layer.clearLayers();
      for (const row of rows) {
        const station = row.station;
        if (!station) continue;
        const selected = !!row.selected;
        const label = showLabels ? escapeHtml(row.label || "") : "";
        const html = `
          <div class="amedas-pin ${selected ? "is-selected" : ""} ${row.kind || ""}">
            <i class="amedas-dot"></i>
            ${row.arrowDeg != null ? `<span class="amedas-mini-arrow" style="transform:rotate(${row.arrowDeg}deg)"></span>` : ""}
            ${label ? `<strong>${label}</strong>` : ""}
            ${selected ? `<em>${escapeHtml(station.name)}</em>` : ""}
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
        }).addTo(layer);
      }
    },
    invalidate() {
      map.invalidateSize(false);
    },
    destroy() {
      map.remove();
      delete container._amedasMap;
    }
  };

  container._amedasMap = api;
  requestAnimationFrame(() => api.invalidate());
  return api;
}

export const MAP_ATTRIBUTION = `${GSI_ATTR} © 国土地理院 ／ アメダス観測 © 気象庁`;
