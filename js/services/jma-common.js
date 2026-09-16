/** 気象庁 bosai API の共通処理。 */

export const JMA_ORIGIN = "https://www.jma.go.jp";
export const AMEDAS_LATEST_URL = `${JMA_ORIGIN}/bosai/amedas/data/latest_time.txt`;
export const AMEDAS_TABLE_URL = `${JMA_ORIGIN}/bosai/amedas/const/amedastable.json`;
export const AMEDAS_MAP_URL = (stamp) => `${JMA_ORIGIN}/bosai/amedas/data/map/${stamp}.json`;
export const AMEDAS_POINT_BLOCK_URL = (pointId, ymd, blockH) =>
  `${JMA_ORIGIN}/bosai/amedas/data/point/${pointId}/${ymd}_${blockH}.json`;
export const AMEDAS_POINT_URL = (pointId, ymdhhmm) =>
  `${JMA_ORIGIN}/bosai/amedas/data/point/${pointId}/${ymdhhmm}.json`;

export function formatStamp(date) {
  if (!date || Number.isNaN(date.getTime())) return "—";
  const week = "日月火水木金土"[date.getDay()];
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()}日(${week}) ${hh}:${mm}`;
}

export function formatClock(date) {
  if (!date || Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function parseJst(value) {
  if (!value) return null;
  let iso = String(value).trim();
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) iso = iso.replace(/\.\d+$/, "") + "+09:00";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function jstParts(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
}

export function nextAmedasRefreshDelay(refreshMinutes = 10) {
  const stepMin = Math.max(10, Number(refreshMinutes) || 10);
  const now = Date.now();
  const parts = jstParts(new Date(now));
  const nextSlot = Math.floor(Number(parts.minute) / 10) * 10 + 10;
  let target = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    nextSlot,
    90
  ) - 9 * 60 * 60 * 1000;
  while (target <= now) target += stepMin * 60 * 1000;
  return Math.max(30 * 1000, target - now);
}
