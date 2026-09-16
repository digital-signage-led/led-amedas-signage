# ⑤ 観測情報 サイネージ

47都道府県で使えるデジタルサイネージ用「観測情報」カテゴリです。

気温・降水量・風向風速は別HTMLに分けず、同じ画面と共通設定で切り替えます。

## コンテンツ

- アメダス気温 `amedas_temp`
- アメダス降水量 `amedas_precip`
- アメダス風向・風速 `amedas_wind`

## 公開URL

共通テンプレートは `index.html` のみです。都道府県とコンテンツはURLパラメータで切り替えます。後からデザインを直しても、このURLは変えません。

```
index.html?prefecture=tokyo&content=amedas_temp
index.html?prefecture=tokyo&content=amedas_precip
index.html?prefecture=tokyo&content=amedas_wind
```

141通り（47 × 3）を同じ画面で表示します。観測地点は管理画面の公開設定、または `point=` で指定します。

## 管理画面

`admin.html`

都道府県 → 観測地点 → コンテンツの順で選び、プレビュー、下書き保存、公開ができます。

## 解像度

1920×1080 固定デザイン（天気予報・雨レーダーサイネージと同じ）。指定解像度へ比率を維持して収めます。

## データ

- 取得元：気象庁 アメダス `https://www.jma.go.jp/bosai/amedas/`
- 地点表：`/bosai/amedas/const/amedastable.json`
- 最新時刻：`/bosai/amedas/data/latest_time.txt`
- 全国スナップショット：`/bosai/amedas/data/map/{yyyymmddHHMM00}.json`
- 更新：10分ごと（気象庁の10分値＋約90秒遅れ）。これより短い間隔では取りに行きません
- 欠測：0℃ / 0mm / 0m/s に置き換えず、「観測データなし」「更新待ち」を表示
- 地図：グレーの県境白地図＋青い海。道路地図は使わない

風向コードは気象庁の16方位（0=静穏、1=北北東 … 16=北）です。矢印は風が吹いていく方向を指します。

## ローカル

```
npm start
```

- サイネージ http://127.0.0.1:5175/
- 管理画面 http://127.0.0.1:5175/admin.html
