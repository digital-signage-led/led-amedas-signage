import { formatTemp } from "../services/amedas.js";
import { missingBox, stationCaption, timesBlock } from "./shared-ui.js";

export function renderTemperature(ctx, data) {
  const settings = ctx.contentSettings || {};
  const selected = data.selected;
  const obs = selected.obs;
  const value = formatTemp(obs.temp);
  const unit = settings.showUnit === false ? "" : "<small>℃</small>";

  ctx.els.panel.innerHTML = `
    <div class="panel-kicker">アメダス気温</div>
    ${stationCaption(selected.station, settings.showStationName)}
    <div class="obs-main" style="transform:translate(var(--value-x), var(--value-y))">
      ${value == null ? missingBox("気温") : `<div class="obs-value is-temp">${value}${unit}</div>`}
    </div>
    <div class="obs-note">遠距離から読み取れるよう、観測値のみを大きく表示しています。</div>
    ${timesBlock({
      dataUpdatedAt: data.reportAt,
      displayUpdatedAt: data.fetchedAt,
      fromCache: data.fromCache,
      message: data.message
    })}
  `;
  return data;
}
