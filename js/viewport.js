/** 天気予報・雨レーダーサイネージと同じ固定設計解像度。 */

export const FIXED_DESIGN = { width: 1920, height: 1080 };

export const RESOLUTIONS = {
  "1920x1080": { width: 1920, height: 1080 },
  "1280x720": { width: 1280, height: 720 },
  "3840x2160": { width: 3840, height: 2160 }
};

export function designSize(resolution = "1920x1080") {
  return RESOLUTIONS[resolution] || FIXED_DESIGN;
}

export function readWindowSize() {
  const w = window.innerWidth || document.documentElement.clientWidth || FIXED_DESIGN.width;
  const h = window.innerHeight || document.documentElement.clientHeight || FIXED_DESIGN.height;
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}

export function fitFixedScreen(element, designW = FIXED_DESIGN.width, designH = FIXED_DESIGN.height) {
  if (!element) return 1;
  const win = readWindowSize();
  const extra = Number(element.style.getPropertyValue("--display-scale") || element.dataset.displayScale || 1) || 1;
  const scale = Math.min(win.width / designW, win.height / designH) * extra;
  const ox = (win.width - designW * scale) / 2;
  const oy = (win.height - designH * scale) / 2;
  element.style.position = "absolute";
  element.style.left = "0";
  element.style.top = "0";
  element.style.width = `${designW}px`;
  element.style.height = `${designH}px`;
  element.style.transformOrigin = "0 0";
  element.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  element.style.setProperty("--fit-scale", String(scale));
  return scale;
}

export function applyDesignTokens(element, settings = {}) {
  if (!element) return;
  const common = settings.common || {};
  const content = settings.content || {};
  element.style.setProperty("--title-scale", String(common.titleSize ?? 1));
  element.style.setProperty("--title-x", `${common.titleX ?? 0}px`);
  element.style.setProperty("--title-y", `${common.titleY ?? 0}px`);
  element.style.setProperty("--map-scale", String(common.mapScale ?? 1));
  element.style.setProperty("--map-x", `${common.mapX ?? 0}px`);
  element.style.setProperty("--map-y", `${common.mapY ?? 0}px`);
  element.style.setProperty("--font-scale", String(common.fontSize ?? 1));
  element.style.setProperty("--number-scale", String(common.numberSize ?? content.valueSize ?? 1));
  element.style.setProperty("--panel-x", `${common.panelX ?? 0}px`);
  element.style.setProperty("--panel-y", `${common.panelY ?? 0}px`);
  element.style.setProperty("--pad-scale", String(common.padding ?? 1));
  element.style.setProperty("--display-scale", String(common.displayScale ?? 1));
  element.style.setProperty("--value-x", `${content.valueX ?? 0}px`);
  element.style.setProperty("--value-y", `${content.valueY ?? 0}px`);
  element.style.setProperty("--dir-x", `${content.dirX ?? 0}px`);
  element.style.setProperty("--dir-y", `${content.dirY ?? 0}px`);
  element.style.setProperty("--speed-x", `${content.speedX ?? 0}px`);
  element.style.setProperty("--speed-y", `${content.speedY ?? 0}px`);
  element.style.setProperty("--arrow-scale", String(content.arrowSize ?? 1));
  element.style.setProperty("--speed-scale", String(content.speedSize ?? 1));
  element.dataset.displayScale = String(common.displayScale ?? 1);
  element.dataset.bg = common.background || "sea";
  element.classList.remove("is-bg-sea", "is-bg-dark", "is-bg-white", "is-bg-night");
  element.classList.add(`is-bg-${common.background || "sea"}`);
}
