import { getContent } from "./data/contents.js";
import { getPrefecture } from "./data/prefectures.js";
import { bindAutoFit, mountSignage, refreshDelayFor } from "./signage-view.js";
import { hydratePublished, settingsForSignage } from "./store.js";

window.addEventListener("error", () => {
  const boot = document.getElementById("boot-status");
  if (boot && document.documentElement.classList.contains("is-boot")) {
    boot.textContent = "画面を準備しています";
  }
});

const params = new URLSearchParams(location.search);
const prefecture = getPrefecture(params.get("prefecture") || params.get("pref") || "tokyo");
const content = getContent(params.get("content") || "amedas_temp");
const pointId = params.get("point") || "";

document.title = `${prefecture.name}｜${content.name}`;

const root = document.getElementById("app");
let session = null;
let fitOff = null;
let timer = 0;

async function start() {
  try {
    await hydratePublished();
  } catch {
    /* ファイルが無くてもデフォルトで表示する */
  }
  document.documentElement.classList.remove("is-boot");
  const published = settingsForSignage(prefecture.slug, content.id);
  session = await mountSignage(root, {
    prefecture: prefecture.slug,
    content: content.id,
    pointId: pointId || published.pointId
  });
  if (fitOff) fitOff();
  fitOff = bindAutoFit(session.els.screen, published.common?.resolution);
  schedule(published.common);
}

function schedule(common) {
  window.clearTimeout(timer);
  timer = window.setTimeout(async () => {
    if (session?.refresh) {
      try {
        await session.refresh();
      } catch {
        if (session?.els?.stamp) session.els.stamp.textContent = "更新待ち";
      }
    }
    schedule(common);
  }, refreshDelayFor(common));
}

start().catch(() => {
  document.documentElement.classList.remove("is-boot");
  root.innerHTML = `<article class="led-screen is-bg-sea"><div class="data-error">画面を表示できませんでした。再読み込みしてください。</div></article>`;
});
