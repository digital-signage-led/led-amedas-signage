import { formatMm } from "../services/amedas.js";
import { extrema, obsTable, rangeBlock, stationCaption, tableCell, timesBlock } from "./shared-ui.js";

export function renderPrecipitation(ctx, data) {
  const settings = ctx.contentSettings || {};
  const selected = data.selected;
  const obs = selected.obs;
  const unit = settings.showUnit === false ? "" : "mm";
  const unitCell = (value) => tableCell(value, formatMm, unit ? ` <small>${unit}</small>` : "");
  const ext = extrema(data.stations, (row) => row.obs.precipitation24h);

  ctx.els.panel.innerHTML = `
    <div class="panel-kicker">アメダス降水量</div>
    ${stationCaption(selected.station, settings.showStationName)}
    ${obsTable(
      ["期間", `降水量${unit ? `（${unit}）` : ""}`],
      [
        { selected: false, cells: ["10分", unitCell(obs.precipitation10m)] },
        { selected: false, cells: ["1時間", unitCell(obs.precipitation1h)] },
        { selected: false, cells: ["3時間", unitCell(obs.precipitation3h)] },
        { selected: false, cells: ["24時間", unitCell(obs.precipitation24h)] }
      ]
    )}
    ${rangeBlock(ext, formatMm, unit, { high: "県内最多（24時間）", low: "" })}
    ${timesBlock({
      dataUpdatedAt: data.reportAt,
      displayUpdatedAt: data.fetchedAt,
      fromCache: data.fromCache,
      message: data.message
    })}
  `;
  return data;
}
