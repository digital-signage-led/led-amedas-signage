import { formatWindMs } from "../services/amedas.js";
import { missingBox, stationCaption, timesBlock } from "./shared-ui.js";

function arrowSvg(deg) {
  return `
    <svg class="wind-arrow" viewBox="0 0 120 120" aria-hidden="true" style="transform:rotate(${deg}deg)">
      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="3" opacity="0.28"/>
      <path d="M60 16 L78 78 L60 66 L42 78 Z" fill="currentColor"/>
    </svg>
  `;
}

export function renderWind(ctx, data) {
  const settings = ctx.contentSettings || {};
  const selected = data.selected;
  const obs = selected.obs;
  const wind = selected.wind;
  const speed = formatWindMs(obs.wind);
  const unit = settings.showUnit === false ? "" : "<small>m/s</small>";
  const dirText = wind.calm ? "静穏" : wind.label;
  const phrase = wind.calm ? "風はほとんどありません" : (dirText ? `${dirText}の風` : null);

  ctx.els.panel.innerHTML = `
    <div class="panel-kicker">アメダス風向・風速</div>
    ${stationCaption(selected.station, settings.showStationName)}
    <div class="wind-grid">
      <div class="wind-dir" style="transform:translate(var(--dir-x), var(--dir-y))">
        ${dirText == null ? missingBox("風向") : `
          <div class="wind-dir-name">${dirText}</div>
          <div class="wind-dir-phrase">${phrase}</div>
          ${wind.calm || wind.toDeg == null ? "" : `
            <div class="wind-arrow-wrap">${arrowSvg(wind.toDeg)}</div>
            <div class="wind-arrow-cap">矢印は風が吹いていく方向</div>
          `}
        `}
      </div>
      <div class="wind-speed" style="transform:translate(var(--speed-x), var(--speed-y))">
        ${speed == null ? missingBox("風速") : `<div class="obs-value is-wind">${speed}${unit}</div>`}
        <div class="obs-value-label">風速</div>
      </div>
    </div>
    ${timesBlock({
      dataUpdatedAt: data.reportAt,
      displayUpdatedAt: data.fetchedAt,
      fromCache: data.fromCache,
      message: data.message
    })}
  `;
  return data;
}
