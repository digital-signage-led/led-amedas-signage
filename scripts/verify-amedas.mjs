import assert from "node:assert/strict";
import { defaultPoint, nearbyPoints } from "../js/data/observation-points.js";
import {
  amedasField,
  fetchAmedasBundle,
  fetchLatestTime,
  formatMm,
  formatTemp,
  formatWindMs,
  windDirectionInfo
} from "../js/services/amedas.js";

const latest = await fetchLatestTime();
assert.ok(latest instanceof Date && !Number.isNaN(latest.getTime()));
console.log("latest_time", latest.toISOString());

const checks = [
  ["tokyo", "amedas_temp"],
  ["osaka", "amedas_precip"],
  ["aichi", "amedas_wind"]
];

for (const [pref, contentId] of checks) {
  const point = defaultPoint(pref, contentId);
  const nearby = nearbyPoints(pref, point, contentId, 8);
  const data = await fetchAmedasBundle({ prefecture: pref, contentId, point, nearby });
  assert.equal(data.selected.station.id, point.id);
  assert.ok(data.ok || data.fromCache, `${pref} ${contentId} fetch failed`);
  const obs = data.selected.obs;
  if (contentId === "amedas_temp") {
    if (obs.temp == null) console.log(`${pref} temp missing (not replaced with 0)`);
    else {
      assert.notEqual(formatTemp(obs.temp), null);
      console.log(`${pref} ${point.name} temp`, formatTemp(obs.temp), "C", "at", data.reportAt?.toISOString());
    }
  }
  if (contentId === "amedas_precip") {
    console.log(`${pref} ${point.name} precip10m`, obs.precipitation10m, "1h", obs.precipitation1h);
    if (obs.precipitation1h != null) assert.equal(formatMm(obs.precipitation1h), Number(obs.precipitation1h).toFixed(1));
  }
  if (contentId === "amedas_wind") {
    const wind = windDirectionInfo(obs.windDirection);
    console.log(`${pref} ${point.name} wind`, formatWindMs(obs.wind), "m/s", wind.label, "from", wind.fromDeg, "arrowTo", wind.toDeg);
    if (obs.windDirection === 0) assert.equal(wind.calm, true);
  }
}

assert.equal(amedasField(null), null);
assert.equal(amedasField([null, 0]), null);
assert.equal(amedasField(["", 0]), null);
assert.equal(amedasField([21.1, 0]), 21.1);
assert.equal(amedasField([0, 0]), 0);
assert.equal(amedasField([3.7, 4]), null);

console.log("amedas live verify ok");
