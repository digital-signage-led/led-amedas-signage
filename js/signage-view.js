import { renderPrecipitation } from "./contents/precipitation.js";
import { mapLabelFor, mapMarkerRows } from "./contents/shared-ui.js";
import { renderTemperature } from "./contents/temperature.js";
import { renderWind } from "./contents/wind.js";
import { getContent } from "./data/contents.js";
import { defaultPoint, getPoint, tableStations } from "./data/observation-points.js";
import { getPrefecture, isJapan, regionOf } from "./data/prefectures.js";
import { createMap, MAP_ATTRIBUTION } from "./map/map-engine.js";
import { fetchAmedasBundle, windDirectionInfo } from "./services/amedas.js";
import { formatStamp, nextAmedasRefreshDelay } from "./services/jma-common.js";
import { settingsForSignage } from "./store.js";
import { applyDesignTokens, designSize, fitFixedScreen, measureVisibleBox, FIXED_DESIGN } from "./viewport.js";

const RENDERERS = {
  amedas_temp: renderTemperature,
  amedas_precip: renderPrecipitation,
  amedas_wind: renderWind
};

const CYCLE_MS = 7000;

function screenHtml() {
  return `
    <article class="led-screen" data-ready="0">
      <header class="led-header">
        <div class="led-title-bar">
          <h1 class="led-title"></h1>
        </div>
        <div class="led-sub-bar">
          <div class="led-stamp">データ取得中</div>
          <div class="led-point"></div>
        </div>
      </header>
      <div class="led-body">
        <div class="map-stage">
          <div class="cycle-bar" aria-hidden="true"><i></i></div>
          <div class="map-canvas"></div>
          <div class="okinawa-dock" hidden></div>
        </div>
        <aside class="info-panel"></aside>
      </div>
      <div class="map-attribution"></div>
    </article>
  `;
}

export function buildScreen(root) {
  root.innerHTML = screenHtml();
  const screen = root.querySelector(".led-screen");
  return {
    root,
    screen,
    title: screen.querySelector(".led-title"),
    stamp: screen.querySelector(".led-stamp"),
    point: screen.querySelector(".led-point"),
    panel: screen.querySelector(".info-panel"),
    mapCanvas: screen.querySelector(".map-canvas"),
    cycleBar: screen.querySelector(".cycle-bar > i"),
    okinawaDock: screen.querySelector(".okinawa-dock"),
    attr: screen.querySelector(".map-attribution")
  };
}

function applyVisibility(els, common) {
  els.stamp.hidden = common.showStamp === false;
  els.point.hidden = common.showPoint === false;
  els.panel.hidden = common.showPanel === false;
  els.attr.hidden = common.showAttribution === false;
  els.screen.classList.toggle("is-panel-off", common.showPanel === false);
  els.screen.classList.toggle("is-clock-off", common.showClock === false);
}

function restartCycleBar(els) {
  const bar = els.cycleBar;
  if (!bar) return;
  bar.style.animation = "none";
  void bar.offsetWidth;
  bar.style.animation = "";
}

function focusBundle(data, stationId) {
  const rows = data.stations || [];
  if (!rows.length) return data;
  const match = rows.find((row) => row.station.id === stationId) || rows[0];
  for (const row of rows) row.selected = row.station.id === match.station.id;
  data.selected = {
    station: match.station,
    obs: match.obs,
    missing: false,
    wind: windDirectionInfo(match.obs?.windDirection)
  };
  return data;
}

function applyStamp(els, data) {
  if (!data.ok && !data.fromCache) {
    els.stamp.textContent = data.message || "データ取得に失敗しました";
    return;
  }
  if (data.fromCache) {
    els.stamp.textContent = data.reportAt
      ? `${formatStamp(data.reportAt)}観測（更新待ち）`
      : "更新待ち";
    return;
  }
  els.stamp.textContent = data.reportAt
    ? `${formatStamp(data.reportAt)}観測`
    : "更新時刻を確認中";
}

function collectEls(root) {
  if (root.querySelector(".led-screen")) {
    return {
      root,
      screen: root.querySelector(".led-screen"),
      title: root.querySelector(".led-title"),
      stamp: root.querySelector(".led-stamp"),
      point: root.querySelector(".led-point"),
      panel: root.querySelector(".info-panel"),
      mapCanvas: root.querySelector(".map-canvas"),
      cycleBar: root.querySelector(".cycle-bar > i"),
      okinawaDock: root.querySelector(".okinawa-dock"),
      attr: root.querySelector(".map-attribution")
    };
  }
  return buildScreen(root);
}

function pointCaption(national, station) {
  if (!station) return "";
  if (national) return `${station.prefName || ""} ${station.name}`.trim();
  return `観測地点 ${station.name}`;
}

export async function mountSignage(root, options = {}) {
  const prefecture = getPrefecture(options.prefecture);
  const content = getContent(options.content);
  const published = options.settings || settingsForSignage(prefecture.slug, content.id);
  const point = options.point || getPoint(options.pointId || published.pointId, prefecture.slug, content.id) || defaultPoint(prefecture.slug, content.id);
  const common = published.common || {};
  const contentSettings = published.content || published.contents?.[content.id] || {};
  const design = designSize(common.resolution);
  const els = collectEls(root);
  const national = isJapan(prefecture.slug);

  els.screen.dataset.prefecture = prefecture.slug;
  els.screen.dataset.content = content.id;
  els.screen.classList.toggle("is-national", national);
  els.title.textContent = `${prefecture.name}｜${content.name}`;
  els.stamp.textContent = "データ取得中";
  els.point.textContent = pointCaption(national, point);
  els.attr.textContent = MAP_ATTRIBUTION;
  els.panel.innerHTML = `
    <div class="panel-kicker">${content.name}</div>
    <div class="panel-area">${prefecture.name}${point ? `／${point.prefName || point.name}` : ""}</div>
    <p class="wx-hint">${content.description}</p>
    <div class="time-grid"><div><span class="k">対象地域</span><strong>${regionOf(prefecture.slug).name} ${prefecture.name}</strong></div></div>
  `;
  applyDesignTokens(els.screen, { common, content: contentSettings });
  applyVisibility(els, common);
  const cleanups = [];
  const fitTo = () => {
    if (options.fit === false) return;
    const host = options.fitHost || els.root;
    const bounds = host && host !== document.body ? measureVisibleBox(host) : null;
    fitFixedScreen(els.screen, design.width || FIXED_DESIGN.width, design.height || FIXED_DESIGN.height, bounds);
  };
  fitTo();
  if (options.fitHost) {
    const ro = new ResizeObserver(fitTo);
    ro.observe(options.fitHost);
    cleanups.push(() => ro.disconnect());
  }

  const mapLimit = national ? 47 : 28;
  const tableSet = tableStations(prefecture.slug, point, content.id, mapLimit);
  const nearby = tableSet.points;
  let latest = null;
  let mapApi = null;
  let focusIndex = Math.max(0, nearby.findIndex((item) => item.id === point.id));
  const render = RENDERERS[content.id] || renderTemperature;

  async function ensureMap() {
    if (mapApi || !els.mapCanvas) return mapApi;
    mapApi = await createMap(els.mapCanvas, {
      prefecture,
      point,
      interactive: false,
      mapMode: common.mapMode || "prefecture"
    });
    return mapApi;
  }

  function paint(animate) {
    if (!latest) return;
    const row = latest.stations?.[focusIndex] || latest.stations?.[0];
    if (!row) return;
    focusBundle(latest, row.station.id);
    els.point.textContent = pointCaption(national, row.station);
    if (animate) {
      els.panel.classList.remove("is-swap");
      void els.panel.offsetWidth;
      els.panel.classList.add("is-swap");
    }
    render({ prefecture, content, point: row.station, common, contentSettings, els }, latest);
    if (mapApi) {
      if (national) {
        const focus = getPrefecture(row.station.prefecture || row.station.prefSlug);
        mapApi.setFocusPref(focus.id);
      }
      const markers = mapMarkerRows(content.id, latest, { national }).filter((item) => {
        if (!national) return true;
        return item.station.prefecture !== "okinawa" && item.station.prefSlug !== "okinawa";
      });
      mapApi.setStations(markers, { showLabels: common.showMapLabels !== false });
    }
    if (els.okinawaDock) {
      const oki = (latest.stations || []).find((item) => item.station.prefecture === "okinawa" || item.station.prefSlug === "okinawa");
      els.okinawaDock.hidden = !national || !oki;
      if (national && oki) {
        const wind = windDirectionInfo(oki.obs.windDirection);
        els.okinawaDock.classList.toggle("is-selected", !!oki.selected);
        els.okinawaDock.innerHTML = `<em>沖縄県</em><strong>${mapLabelFor(content.id, oki.obs, wind) || "観測データなし"}</strong>`;
      }
    }
    restartCycleBar(els);
  }

  async function refresh() {
    let data;
    try {
      data = await fetchAmedasBundle({
        prefecture: prefecture.slug,
        contentId: content.id,
        point,
        nearby
      });
    } catch {
      data = {
        ok: false,
        fromCache: false,
        reportAt: null,
        fetchedAt: new Date(),
        selected: { station: point, obs: {}, missing: true, wind: windDirectionInfo(null) },
        stations: nearby.map((station) => ({ station, obs: {}, selected: station.id === point.id })),
        message: "データ取得に失敗しました"
      };
    }
    latest = data;
    if (latest.stations?.length) {
      focusIndex = Math.min(focusIndex, latest.stations.length - 1);
    }
    try {
      await ensureMap();
      mapApi?.invalidate?.();
      paint(false);
    } catch {
      els.panel.insertAdjacentHTML("beforeend", `<div class="data-error">表示処理で問題が起きました</div>`);
    }
    applyStamp(els, latest);
    els.screen.dataset.ready = latest.ok || latest.fromCache ? "1" : "0";
    return latest;
  }

  const data = await refresh();

  const cycleTimer = window.setInterval(() => {
    if (document.hidden || !latest?.stations?.length) return;
    focusIndex = (focusIndex + 1) % latest.stations.length;
    paint(true);
  }, CYCLE_MS);
  cleanups.push(() => window.clearInterval(cycleTimer));

  const onVisible = () => {
    if (!document.hidden) restartCycleBar(els);
  };
  document.addEventListener("visibilitychange", onVisible);
  cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));

  return {
    prefecture,
    content,
    point,
    map: mapApi,
    els,
    data,
    refresh,
    destroy() {
      try { mapApi?.destroy?.(); } catch { /* ignore */ }
      cleanups.forEach((fn) => {
        try { fn(); } catch { /* ignore */ }
      });
    }
  };
}

export function bindAutoFit(screen, resolution = "1920x1080") {
  const size = designSize(resolution);
  const onResize = () => fitFixedScreen(screen, size.width, size.height);
  window.addEventListener("resize", onResize);
  onResize();
  return () => window.removeEventListener("resize", onResize);
}

export function refreshDelayFor(common = {}) {
  return nextAmedasRefreshDelay(common.refreshMinutes);
}
