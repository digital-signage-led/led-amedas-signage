import { renderPrecipitation } from "./contents/precipitation.js";
import { mainStationTable } from "./contents/shared-ui.js";
import { renderTemperature } from "./contents/temperature.js";
import { renderWind } from "./contents/wind.js";
import { getContent } from "./data/contents.js";
import { defaultPoint, getPoint, tableStations } from "./data/observation-points.js";
import { getPrefecture, regionOf } from "./data/prefectures.js";
import { fetchAmedasBundle, windDirectionInfo } from "./services/amedas.js";
import { formatStamp, nextAmedasRefreshDelay } from "./services/jma-common.js";
import { settingsForSignage } from "./store.js";
import { applyDesignTokens, designSize, fitFixedScreen, measureVisibleBox, FIXED_DESIGN } from "./viewport.js";

const RENDERERS = {
  amedas_temp: renderTemperature,
  amedas_precip: renderPrecipitation,
  amedas_wind: renderWind
};

const TABLE_ATTRIBUTION = "アメダス観測 © 気象庁";

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
        <div class="table-stage">
          <div class="table-canvas"></div>
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
    tableCanvas: screen.querySelector(".table-canvas"),
    attr: screen.querySelector(".map-attribution")
  };
}

function tableKicker(contentId) {
  if (contentId === "amedas_temp") return "県内の気温";
  if (contentId === "amedas_precip") return "県内の降水量";
  return "県内の風向・風速";
}

function applyVisibility(els, common) {
  els.stamp.hidden = common.showStamp === false;
  els.point.hidden = common.showPoint === false;
  els.panel.hidden = common.showPanel === false;
  els.attr.hidden = common.showAttribution === false;
  els.screen.classList.toggle("is-panel-off", common.showPanel === false);
  els.screen.classList.toggle("is-clock-off", common.showClock === false);
}

function applyTable(els, data, contentId, showUnit, hidden = 0) {
  if (!els.tableCanvas) return;
  els.tableCanvas.innerHTML = `
    <div class="table-kicker">${tableKicker(contentId)}</div>
    ${mainStationTable(contentId, data, showUnit)}
    ${hidden > 0 ? `<div class="table-more">ほか ${hidden} 地点</div>` : ""}
  `;
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
      tableCanvas: root.querySelector(".table-canvas"),
      attr: root.querySelector(".map-attribution")
    };
  }
  return buildScreen(root);
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

  els.screen.dataset.prefecture = prefecture.slug;
  els.screen.dataset.content = content.id;
  els.title.textContent = `${prefecture.name}｜${content.name}`;
  els.stamp.textContent = "データ取得中";
  els.point.textContent = point ? `観測地点 ${point.name}` : "";
  els.attr.textContent = TABLE_ATTRIBUTION;
  els.tableCanvas.innerHTML = `<div class="table-kicker">${tableKicker(content.id)}</div><p class="wx-hint">データ取得中</p>`;
  els.panel.innerHTML = `
    <div class="panel-kicker">${content.name}</div>
    <div class="panel-area">${prefecture.name}${point ? `／${point.name}` : ""}</div>
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

  const tableSet = tableStations(prefecture.slug, point, content.id, 36);
  const nearby = tableSet.points;

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
    try {
      applyTable(els, data, content.id, contentSettings.showUnit !== false, tableSet.hidden);
      const render = RENDERERS[content.id] || renderTemperature;
      render({ prefecture, content, point, common, contentSettings, els }, data);
    } catch {
      els.panel.insertAdjacentHTML("beforeend", `<div class="data-error">表示処理で問題が起きました</div>`);
    }
    applyStamp(els, data);
    els.screen.dataset.ready = data.ok || data.fromCache ? "1" : "0";
    return data;
  }

  const data = await refresh();

  return {
    prefecture,
    content,
    point,
    map: null,
    els,
    data,
    refresh,
    destroy() {
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
