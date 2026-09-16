/**
 * 気象庁公式 amedastable.json から観測地点マスターを生成する。
 * 架空地点は作らない。地点コードと名称は公式表のまま使う。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREFECTURES, prefectureFromAmedasId } from "../js/data/prefectures.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TABLE_URL = "https://www.jma.go.jp/bosai/amedas/const/amedastable.json";

const DEFAULT_NAMES = {
  hokkaido: "札幌",
  aomori: "青森",
  iwate: "盛岡",
  miyagi: "仙台",
  akita: "秋田",
  yamagata: "山形",
  fukushima: "福島",
  ibaraki: "水戸",
  tochigi: "宇都宮",
  gunma: "前橋",
  saitama: "熊谷",
  chiba: "銚子",
  tokyo: "東京",
  kanagawa: "横浜",
  niigata: "新潟",
  toyama: "富山",
  ishikawa: "金沢",
  fukui: "福井",
  yamanashi: "甲府",
  nagano: "長野",
  gifu: "岐阜",
  shizuoka: "静岡",
  aichi: "名古屋",
  mie: "津",
  shiga: "彦根",
  kyoto: "京都",
  osaka: "大阪",
  hyogo: "神戸",
  nara: "奈良",
  wakayama: "和歌山",
  tottori: "鳥取",
  shimane: "松江",
  okayama: "岡山",
  hiroshima: "広島",
  yamaguchi: "下関",
  tokushima: "徳島",
  kagawa: "高松",
  ehime: "松山",
  kochi: "高知",
  fukuoka: "福岡",
  saga: "佐賀",
  nagasaki: "長崎",
  kumamoto: "熊本",
  oita: "大分",
  miyazaki: "宮崎",
  kagoshima: "鹿児島",
  okinawa: "那覇"
};

function dmsToDeg(pair) {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const deg = Number(pair[0]);
  const min = Number(pair[1]);
  if (!Number.isFinite(deg) || !Number.isFinite(min)) return null;
  return deg + min / 60;
}

function hasElem(elems, index) {
  const ch = String(elems || "")[index];
  return Boolean(ch && ch !== "0");
}

function typeRank(type) {
  if (type === "A") return 1;
  if (type === "B") return 2;
  return 3;
}

const res = await fetch(TABLE_URL, { cache: "no-store" });
if (!res.ok) throw new Error(`amedastable HTTP ${res.status}`);
const table = await res.json();

const stations = [];
for (const [id, raw] of Object.entries(table)) {
  const prefecture = prefectureFromAmedasId(id);
  if (!prefecture) continue;
  const latitude = dmsToDeg(raw.lat);
  const longitude = dmsToDeg(raw.lon);
  if (latitude == null || longitude == null) continue;
  stations.push({
    id: String(id),
    name: raw.kjName,
    kana: raw.knName || "",
    prefecture,
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4)),
    alt: raw.alt ?? null,
    type: raw.type || "",
    elems: raw.elems || "",
    hasPrecip: hasElem(raw.elems, 0),
    hasWind: hasElem(raw.elems, 1),
    hasTemp: hasElem(raw.elems, 2),
    default: false
  });
}

const defaults = {};
for (const pref of PREFECTURES) {
  const list = stations.filter((s) => s.prefecture === pref.slug);
  const want = DEFAULT_NAMES[pref.slug];
  const named = list.find((s) => s.name === want && s.type === "A")
    || list.find((s) => s.name === want)
    || list.find((s) => s.type === "A")
    || list[0];
  if (!named) throw new Error(`no official station for ${pref.slug}`);
  named.default = true;
  defaults[pref.slug] = { id: named.id, name: named.name };
}

stations.sort((a, b) => a.id.localeCompare(b.id, "en"));

const payload = {
  source: TABLE_URL,
  fetchedAt: new Date().toISOString(),
  count: stations.length,
  defaults,
  stations
};

const jsonPath = path.join(root, "data", "amedas-stations.json");
const jsPath = path.join(root, "js", "data", "amedas-stations.js");
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(
  jsPath,
  `/** 気象庁公式 amedastable.json から生成。直接編集しない。 */\nexport const AMEDAS_STATION_META = ${JSON.stringify({
    source: payload.source,
    fetchedAt: payload.fetchedAt,
    count: payload.count,
    defaults: payload.defaults
  }, null, 2)};\nexport const AMEDAS_STATIONS = ${JSON.stringify(payload.stations)};\n`,
  "utf8"
);

console.log(`stations ${stations.length}`);
for (const pref of PREFECTURES) {
  const n = stations.filter((s) => s.prefecture === pref.slug).length;
  const d = defaults[pref.slug];
  console.log(`${pref.slug.padEnd(12)} ${String(n).padStart(3)} default ${d.id} ${d.name}`);
}
