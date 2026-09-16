/** ⑤ 観測情報カテゴリ。URL の content= と一致させる。 */

export const CONTENTS = [
  {
    id: "amedas_temp",
    name: "アメダス気温",
    shortName: "気温",
    family: "amedas",
    unit: "℃",
    elemIndex: 2,
    refreshMs: 10 * 60 * 1000,
    description: "気象庁アメダスの最新気温です。"
  },
  {
    id: "amedas_precip",
    name: "アメダス降水量",
    shortName: "降水量",
    family: "amedas",
    unit: "mm",
    elemIndex: 0,
    refreshMs: 10 * 60 * 1000,
    description: "気象庁アメダスの降水量です。"
  },
  {
    id: "amedas_wind",
    name: "アメダス風向・風速",
    shortName: "風向風速",
    family: "amedas",
    unit: "m/s",
    elemIndex: 1,
    refreshMs: 10 * 60 * 1000,
    description: "気象庁アメダスの風向・風速です。"
  }
];

const ALIASES = {
  temp: "amedas_temp",
  temperature: "amedas_temp",
  amedas_temperature: "amedas_temp",
  気温: "amedas_temp",
  precip: "amedas_precip",
  precipitation: "amedas_precip",
  rain: "amedas_precip",
  降水量: "amedas_precip",
  wind: "amedas_wind",
  wind_dir: "amedas_wind",
  amedas_wind_dir: "amedas_wind",
  風向: "amedas_wind",
  風速: "amedas_wind"
};

export function getContent(id) {
  const key = ALIASES[String(id || "").toLowerCase()] || String(id || "");
  return CONTENTS.find((item) => item.id === key) || CONTENTS[0];
}

export function canonicalContent(id) {
  return getContent(id).id;
}
