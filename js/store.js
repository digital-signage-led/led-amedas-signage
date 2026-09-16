/**
 * 下書きと公開の分離。
 * サイネージ本番は公開設定と data/published-settings.json を読む。
 */
import { CONTENTS } from "./data/contents.js";
import { comboKey, defaultPoint } from "./data/observation-points.js";
import { PREFECTURES } from "./data/prefectures.js";

export const DRAFT_KEY = "amedas-obs-draft-v1";
export const PUBLISHED_KEY = "amedas-obs-published-v1";

let filePublished = null;
let hydrated = false;

export function defaultCommon() {
  return {
    titleSize: 1,
    titleX: 0,
    titleY: 0,
    mapScale: 1,
    mapX: 0,
    mapY: 0,
    fontSize: 1,
    numberSize: 1,
    panelX: 0,
    panelY: 0,
    padding: 1,
    displayScale: 1,
    refreshMinutes: 10,
    resolution: "1920x1080",
    background: "sea",
    mapMode: "prefecture",
    showStamp: true,
    showPoint: true,
    showPanel: true,
    showAttribution: true,
    showClock: true,
    showMapLabels: true
  };
}

export function defaultContentSettings() {
  return {
    amedas_temp: {
      valueX: 0,
      valueY: 0,
      valueSize: 1,
      showUnit: true,
      showStationName: true
    },
    amedas_precip: {
      valueX: 0,
      valueY: 0,
      valueSize: 1,
      showUnit: true,
      showStationName: true
    },
    amedas_wind: {
      dirX: 0,
      dirY: 0,
      speedX: 0,
      speedY: 0,
      arrowSize: 1,
      speedSize: 1,
      showUnit: true,
      showStationName: true
    }
  };
}

export function emptyStore() {
  const points = {};
  const status = {};
  for (const pref of PREFECTURES) {
    const point = defaultPoint(pref.slug);
    for (const content of CONTENTS) {
      const key = comboKey(pref.slug, content.id);
      points[key] = point?.id || "";
      status[key] = "published";
    }
  }
  return {
    version: 1,
    updatedAt: null,
    publishedAt: null,
    common: defaultCommon(),
    contents: defaultContentSettings(),
    points,
    status
  };
}

function mergeStore(base, patch) {
  const out = emptyStore();
  if (!patch || typeof patch !== "object") return out;
  out.updatedAt = patch.updatedAt || base.updatedAt || null;
  out.publishedAt = patch.publishedAt || base.publishedAt || null;
  out.common = { ...out.common, ...(patch.common || {}) };
  out.contents = {
    amedas_temp: { ...out.contents.amedas_temp, ...(patch.contents?.amedas_temp || {}) },
    amedas_precip: { ...out.contents.amedas_precip, ...(patch.contents?.amedas_precip || {}) },
    amedas_wind: { ...out.contents.amedas_wind, ...(patch.contents?.amedas_wind || {}) }
  };
  out.points = { ...out.points, ...(patch.points || {}) };
  out.status = { ...out.status, ...(patch.status || {}) };
  return out;
}

function readKey(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeKey(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function hydratePublished() {
  if (hydrated) return filePublished;
  hydrated = true;
  try {
    const res = await fetch(new URL("../data/published-settings.json", import.meta.url), { cache: "no-store" });
    if (res.ok) filePublished = await res.json();
  } catch {
    filePublished = null;
  }
  return filePublished;
}

export function loadDraft() {
  return mergeStore(emptyStore(), readKey(DRAFT_KEY) || filePublished);
}

export function loadPublished() {
  const local = readKey(PUBLISHED_KEY);
  if (local) return mergeStore(emptyStore(), local);
  if (filePublished) return mergeStore(emptyStore(), filePublished);
  return emptyStore();
}

export function saveDraft(store) {
  const next = mergeStore(emptyStore(), store);
  next.updatedAt = new Date().toISOString();
  writeKey(DRAFT_KEY, next);
  return next;
}

export function publishDraft(store) {
  const next = mergeStore(emptyStore(), store);
  const now = new Date().toISOString();
  next.updatedAt = now;
  next.publishedAt = now;
  for (const key of Object.keys(next.status)) {
    next.status[key] = "published";
  }
  writeKey(DRAFT_KEY, next);
  writeKey(PUBLISHED_KEY, next);
  return next;
}

export function publishCombo(store, prefecture, content) {
  const draft = mergeStore(emptyStore(), store);
  const published = loadPublished();
  const key = comboKey(prefecture, content);
  draft.status[key] = "published";
  published.common = { ...draft.common };
  published.contents = JSON.parse(JSON.stringify(draft.contents));
  published.points[key] = draft.points[key];
  published.status[key] = "published";
  published.publishedAt = new Date().toISOString();
  draft.updatedAt = published.publishedAt;
  writeKey(DRAFT_KEY, draft);
  writeKey(PUBLISHED_KEY, published);
  return { draft, published };
}

export function comboStatus(store, prefecture, content) {
  return store.status[comboKey(prefecture, content)] || "draft";
}

export function settingsForSignage(prefecture, content) {
  const published = loadPublished();
  const key = comboKey(prefecture, content);
  return {
    common: published.common,
    content: published.contents[content] || {},
    pointId: published.points[key],
    status: published.status[key] || "published",
    publishedAt: published.publishedAt
  };
}

export function allCombos() {
  const published = loadPublished();
  const draft = loadDraft();
  const rows = [];
  for (const pref of PREFECTURES) {
    for (const content of CONTENTS) {
      const key = comboKey(pref.slug, content.id);
      rows.push({
        key,
        prefecture: pref,
        content,
        pointId: draft.points[key] || published.points[key],
        status: published.status[key] === "published" ? "published" : (draft.status[key] || "draft")
      });
    }
  }
  return rows;
}

export function signageSearch(prefecture, content) {
  return `?prefecture=${encodeURIComponent(prefecture)}&content=${encodeURIComponent(content)}`;
}

export function signageUrl(prefecture, content, baseHref = location.href) {
  const url = new URL("index.html", baseHref);
  url.search = "";
  url.hash = "";
  return `${url.href}${signageSearch(prefecture, content)}`;
}

export async function persistPublishedFile(store) {
  try {
    const res = await fetch("/api/published-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(store)
    });
    if (res.ok) return { ok: true, mode: "server" };
  } catch {
    /* ローカルサーバ未起動時はダウンロード */
  }
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "published-settings.json";
  a.click();
  URL.revokeObjectURL(a.href);
  return { ok: true, mode: "download" };
}
