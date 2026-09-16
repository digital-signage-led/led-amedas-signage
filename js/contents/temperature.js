import { formatTemp } from "../services/amedas.js";
import { extrema, rangeBlock, stationCaption, timesBlock } from "./shared-ui.js";

export function renderTemperature(ctx, data) {
  const settings = ctx.contentSettings || {};
  const selected = data.selected;
  const value = formatTemp(selected.obs.temp);
  const unit = settings.showUnit === false ? "" : "℃";
  const ext = extrema(data.stations, (row) => row.obs.temp);

  ctx.els.panel.innerHTML = `
    <div class="panel-kicker">アメダス気温</div>
    ${stationCaption(selected.station, settings.showStationName)}
    <div class="obs-main" style="transform:translate(var(--value-x), var(--value-y))">
      ${value == null ? `<div class="obs-missing"><span>気温</span><strong>観測データなし</strong></div>` : `<div class="obs-value is-temp">${value}${unit ? `<small>${unit}</small>` : ""}</div>`}
    </div>
    ${rangeBlock(ext, (v) => Number(v).toFixed(1), unit)}
    ${timesBlock({
      dataUpdatedAt: data.reportAt,
      displayUpdatedAt: data.fetchedAt,
      fromCache: data.fromCache,
      message: data.message
    })}
  `;
  return data;
}
