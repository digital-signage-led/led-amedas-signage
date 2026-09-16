const LASTGOOD_KEY = "amedas-obs-lastgood-v1";

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function readAll() {
  const ls = storage();
  if (!ls) return {};
  try {
    return JSON.parse(ls.getItem(LASTGOOD_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeAll(value) {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(LASTGOOD_KEY, JSON.stringify(value));
  } catch {
    try {
      ls.setItem(LASTGOOD_KEY, JSON.stringify({ latest: value.latest || null }));
    } catch {
      /* ignore */
    }
  }
}

export function cacheKey(prefecture, content, pointId) {
  return `${prefecture}:${content}:${pointId || "default"}`;
}

export function saveLastGood(key, payload) {
  const all = readAll();
  all[key] = {
    savedAt: new Date().toISOString(),
    payload
  };
  all.latest = { key, savedAt: all[key].savedAt };
  writeAll(all);
}

export function loadLastGood(key) {
  const all = readAll();
  return all[key]?.payload || null;
}
