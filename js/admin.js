import { CONTENTS } from "./data/contents.js";
import { comboKey, defaultPoint, pointsForPrefecture } from "./data/observation-points.js";
import { SIGNAGE_AREAS } from "./data/prefectures.js";
import { mountSignage } from "./signage-view.js";
import {
  allCombos,
  comboStatus,
  hydratePublished,
  loadDraft,
  persistPublishedFile,
  publishCombo,
  publishDraft,
  saveDraft,
  signageUrl
} from "./store.js";
import { applyDesignTokens } from "./viewport.js";

const $ = (id) => document.getElementById(id);

const state = {
  store: null,
  prefecture: "toyama",
  content: "amedas_temp",
  preview: null
};

function fillSelect(el, items, getValue, getLabel, selected) {
  el.innerHTML = items.map((item) => {
    const value = getValue(item);
    return `<option value="${value}" ${value === selected ? "selected" : ""}>${getLabel(item)}</option>`;
  }).join("");
}

function currentPointId() {
  const key = comboKey(state.prefecture, state.content);
  return state.store.points[key] || defaultPoint(state.prefecture, state.content)?.id;
}

function setPointId(id) {
  state.store.points[comboKey(state.prefecture, state.content)] = id;
}

function syncCommonInputs() {
  const c = state.store.common;
  $("resolution").value = c.resolution || "1920x1080";
  $("background").value = c.background || "sea";
  $("refresh-min").value = c.refreshMinutes || 10;
  $("display-scale").value = c.displayScale ?? 1;
  $("title-size").value = c.titleSize;
  $("title-x").value = c.titleX;
  $("title-y").value = c.titleY;
  $("font-size").value = c.fontSize;
  $("number-size").value = c.numberSize ?? 1;
  $("panel-x").value = c.panelX;
  $("panel-y").value = c.panelY;
  $("padding").value = c.padding;
  $("show-stamp").checked = c.showStamp !== false;
  $("show-point").checked = c.showPoint !== false;
  $("show-clock").checked = c.showClock !== false;
  $("show-panel").checked = c.showPanel !== false;
  $("show-attr").checked = c.showAttribution !== false;
}

function readCommonInputs() {
  const c = state.store.common;
  c.resolution = $("resolution").value;
  c.background = $("background").value;
  c.refreshMinutes = Math.max(10, Number($("refresh-min").value) || 10);
  c.displayScale = Number($("display-scale").value);
  c.titleSize = Number($("title-size").value);
  c.titleX = Number($("title-x").value);
  c.titleY = Number($("title-y").value);
  c.fontSize = Number($("font-size").value);
  c.numberSize = Number($("number-size").value);
  c.panelX = Number($("panel-x").value);
  c.panelY = Number($("panel-y").value);
  c.padding = Number($("padding").value);
  c.showStamp = $("show-stamp").checked;
  c.showPoint = $("show-point").checked;
  c.showClock = $("show-clock").checked;
  c.showPanel = $("show-panel").checked;
  c.showAttribution = $("show-attr").checked;
}

function syncContentInputs() {
  const s = state.store.contents;
  $("temp-x").value = s.amedas_temp.valueX;
  $("temp-y").value = s.amedas_temp.valueY;
  $("temp-size").value = s.amedas_temp.valueSize;
  $("temp-unit").checked = s.amedas_temp.showUnit !== false;
  $("temp-name").checked = s.amedas_temp.showStationName !== false;
  $("rain-x").value = s.amedas_precip.valueX;
  $("rain-y").value = s.amedas_precip.valueY;
  $("rain-size").value = s.amedas_precip.valueSize;
  $("rain-unit").checked = s.amedas_precip.showUnit !== false;
  $("rain-name").checked = s.amedas_precip.showStationName !== false;
  $("dir-x").value = s.amedas_wind.dirX;
  $("dir-y").value = s.amedas_wind.dirY;
  $("speed-x").value = s.amedas_wind.speedX;
  $("speed-y").value = s.amedas_wind.speedY;
  $("arrow-size").value = s.amedas_wind.arrowSize;
  $("speed-size").value = s.amedas_wind.speedSize;
  $("wind-unit").checked = s.amedas_wind.showUnit !== false;
  $("wind-name").checked = s.amedas_wind.showStationName !== false;
  document.querySelectorAll("[data-for-content]").forEach((el) => {
    el.hidden = el.dataset.forContent !== state.content;
  });
}

function readContentInputs() {
  const s = state.store.contents;
  s.amedas_temp.valueX = Number($("temp-x").value);
  s.amedas_temp.valueY = Number($("temp-y").value);
  s.amedas_temp.valueSize = Number($("temp-size").value);
  s.amedas_temp.showUnit = $("temp-unit").checked;
  s.amedas_temp.showStationName = $("temp-name").checked;
  s.amedas_precip.valueX = Number($("rain-x").value);
  s.amedas_precip.valueY = Number($("rain-y").value);
  s.amedas_precip.valueSize = Number($("rain-size").value);
  s.amedas_precip.showUnit = $("rain-unit").checked;
  s.amedas_precip.showStationName = $("rain-name").checked;
  s.amedas_wind.dirX = Number($("dir-x").value);
  s.amedas_wind.dirY = Number($("dir-y").value);
  s.amedas_wind.speedX = Number($("speed-x").value);
  s.amedas_wind.speedY = Number($("speed-y").value);
  s.amedas_wind.arrowSize = Number($("arrow-size").value);
  s.amedas_wind.speedSize = Number($("speed-size").value);
  s.amedas_wind.showUnit = $("wind-unit").checked;
  s.amedas_wind.showStationName = $("wind-name").checked;
}

function statusLabel() {
  const status = comboStatus(state.store, state.prefecture, state.content);
  $("combo-status").textContent = status === "published" ? "公開済み" : "下書き";
  $("combo-status").dataset.status = status;
}

function applyLivePreview() {
  if (!state.preview?.els?.screen) return;
  const common = state.store.common;
  applyDesignTokens(state.preview.els.screen, {
    common,
    content: state.store.contents[state.content]
  });
  state.preview.els.stamp.hidden = common.showStamp === false;
  state.preview.els.point.hidden = common.showPoint === false;
  state.preview.els.panel.hidden = common.showPanel === false;
  state.preview.els.attr.hidden = common.showAttribution === false;
  state.preview.els.screen.classList.toggle("is-panel-off", common.showPanel === false);
  state.preview.els.screen.classList.toggle("is-clock-off", common.showClock === false);
}

async function renderPreview() {
  const host = $("preview-host");
  if (state.preview) {
    state.preview.destroy();
    if (state.preview.map) {
      try { state.preview.map.destroy(); } catch { /* ignore */ }
    }
  }
  host.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "preview-scale";
  host.appendChild(wrap);
  state.preview = await mountSignage(wrap, {
    prefecture: state.prefecture,
    content: state.content,
    pointId: currentPointId(),
    settings: {
      common: state.store.common,
      content: state.store.contents[state.content],
      pointId: currentPointId()
    },
    fit: true,
    fitHost: host
  });
}

function fillPoints() {
  const points = pointsForPrefecture(state.prefecture, state.content);
  fillSelect($("point-select"), points, (p) => p.id, (p) => `${p.name}（${p.id}）`, currentPointId());
  if (!points.some((p) => p.id === currentPointId()) && points[0]) {
    setPointId(points[0].id);
    $("point-select").value = points[0].id;
  }
}

function publicHref(pref, content) {
  return signageUrl(pref, content, `${location.origin}${location.pathname.replace(/admin\.html.*$/, "index.html")}`);
}

function renderUrls() {
  const qPref = $("url-pref").value.trim();
  const qContent = $("url-content").value;
  const qStatus = $("url-status").value;
  const rows = allCombos().filter((row) => {
    if (qPref && !(`${row.prefecture.name}${row.prefecture.slug}`.includes(qPref))) return false;
    if (qContent && row.content.id !== qContent) return false;
    if (qStatus && row.status !== qStatus) return false;
    return true;
  });
  $("url-count").textContent = `${rows.length} / 144`;
  $("url-table").innerHTML = rows.map((row) => {
    const url = publicHref(row.prefecture.slug, row.content.id);
    return `<tr>
      <td>${row.prefecture.name}</td>
      <td>${row.content.name}</td>
      <td><span class="pill" data-status="${row.status}">${row.status === "published" ? "公開済み" : "下書き"}</span></td>
      <td class="url-cell"><code>${url}</code></td>
      <td><button type="button" data-copy="${url}">URLをコピー</button></td>
    </tr>`;
  }).join("");
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => { el.hidden = true; }, 2400);
}

function bind() {
  fillSelect($("pref-select"), SIGNAGE_AREAS, (p) => p.slug, (p) => p.name, state.prefecture);
  fillSelect($("content-select"), CONTENTS, (c) => c.id, (c) => c.name, state.content);
  fillSelect($("url-content"), [{ id: "", name: "すべてのコンテンツ" }, ...CONTENTS], (c) => c.id, (c) => c.name, "");
  fillPoints();
  syncCommonInputs();
  syncContentInputs();
  statusLabel();

  $("pref-select").addEventListener("change", () => {
    state.prefecture = $("pref-select").value;
    fillPoints();
    statusLabel();
    renderPreview();
  });
  $("content-select").addEventListener("change", () => {
    state.content = $("content-select").value;
    fillPoints();
    syncContentInputs();
    statusLabel();
    renderPreview();
  });
  $("point-select").addEventListener("change", () => {
    setPointId($("point-select").value);
    renderPreview();
  });

  document.querySelectorAll("[data-live]").forEach((el) => {
    el.addEventListener("input", () => {
      readCommonInputs();
      readContentInputs();
      applyLivePreview();
    });
    el.addEventListener("change", () => {
      readCommonInputs();
      readContentInputs();
      if (el.id === "resolution" || el.id === "background" || el.id === "temp-unit" || el.id === "rain-unit" || el.id === "wind-unit") {
        renderPreview();
      } else {
        applyLivePreview();
      }
    });
  });

  $("btn-save").addEventListener("click", () => {
    readCommonInputs();
    readContentInputs();
    state.store = saveDraft(state.store);
    statusLabel();
    toast("下書きを保存しました");
  });
  $("btn-publish").addEventListener("click", async () => {
    readCommonInputs();
    readContentInputs();
    const result = publishCombo(state.store, state.prefecture, state.content);
    state.store = result.draft;
    statusLabel();
    renderUrls();
    const persist = await persistPublishedFile(result.published);
    toast(persist.mode === "server" ? "この組み合わせを公開しました" : "公開しました（設定ファイルを保存してください）");
  });
  $("btn-publish-all").addEventListener("click", async () => {
    readCommonInputs();
    readContentInputs();
    state.store = publishDraft(state.store);
    statusLabel();
    renderUrls();
    await persistPublishedFile(state.store);
    toast("144件を公開設定に反映しました");
  });
  $("btn-open").addEventListener("click", () => {
    window.open(publicHref(state.prefecture, state.content), "_blank");
  });

  $("url-pref").addEventListener("input", renderUrls);
  $("url-content").addEventListener("change", renderUrls);
  $("url-status").addEventListener("change", renderUrls);
  $("url-table").addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-copy]");
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toast("URLをコピーしました");
    } catch {
      toast("コピーできませんでした");
    }
  });
}

await hydratePublished();
state.store = loadDraft();
bind();
renderPreview();
renderUrls();
