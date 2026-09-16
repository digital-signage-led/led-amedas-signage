import { formatMm } from "../services/amedas.js";
import { missingBox, stationCaption, timesBlock } from "./shared-ui.js";

function row(label, value, unitOn) {
  if (value == null) {
    return `<div class="obs-sub"><span>${label}</span><strong>観測データなし</strong></div>`;
  }
  return `<div class="obs-sub"><span>${label}</span><strong>${formatMm(value)}${unitOn ? "<small>mm</small>" : ""}</strong></div>`;
}

export function renderPrecipitation(ctx, data) {
  const settings = ctx.contentSettings || {};
  const selected = data.selected;
  const obs = selected.obs;
  const primary = obs.precipitation1h ?? obs.precipitation10m;
  const unit = settings.showUnit === false ? "" : "<small>mm</small>";
  const hasAny = [
    obs.precipitation10m,
    obs.precipitation1h,
    obs.precipitation3h,
    obs.precipitation24h
  ].some((v) => v != null);

  ctx.els.panel.innerHTML = `
    <div class="panel-kicker">アメダス降水量</div>
    ${stationCaption(selected.station, settings.showStationName)}
    <div class="obs-main" style="transform:translate(var(--value-x), var(--value-y))">
      ${primary == null ? missingBox("降水量") : `<div class="obs-value is-rain">${formatMm(primary)}${unit}</div>`}
      ${primary != null ? `<div class="obs-value-label">${obs.precipitation1h != null ? "1時間降水量" : "10分降水量"}</div>` : ""}
    </div>
    <div class="obs-subs">
      ${row("10分", obs.precipitation10m, settings.showUnit !== false)}
      ${row("1時間", obs.precipitation1h, settings.showUnit !== false)}
      ${row("3時間", obs.precipitation3h, settings.showUnit !== false)}
      ${row("24時間", obs.precipitation24h, settings.showUnit !== false)}
    </div>
    ${!hasAny ? `<div class="obs-note">この地点の降水量は現在取得できません。</div>` : ""}
    ${timesBlock({
      dataUpdatedAt: data.reportAt,
      displayUpdatedAt: data.fetchedAt,
      fromCache: data.fromCache,
      message: data.message
    })}
  `;
  return data;
}
