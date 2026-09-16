/**
 * 観測地点マスター。気象庁公式地点表から生成した AMEDAS_STATIONS を正とする。
 * HTML へ地点名を並べない。都道府県と観測要素で絞り込む。
 */
import { AMEDAS_STATIONS, AMEDAS_STATION_META } from "./amedas-stations.js";
import { getContent } from "./contents.js";

export const OBSERVATION_POINTS = AMEDAS_STATIONS;
export const STATION_META = AMEDAS_STATION_META;

export function hasContentElement(point, contentId) {
  const content = getContent(contentId);
  if (content.id === "amedas_temp") return point.hasTemp;
  if (content.id === "amedas_precip") return point.hasPrecip;
  if (content.id === "amedas_wind") return point.hasWind;
  return true;
}

export function pointsForPrefecture(slug, contentId) {
  return OBSERVATION_POINTS
    .filter((item) => item.prefecture === slug)
    .filter((item) => !contentId || hasContentElement(item, contentId))
    .slice()
    .sort((a, b) => {
      if (a.default !== b.default) return a.default ? -1 : 1;
      const rank = (t) => (t === "A" ? 0 : t === "B" ? 1 : 2);
      const rd = rank(a.type) - rank(b.type);
      if (rd) return rd;
      return a.name.localeCompare(b.name, "ja");
    });
}

export function getPoint(id, prefectureSlug, contentId) {
  const list = prefectureSlug ? pointsForPrefecture(prefectureSlug, contentId) : OBSERVATION_POINTS;
  return list.find((item) => item.id === String(id || "")) || list[0] || null;
}

export function defaultPoint(prefectureSlug, contentId) {
  const list = pointsForPrefecture(prefectureSlug, contentId);
  return list.find((item) => item.default) || list[0] || null;
}

export function comboKey(prefectureSlug, contentId) {
  return `${prefectureSlug}:${contentId}`;
}

export function nearbyPoints(prefectureSlug, selected, contentId, limit = 18) {
  const list = pointsForPrefecture(prefectureSlug, contentId);
  if (!selected) return list.slice(0, limit);
  const scored = list
    .filter((item) => item.id !== selected.id)
    .map((item) => ({
      item,
      dist: (item.latitude - selected.latitude) ** 2 + (item.longitude - selected.longitude) ** 2,
      rank: item.type === "A" ? 0 : item.type === "B" ? 1 : 2
    }))
    .sort((a, b) => a.rank - b.rank || a.dist - b.dist);
  return [selected, ...scored.slice(0, Math.max(0, limit - 1)).map((row) => row.item)];
}
