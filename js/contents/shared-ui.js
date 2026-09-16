import { windDirectionInfo } from "../services/amedas.js";
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

export function obsTable(headers, rows, extraClass = "") {
  return `
    <table class="obs-table ${extraClass}">
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
  return (data.stations || []).map((row) => ({
    selected: !!row.selected,
    cells: [row.station.name, ...pickCells(row)]
  }));
}

function tableClass(rowCount) {
  return rowCount > 12 ? "is-main is-compact" : "is-main";
}

function renderSplitTable(headers, rows) {
  const klass = tableClass(Math.ceil(rows.length / 2));
  if (rows.length <= 10) return obsTable(headers, rows, tableClass(rows.length));
  const mid = Math.ceil(rows.length / 2);
  return `<div class="table-split">${obsTable(headers, rows.slice(0, mid), klass)}${obsTable(headers, rows.slice(mid), klass)}</div>`;
}

export function mainStationTable(contentId, data, showUnit = true) {
  if (contentId === "amedas_temp") {
    return renderSplitTable(
      ["地点", showUnit ? "気温（℃）" : "気温"],
      stationRows(data, (row) => [tableCell(row.obs.temp, (v) => Number(v).toFixed(1))])
    );
  }
  if (contentId === "amedas_precip") {
    return renderSplitTable(
      ["地点", "10分", "1時間", "3時間", "24時間"],
      stationRows(data, (row) => [
        tableCell(row.obs.precipitation10m, (v) => Number(v).toFixed(1)),
        tableCell(row.obs.precipitation1h, (v) => Number(v).toFixed(1)),
        tableCell(row.obs.precipitation3h, (v) => Number(v).toFixed(1)),
        tableCell(row.obs.precipitation24h, (v) => Number(v).toFixed(1))
      ])
    );
  }
  return renderSplitTable(
    ["地点", "風向", showUnit ? "風速（m/s）" : "風速"],
    stationRows(data, (row) => {
      const wind = windDirectionInfo(row.obs.windDirection);
      const dir = wind.calm ? "静穏" : (wind.label || missText());
      return [dir, tableCell(row.obs.wind, (v) => Number(v).toFixed(1))];
    })
  );
}
