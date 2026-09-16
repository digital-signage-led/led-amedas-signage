/**
 * 気象庁アメダス。1画面で map JSON を1回だけ取り、地点JSONは欠測補完時だけ使う。
 * 欠測や取得失敗を 0 に置き換えない。
 */
import { cacheKey, loadLastGood, saveLastGood } from "./cache.js";
import {
  AMEDAS_LATEST_URL,
  AMEDAS_MAP_URL,
  AMEDAS_POINT_BLOCK_URL,
  AMEDAS_POINT_URL,
  fetchJson,
  fetchText,
  jstParts,
  parseJst
} from "./jma-common.js";

const WIND_DIRS = [
  "静穏",
  "北北東", "北東", "東北東", "東",
  "東南東", "南東", "南南東", "南",
  "南南西", "南西", "西南西", "西",
  "西北西", "北西", "北北西", "北"
];

let inFlight = null;

export function amedasField(field) {
  if (!Array.isArray(field) || field.length < 1) return null;
  const raw = field[0];
  const quality = field[1];
  if (raw === "" || raw == null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (quality != null && Number(quality) >= 4) return null;
  return value;
}

export function windDirectionInfo(code) {
  if (code == null || !Number.isFinite(Number(code))) {
    return { code: null, label: null, fromDeg: null, toDeg: null, calm: false };
  }
  const n = Math.round(Number(code));
  if (n === 0) {
    return { code: 0, label: "静穏", fromDeg: null, toDeg: null, calm: true };
  }
  if (n < 1 || n > 16) {
    return { code: n, label: null, fromDeg: null, toDeg: null, calm: false };
  }
  const fromDeg = (n * 22.5) % 360;
  return {
    code: n,
    label: WIND_DIRS[n],
    fromDeg,
    toDeg: (fromDeg + 180) % 360,
    calm: false
  };
}

export function pickPointBlockObs(data, exactKey) {
  if (!data || typeof data !== "object") return null;
  if (amedasField(data.temp) != null || amedasField(data.wind) != null || amedasField(data.precipitation10m) != null) {
    return data;
  }
  const keys = Object.keys(data).filter((k) => /^\d{14}$/.test(k)).sort();
  if (!keys.length) return null;
  if (exactKey && data[exactKey]) return data[exactKey];
  const candidates = exactKey ? keys.filter((k) => k <= exactKey) : keys;
  const key = candidates.length ? candidates[candidates.length - 1] : keys[keys.length - 1];
  return data[key] || null;
}

export async function fetchLatestTime() {
  const text = await fetchText(AMEDAS_LATEST_URL);
  const date = parseJst(text);
  if (!date) throw new Error("latest_time を解釈できませんでした");
  return date;
}

function stampFromLatest(latest) {
  const p = jstParts(latest);
  const ymd = `${p.year}${p.month}${p.day}`;
  const hhmm = `${p.hour}${p.minute}`;
  return {
    ymd,
    hhmm,
    exactKey: `${ymd}${hhmm}00`,
    mapStamp: `${ymd}${hhmm}00`,
    blockH: String(Math.floor(Number(p.hour) / 3) * 3).padStart(2, "0")
  };
}

async function fetchMap(stamp) {
  return fetchJson(AMEDAS_MAP_URL(stamp));
}

async function fetchPointObs(pointId, stamp) {
  const urls = [
    { url: AMEDAS_POINT_BLOCK_URL(pointId, stamp.ymd, stamp.blockH), block: true },
    { url: AMEDAS_POINT_URL(pointId, `${stamp.ymd}${stamp.hhmm}`), block: false }
  ];
  let lastErr = null;
  for (const entry of urls) {
    try {
      const data = await fetchJson(entry.url);
      const obs = entry.block ? pickPointBlockObs(data, stamp.exactKey) : data;
      if (obs) return obs;
    } catch (error) {
      lastErr = error;
    }
  }
  throw lastErr || new Error("地点データを取得できませんでした");
}

function readObservation(obs) {
  if (!obs) {
    return {
      temp: null,
      precipitation10m: null,
      precipitation1h: null,
      precipitation3h: null,
      precipitation24h: null,
      wind: null,
      windDirection: null
    };
  }
  return {
    temp: amedasField(obs.temp),
    precipitation10m: amedasField(obs.precipitation10m),
    precipitation1h: amedasField(obs.precipitation1h),
    precipitation3h: amedasField(obs.precipitation3h),
    precipitation24h: amedasField(obs.precipitation24h),
    wind: amedasField(obs.wind),
    windDirection: amedasField(obs.windDirection)
  };
}

function missingForContent(obs, contentId) {
  if (contentId === "amedas_temp") return obs.temp == null;
  if (contentId === "amedas_precip") {
    return obs.precipitation10m == null && obs.precipitation1h == null
      && obs.precipitation3h == null && obs.precipitation24h == null;
  }
  if (contentId === "amedas_wind") return obs.wind == null && obs.windDirection == null;
  return true;
}

function bundleFromMap(mapData, latest, point, nearby, contentId, fromCache = false) {
  const selectedObs = readObservation(mapData?.[point.id]);
  const stations = nearby.map((station) => ({
    station,
    obs: readObservation(mapData?.[station.id]),
    selected: station.id === point.id
  }));
  const ok = mapData != null;
  const selectedMissing = missingForContent(selectedObs, contentId);
  return {
    ok,
    fromCache,
    latestAt: latest,
    fetchedAt: new Date(),
    reportAt: latest,
    selected: {
      station: point,
      obs: selectedObs,
      missing: selectedMissing,
      wind: windDirectionInfo(selectedObs.windDirection)
    },
    stations,
    message: ok
      ? (selectedMissing ? "観測データなし" : "")
      : "気象データを取得できませんでした"
  };
}

export async function fetchAmedasBundle({ prefecture, contentId, point, nearby }) {
  const key = cacheKey(prefecture, contentId, point?.id);
  const run = async () => {
    try {
      const latest = await fetchLatestTime();
      const stamp = stampFromLatest(latest);
      const mapData = await fetchMap(stamp.mapStamp);
      let selectedRaw = mapData?.[point.id] || null;
      if (!selectedRaw || missingForContent(readObservation(selectedRaw), contentId)) {
        try {
          const pointObs = await fetchPointObs(point.id, stamp);
          if (pointObs) {
            mapData[point.id] = { ...(selectedRaw || {}), ...pointObs };
            selectedRaw = mapData[point.id];
          }
        } catch {
          /* 地点補完失敗時は map の値だけ使う。無い場合は欠測表示 */
        }
      }
      const bundle = bundleFromMap(mapData, latest, point, nearby, contentId, false);
      if (bundle.ok) saveLastGood(key, { latest: latest.toISOString(), mapData });
      return bundle;
    } catch (error) {
      const cached = loadLastGood(key);
      if (cached?.mapData) {
        const latest = parseJst(cached.latest) || null;
        const bundle = bundleFromMap(cached.mapData, latest, point, nearby, contentId, true);
        bundle.message = "更新待ち（前回データを表示）";
        return bundle;
      }
      return {
        ok: false,
        fromCache: false,
        latestAt: null,
        fetchedAt: new Date(),
        reportAt: null,
        selected: {
          station: point,
          obs: readObservation(null),
          missing: true,
          wind: windDirectionInfo(null)
        },
        stations: nearby.map((station) => ({
          station,
          obs: readObservation(null),
          selected: station.id === point.id
        })),
        message: "データ取得に失敗しました"
      };
    }
  };

  if (inFlight && inFlight.key === `${key}:${point?.id}`) return inFlight.promise;
  const promise = run().finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { key: `${key}:${point?.id}`, promise };
  return promise;
}

export function formatTemp(value) {
  if (value == null) return null;
  return Number(value).toFixed(1);
}

export function formatMm(value) {
  if (value == null) return null;
  return Number(value).toFixed(1);
}

export function formatWindMs(value) {
  if (value == null) return null;
  return Number(value).toFixed(1);
}
