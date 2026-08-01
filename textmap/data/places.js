// places.js -- 補助辞書: 島・地方名など行政区域データに載らない地名
// type: 'island' = 島 (ラベル+引き出し線), 'point' = 地点 (ドット),
//       'region' = 地方 (表示範囲の手がかり)

window.EXTRA_PLACES = [
  // --- 島 (南西諸島) ---
  { name: "奄美大島",   type: "island", lon: 129.35,  lat: 28.33 },
  { name: "喜界島",     type: "island", lon: 129.93,  lat: 28.32 },
  { name: "徳之島",     type: "island", lon: 128.96,  lat: 27.77 },
  { name: "沖永良部島", type: "island", lon: 128.55,  lat: 27.37 },
  { name: "与論島",     type: "island", lon: 128.42,  lat: 27.03 },
  { name: "沖縄本島",   type: "island", lon: 127.95,  lat: 26.50 },
  { name: "久米島",     type: "island", lon: 126.77,  lat: 26.34 },
  { name: "宮古島",     type: "island", lon: 125.28,  lat: 24.79 },
  { name: "伊良部島",   type: "island", lon: 125.16,  lat: 24.83 },
  { name: "多良間島",   type: "island", lon: 124.70,  lat: 24.66 },
  { name: "石垣島",     type: "island", lon: 124.17,  lat: 24.42 },
  { name: "竹富島",     type: "island", lon: 124.086, lat: 24.33 },
  { name: "小浜島",     type: "island", lon: 123.98,  lat: 24.35 },
  { name: "黒島",       type: "island", lon: 124.01,  lat: 24.24 },
  { name: "西表島",     type: "island", lon: 123.79,  lat: 24.33 },
  { name: "波照間島",   type: "island", lon: 123.78,  lat: 24.06 },
  { name: "与那国島",   type: "island", lon: 122.99,  lat: 24.45 },

  // --- 島 (その他全国) ---
  { name: "種子島",     type: "island", lon: 130.97,  lat: 30.60 },
  { name: "屋久島",     type: "island", lon: 130.50,  lat: 30.34 },
  { name: "佐渡島",     type: "island", lon: 138.35,  lat: 38.05 },
  { name: "淡路島",     type: "island", lon: 134.83,  lat: 34.35 },
  { name: "小豆島",     type: "island", lon: 134.28,  lat: 34.50 },
  { name: "対馬",       type: "island", lon: 129.33,  lat: 34.40 },
  { name: "壱岐島",     type: "island", lon: 129.70,  lat: 33.78 },
  { name: "隠岐諸島",   type: "island", lon: 133.25,  lat: 36.20 },
  { name: "五島列島",   type: "island", lon: 128.90,  lat: 32.80 },
  { name: "佐久島",     type: "island", lon: 137.04,  lat: 34.71 },

  // --- 地点 (行政名でない通称) ---
  { name: "東京",       type: "point",  lon: 139.767, lat: 35.681 },
];

// 地方名 → 都道府県コード or 表示範囲 (bbox = [lonMin, latMin, lonMax, latMax])
window.REGIONS = [
  { name: "日本全国",   bbox: [122.5, 24.0, 149.0, 45.8] },
  { name: "日本列島",   bbox: [122.5, 24.0, 149.0, 45.8] },
  { name: "全国",       bbox: [122.5, 24.0, 149.0, 45.8] },
  { name: "東北地方",   prefs: ["02","03","04","05","06","07"] },
  { name: "東北",       prefs: ["02","03","04","05","06","07"] },
  { name: "関東地方",   prefs: ["08","09","10","11","12","13","14"] },
  { name: "関東",       prefs: ["08","09","10","11","12","13","14"] },
  { name: "首都圏",     prefs: ["11","12","13","14"] },
  { name: "甲信越",     prefs: ["15","19","20"] },
  { name: "北陸",       prefs: ["16","17","18"] },
  { name: "東海",       prefs: ["21","22","23","24"] },
  { name: "中部地方",   prefs: ["15","16","17","18","19","20","21","22","23"] },
  { name: "近畿地方",   prefs: ["24","25","26","27","28","29","30"] },
  { name: "近畿",       prefs: ["24","25","26","27","28","29","30"] },
  { name: "関西",       prefs: ["25","26","27","28","29","30"] },
  { name: "中国地方",   prefs: ["31","32","33","34","35"] },
  { name: "山陰",       prefs: ["31","32"] },
  { name: "四国",       prefs: ["36","37","38","39"] },
  { name: "九州",       prefs: ["40","41","42","43","44","45","46"] },
  { name: "南西諸島",   bbox: [122.5, 23.8, 131.6, 30.9] },
  { name: "琉球列島",   bbox: [122.5, 23.8, 131.6, 30.9] },
  { name: "琉球諸島",   bbox: [122.5, 23.8, 131.6, 30.9] },
  { name: "奄美群島",   bbox: [128.2, 26.9, 130.2, 28.6] },
  { name: "沖縄諸島",   bbox: [126.6, 26.0, 128.4, 27.2] },
  { name: "宮古諸島",   bbox: [124.5, 24.4, 125.6, 25.1] },
  { name: "八重山諸島", bbox: [122.8, 23.9, 124.5, 24.8] },
];
