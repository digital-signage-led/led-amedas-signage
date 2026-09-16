import { formatClock, formatStamp } from "../services/jma-common.js";

export function timesBlock({ dataUpdatedAt, displayUpdatedAt, fromCache, message }) {
  return `
    <div class="time-grid">
      <div>
        <span class="k">観測時刻</span>
        <strong>${dataUpdatedAt ? formatStamp(dataUpdatedAt) : "更新待ち"}</strong>
      </div>
      <div>
        <span class="k">画面更新</span>
        <strong>${formatClock(displayUpdatedAt || new Date())}</strong>
      </div>
      ${fromCache ? `<div class="cache-note">前回取得データを表示</div>` : ""}
      ${message ? `<div class="cache-note">${message}</div>` : ""}
    </div>
  `;
}

export function missingBox(label) {
  return `
    <div class="obs-missing">
      <span>${label}</span>
      <strong>観測データなし</strong>
    </div>
  `;
}

export function loadingBox(label) {
  return `
    <div class="obs-missing">
      <span>${label}</span>
      <strong>データ取得中</strong>
    </div>
  `;
}

export function errorPanel(message) {
  return `<div class="data-error">${message || "気象データを取得できませんでした"}</div>`;
}

export function stationCaption(point, showName) {
  if (showName === false || !point) return "";
  return `<div class="obs-station">${point.name}<small>アメダス ${point.id}</small></div>`;
}

export function missText() {
  return `<span class="is-miss">観測データなし</span>`;
}

export function tableCell(value, format, unit = "") {
  if (value == null) return missText();
  const text = format ? format(value) : String(value);
  return `${text}${unit}`;
}

export function obsTable(headers, rows) {
  return `
    <table class="obs-table">
      <thead>
        <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr class="${row.selected ? "is-selected" : ""}">
            ${row.cells.map((cell, i) => `<t${i === 0 ? "h" : "d"} scope="${i === 0 ? "row" : "col"}">${cell}</t${i === 0 ? "h" : "d"}>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

export function stationRows(data, pickCells) {
  return (data.stations || []).slice(0, 10).map((row) => ({
    selected: !!row.selected,
    cells: [row.station.name, ...pickCells(row)]
  }));
}

export function mapLabelFor(contentId, obs, wind) {
  if (contentId === "amedas_temp") {
    return obs.temp == null ? "—" : `${Number(obs.temp).toFixed(1)}`;
  }
  if (contentId === "amedas_precip") {
    const value = obs.precipitation1h ?? obs.precipitation10m;
    return value == null ? "—" : `${Number(value).toFixed(1)}`;
  }
  if (contentId === "amedas_wind") {
    if (obs.wind == null && !wind?.label) return "—";
    const dir = wind?.calm ? "静穏" : (wind?.label || "");
    const spd = obs.wind == null ? "" : Number(obs.wind).toFixed(1);
    return [dir, spd].filter(Boolean).join(" ");
  }
  return "—";
}
