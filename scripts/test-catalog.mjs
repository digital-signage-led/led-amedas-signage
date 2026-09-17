import assert from "node:assert/strict";
import { CONTENTS, canonicalContent } from "../js/data/contents.js";
import { AMEDAS_STATIONS, AMEDAS_STATION_META } from "../js/data/amedas-stations.js";
import { extrema, tempTone } from "../js/contents/shared-ui.js";
import { defaultPoint, pointsForPrefecture, tableStations } from "../js/data/observation-points.js";
import { PREFECTURES, SIGNAGE_AREAS, canonicalPrefecture, getPrefecture, prefectureFromAmedasId, regionOf } from "../js/data/prefectures.js";
import { windDirectionInfo } from "../js/services/amedas.js";

assert.equal(PREFECTURES.length, 47);
assert.equal(CONTENTS.length, 3);
assert.deepEqual(CONTENTS.map((c) => c.id), ["amedas_temp", "amedas_precip", "amedas_wind"]);
assert.equal(new Set(PREFECTURES.map((p) => p.slug)).size, 47);
assert.equal(AMEDAS_STATIONS.length, AMEDAS_STATION_META.count);
assert.ok(AMEDAS_STATIONS.length >= 1200, "official station table is incomplete");

for (const pref of PREFECTURES) {
  const points = pointsForPrefecture(pref.slug);
  assert.ok(points.length >= 1, `${pref.slug} has no official AMeDAS stations`);
  const def = defaultPoint(pref.slug);
  assert.ok(def, `${pref.slug} missing default point`);
  assert.equal(prefectureFromAmedasId(def.id), pref.slug);
  assert.ok(regionOf(pref.slug).id === pref.region);
  for (const content of CONTENTS) {
    assert.ok(pointsForPrefecture(pref.slug, content.id).length >= 1, `${pref.slug} ${content.id} empty`);
  }
}

assert.equal(canonicalPrefecture("TOKYO"), "tokyo");
assert.equal(canonicalContent("temp"), "amedas_temp");
assert.equal(canonicalContent("precipitation"), "amedas_precip");
assert.equal(canonicalContent("wind"), "amedas_wind");
assert.equal(PREFECTURES.length * CONTENTS.length, 141);
assert.equal(SIGNAGE_AREAS.length * CONTENTS.length, 144);
assert.equal(getPrefecture("japan").slug, "japan");
assert.equal(canonicalPrefecture("national"), "japan");
assert.equal(pointsForPrefecture("japan", "amedas_temp").length, 47);
assert.equal(defaultPoint("japan", "amedas_temp").prefName, "北海道");

const tokyo = defaultPoint("tokyo");
assert.equal(tokyo.id, "44132");
assert.equal(tokyo.name, "東京");
assert.equal(defaultPoint("osaka").id, "62078");
assert.equal(defaultPoint("aichi").id, "51106");
assert.equal(getPrefecture("hokkaido").defaultZoom, 6.5);
assert.equal(getPrefecture("toyama").defaultZoom, 9.4);
assert.equal(getPrefecture("toyama").zoomBoost, 0.9);

assert.equal(windDirectionInfo(0).label, "静穏");
assert.equal(windDirectionInfo(0).calm, true);
assert.equal(windDirectionInfo(1).label, "北北東");
assert.equal(windDirectionInfo(2).label, "北東");
assert.equal(windDirectionInfo(8).label, "南");
assert.equal(windDirectionInfo(16).label, "北");
assert.equal(windDirectionInfo(16).fromDeg, 0);
assert.equal(windDirectionInfo(16).toDeg, 180);
assert.equal(windDirectionInfo(2).fromDeg, 45);
assert.equal(windDirectionInfo(2).toDeg, 225);

const toyamaTable = tableStations("toyama", defaultPoint("toyama", "amedas_temp"), "amedas_temp", 36);
assert.ok(toyamaTable.points.length >= 8, "toyama table should list official stations");
assert.ok(toyamaTable.points.some((p) => p.id === defaultPoint("toyama").id));
const hokkaidoTable = tableStations("hokkaido", defaultPoint("hokkaido", "amedas_temp"), "amedas_temp", 36);
assert.equal(hokkaidoTable.points.length, 36);
assert.ok(hokkaidoTable.hidden > 0);

assert.equal(tempTone(-1), "t-sub");
assert.equal(tempTone(23.8), "t20");
assert.equal(tempTone(31), "t30");
const ext = extrema([
  { station: { id: "1", name: "A" }, obs: { temp: 20 } },
  { station: { id: "2", name: "B" }, obs: { temp: 24 } },
  { station: { id: "3", name: "C" }, obs: { temp: null } }
], (row) => row.obs.temp);
assert.equal(ext.max.name, "B");
assert.equal(ext.min.name, "A");

console.log(`catalog ok: 47 prefectures + japan, 3 contents, 144 URLs, ${AMEDAS_STATIONS.length} official stations`);
