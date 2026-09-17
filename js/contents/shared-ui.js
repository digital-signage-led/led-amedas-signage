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

export function tableCell(value, format, unit = "", tone = "") {
  if (value == null) return missText();
  const text = format ? format(value) : String(value);
  const inner = `${text}${unit}`;
  return tone ? `<span class="val-chip ${tone}">${inner}</span>` : inner;
}

export function tempTone(value) {
  if (value == null) return "";
  if (value < 0) return "t-sub";
  if (value < 5) return "t0";
  if (value < 10) return "t5";
  if (value < 15) return "t10";
  if (value < 20) return "t15";
  if (value < 25) return "t20";
  if (value < 30) return "t25";
  if (value < 35) return "t30";
  return "t35";
}

export function rainTone(value) {
  if (value == null) return "";
  if (value <= 0) return "r0";
  if (value < 1) return "r01";
  if (value < 5) return "r1";
  if (value < 10) return "r5";
  if (value < 20) return "r10";
  if (value < 30) return "r20";
  return "r30";
}

export function windTone(value) {
  if (value == null) return "";
  if (value < 5) return "w0";
  if (value < 10) return "w5";
  if (value < 15) return "w10";
  return "w15";
}

export function extrema(stations, pick) {
  let max = null;
  let min = null;
  for (const row of stations || []) {
    const value = pick(row);
    if (value == null || !Number.isFinite(Number(value))) continue;
    const item = { value: Number(value), name: row.station.name, id: row.station.id };
    if (!max || item.value > max.value) max = item;
    if (!min || item.value < min.value) min = item;
  }
  return { max, min };
}

function tagList(value, ext, highLabel, lowLabel) {
  if (value == null || !ext) return "";
  const tags = [];
  if (ext.max && value === ext.max.value) tags.push({ label: highLabel, kind: "max" });
  if (lowLabel && ext.min && value === ext.min.value && ext.min.value !== ext.max?.value) {
    tags.push({ label: lowLabel, kind: "min" });
  }
  return tags.map((tag) => `<span class="row-tag is-${tag.kind}">${tag.label}</span>`).join("");
}

export function rangeBlock(ext, format, unit = "", labels = { high: "県内最高", low: "県内最低" }) {
  if (!ext?.max) return "";
  const showMin = labels.low && ext.min && ext.min.value !== ext.max.value;
  return `
    <div class="obs-range">
      <div>
        <span>${labels.high}</span>
        <strong>${format(ext.max.value)}${unit}</strong>
        <em>${ext.max.name}</em>
      </div>
      ${showMin ? `
        <div>
          <span>${labels.low}</span>
          <strong>${format(ext.min.value)}${unit}</strong>
          <em>${ext.min.name}</em>
        </div>
      ` : ""}
    </div>
  `;
}

export function obsTable(headers, rows, extraClass = "") {
  return `
    <table class="obs-table ${extraClass}">
      <thead>
        <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr class="${row.selected ? "is-selected" : ""}" ${row.stationId ? `data-station="${row.stationId}"` : ""}>
            ${row.cells.map((cell, i) => `<t${i === 0 ? "h" : "d"} scope="${i === 0 ? "row" : "col"}">${cell}</t${i === 0 ? "h" : "d"}>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

export function stationRows(data, pickCells, nameExtra) {
  return (data.stations || []).map((row) => ({
    selected: !!row.selected,
    stationId: row.station.id,
    cells: [`${row.station.name}${nameExtra ? nameExtra(row) : ""}`, ...pickCells(row)]
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
    const ext = extrema(data.stations, (row) => row.obs.temp);
    return renderSplitTable(
      ["地点", showUnit ? "気温（℃）" : "気温"],
      stationRows(
        data,
        (row) => [tableCell(row.obs.temp, (v) => Number(v).toFixed(1), "", tempTone(row.obs.temp))],
        (row) => tagList(row.obs.temp, ext, "最高", "最低")
      )
    );
  }
  if (contentId === "amedas_precip") {
    const ext = extrema(data.stations, (row) => row.obs.precipitation24h);
    return renderSplitTable(
      ["地点", "10分", "1時間", "3時間", "24時間"],
      stationRows(
        data,
        (row) => [
          tableCell(row.obs.precipitation10m, (v) => Number(v).toFixed(1), "", rainTone(row.obs.precipitation10m)),
          tableCell(row.obs.precipitation1h, (v) => Number(v).toFixed(1), "", rainTone(row.obs.precipitation1h)),
          tableCell(row.obs.precipitation3h, (v) => Number(v).toFixed(1), "", rainTone(row.obs.precipitation3h)),
          `${tableCell(row.obs.precipitation24h, (v) => Number(v).toFixed(1), "", rainTone(row.obs.precipitation24h))}${tagList(row.obs.precipitation24h, ext, "最多", "")}`
        ]
      )
    );
  }
  const ext = extrema(data.stations, (row) => row.obs.wind);
  return renderSplitTable(
    ["地点", "風向", showUnit ? "風速（m/s）" : "風速"],
    stationRows(
      data,
      (row) => {
        const wind = windDirectionInfo(row.obs.windDirection);
        const dir = wind.calm ? "静穏" : (wind.label || missText());
        return [dir, tableCell(row.obs.wind, (v) => Number(v).toFixed(1), "", windTone(row.obs.wind))];
      },
      (row) => tagList(row.obs.wind, ext, "最強", "")
    )
  );
}

export function mapLabelFor(contentId, obs, wind) {
  if (contentId === "amedas_temp") {
    return obs.temp == null ? "" : Number(obs.temp).toFixed(1);
  }
  if (contentId === "amedas_precip") {
    const value = obs.precipitation1h ?? obs.precipitation10m ?? obs.precipitation24h;
    return value == null ? "" : Number(value).toFixed(1);
  }
  if (contentId === "amedas_wind") {
    if (obs.wind == null && !wind?.label) return "";
    const dir = wind?.calm ? "静穏" : (wind?.label || "");
    const spd = obs.wind == null ? "" : Number(obs.wind).toFixed(1);
    return [dir, spd].filter(Boolean).join(" ");
  }
  return "";
}

export function markerKind(contentId, obs) {
  if (contentId === "amedas_temp") return tempTone(obs.temp);
  if (contentId === "amedas_precip") return rainTone(obs.precipitation1h ?? obs.precipitation24h ?? obs.precipitation10m);
  return windTone(obs.wind);
}

export function mapMarkerRows(contentId, data, { national = false } = {}) {
  return (data.stations || []).map((row) => {
    const wind = windDirectionInfo(row.obs.windDirection);
    return {
      station: row.station,
      selected: !!row.selected,
      label: mapLabelFor(contentId, row.obs, wind),
      name: national ? (row.station.prefName || row.station.name) : row.station.name,
      showName: false,
      kind: markerKind(contentId, row.obs),
      arrowDeg: contentId === "amedas_wind" && !wind.calm ? wind.toDeg : null
    };
  });
}
