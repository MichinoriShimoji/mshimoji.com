/* app.js -- テクスト→地図ジェネレーター
 * 依存: data/japan_pref.js (PREF_TOPO), data/japan_muni.js (MUNI_TOPO),
 *       data/places.js (EXTRA_PLACES, REGIONS)
 * すべてクライアントサイドで完結 (file:// でも動作)
 */
"use strict";

/* ================= TopoJSON デコード ================= */

function decodeTopo(topo, objName) {
  // オブジェクト名はデータ再生成で変わりうるので、無ければ最初のキーを使う
  if (!objName || !topo.objects[objName]) objName = Object.keys(topo.objects)[0];
  const tr = topo.transform;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(p => {
      x += p[0]; y += p[1];
      return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]];
    });
  });
  const arcLine = i => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
  const ring = idxs => {
    let pts = [];
    idxs.forEach(i => {
      const line = arcLine(i);
      if (pts.length) pts.pop();
      pts = pts.concat(line);
    });
    return pts;
  };
  return topo.objects[objName].geometries.map(g => {
    let polys = [];
    if (g.type === "Polygon") polys = [g.arcs.map(ring)];
    else if (g.type === "MultiPolygon") polys = g.arcs.map(p => p.map(ring));
    return { props: g.properties || {}, polys };
  });
}

/* ================= 幾何ユーティリティ ================= */

function ringArea(r) {
  let a = 0;
  for (let i = 0, n = r.length - 1; i < n; i++)
    a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return a / 2;
}
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = r.length - 1; i < n; i++) {
    const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f;
  }
  a /= 2;
  return a === 0 ? r[0] : [cx / (6 * a), cy / (6 * a)];
}
function featCentroid(f) {
  let best = null, bestA = -1;
  f.polys.forEach(p => {
    const a = Math.abs(ringArea(p[0]));
    if (a > bestA) { bestA = a; best = p[0]; }
  });
  return ringCentroid(best);
}
function featArea(f) {
  return f.polys.reduce((s, p) => s + Math.abs(ringArea(p[0])), 0);
}
function bboxOf(f) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  f.polys.forEach(p => p[0].forEach(pt => {
    if (pt[0] < x0) x0 = pt[0]; if (pt[0] > x1) x1 = pt[0];
    if (pt[1] < y0) y0 = pt[1]; if (pt[1] > y1) y1 = pt[1];
  }));
  return [x0, y0, x1, y1];
}
// 本土 bbox: 最大ポリゴンの5%以上の面積の部分だけで bbox (遠隔離島で暴れないように)
function mainBbox(f) {
  let maxA = 0;
  f.polys.forEach(p => { const a = Math.abs(ringArea(p[0])); if (a > maxA) maxA = a; });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  f.polys.forEach(p => {
    if (Math.abs(ringArea(p[0])) < maxA * 0.05) return;
    p[0].forEach(pt => {
      if (pt[0] < x0) x0 = pt[0]; if (pt[0] > x1) x1 = pt[0];
      if (pt[1] < y0) y0 = pt[1]; if (pt[1] > y1) y1 = pt[1];
    });
  });
  return [x0, y0, x1, y1];
}
function mergeBbox(a, b) {
  if (!a) return b.slice();
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]),
          Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}
function bboxIntersects(a, b) {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}
function padBbox(b, frac, minSpan) {
  let dx = b[2] - b[0], dy = b[3] - b[1];
  let cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  dx = Math.max(dx * (1 + frac * 2), minSpan);
  dy = Math.max(dy * (1 + frac * 2), minSpan * 0.75);
  return [cx - dx / 2, cy - dy / 2, cx + dx / 2, cy + dy / 2];
}

/* ================= データ準備 ================= */

const PREF_NAMES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県",
  "石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県",
  "京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県",
  "山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県",
  "大分県","宮崎県","鹿児島県","沖縄県"];

const JAPAN_BBOX = [122.5, 24.0, 149.0, 45.8];

const prefFeats = decodeTopo(window.PREF_TOPO, "prefectures").map(f => {
  const name = f.props.N03_001;
  const code = String(PREF_NAMES.indexOf(name) + 1).padStart(2, "0");
  return { ...f, name, code, bbox: bboxOf(f), mbox: mainBbox(f) };
});
const prefByCode = {};
prefFeats.forEach(f => prefByCode[f.code] = f);

// N03-2024 の属性: 政令指定都市の区は N03_004=市名, N03_005=区名 (N03_003は空)。
// 郡部の町村は N03_003=郡名, N03_004=町村名。区は N03_005 を名前に、市名をグループに使う
const muniFeats = decodeTopo(window.MUNI_TOPO, "muni").map(f => ({
  ...f,
  pref: f.props.N03_001,
  group: f.props.N03_005 ? (f.props.N03_004 || "") : (f.props.N03_003 || ""),
  name: f.props.N03_005 || f.props.N03_004 || "",
  code: f.props.N03_007 || "",
})).filter(f => f.name && f.name !== "所属未定地");
muniFeats.forEach(f => {
  f.bbox = bboxOf(f);
  f.centroid = featCentroid(f);
  f.prefCode = f.code.slice(0, 2);
});

/* ================= 辞書構築 ================= */
// entry: {key, kind, cands:[...]}
// kind: pref | muni | city | island | point | region | chome (町字) | station (駅)

// 表記ゆれ正規化。マッチングはこの正規化形で行う。
// 変換はすべて1文字→1文字 (文字位置がずれない前提のコードがあるため、
// 多文字変換をここに足してはいけない)
// VARIANT_PAIRS: [ゆれ字, 正規形] の連続。前半は小書き・異体字、後半は旧字体→新字体
const VARIANT_PAIRS =
  // 小書き
  "ヶケヵカ" +
  // 異体字 (現行地名でも両表記が混在するもの)
  "﨑崎嵜崎髙高濵浜嶋島嶌島舘館冨富檜桧渕淵渊淵籠篭舩船邨村埜野凑湊亙亘萬万曾曽靑青蘆芦竃竈" +
  // 旧字体 (康熙体) → 新字体
  "亞亜惡悪壓圧圍囲醫医爲為壹壱稻稲飮飲隱隠榮栄營営衞衛驛駅圓円鹽塩應応櫻桜奧奥" +
  "橫横溫温假仮價価畫画會会壞壊懷懐繪絵擴拡學学嶽岳樂楽龜亀舊旧據拠峽峡狹狭鄕郷" +
  "曉暁區区驅駆勳勲徑径惠恵溪渓縣県劍剣險険顯顕驗験嚴厳恆恒鑛鉱號号國国濟済碎砕" +
  "齋斎劑剤雜雑產産參参慘惨棧桟贊賛殘残絲糸齒歯兒児濕湿實実舍舎寫写釋釈壽寿收収" +
  "從従澁渋獸獣縱縦燒焼條条狀状疊畳讓譲釀醸眞真盡尽圖図粹粋醉酔隨随髓髄數数樞枢" +
  "聲声靜静齊斉攝摂專専戰戦淺浅潛潜錢銭禪禅騷騒增増藏蔵臟臓屬属續続體体對対帶帯" +
  "滯滞臺台瀧滝擇択澤沢擔担單単膽胆團団彈弾斷断晝昼蟲虫鑄鋳廳庁聽聴鎭鎮遞逓鐵鉄" +
  "轉転傳伝黨党盜盗燈灯當当德徳獨独讀読屆届繩縄貳弐惱悩腦脳廢廃拜拝賣売麥麦發発" +
  "髮髪拔抜濱浜蠻蛮佛仏變変邊辺邉辺辨弁瓣弁辯弁步歩寶宝豐豊沒没滿満彌弥藥薬譯訳" +
  "豫予餘余與与譽誉搖揺樣様謠謡來来賴頼亂乱覽覧龍竜兩両獵猟綠緑淚涙壘塁勵励禮礼" +
  "靈霊齡齢戀恋爐炉勞労樓楼郞郎錄録灣湾廣広";
const VMAP = new Map();
for (let i = 0; i < VARIANT_PAIRS.length; i += 2)
  VMAP.set(VARIANT_PAIRS[i], VARIANT_PAIRS[i + 1]);
// 全角英数字→半角 (「ＪＲ東京総合病院」のような施設名表記に多い)
for (let i = 0; i < 26; i++) {
  VMAP.set(String.fromCharCode(0xFF21 + i), String.fromCharCode(65 + i));
  VMAP.set(String.fromCharCode(0xFF41 + i), String.fromCharCode(97 + i));
}
for (let i = 0; i < 10; i++)
  VMAP.set(String.fromCharCode(0xFF10 + i), String.fromCharCode(48 + i));

function norm(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) out += VMAP.get(s[i]) || s[i];
  return out;
}

const DICT = (() => {
  const map = new Map();
  const add = (key, kind, cand) => {
    if (!key || key.length < 2) return;
    const k = key + "\0" + kind;
    if (!map.has(k)) map.set(k, { key, kind, cands: [] });
    map.get(k).cands.push(cand);
  };

  prefFeats.forEach(f => {
    add(f.name, "pref", f);
    const bare = f.name.replace(/[都府県]$/, "");
    if (bare !== f.name) add(bare, "pref", f);
  });

  muniFeats.forEach(f => add(f.name, "muni", f));

  // 政令市・郡 (N03_003) の集約
  const groups = new Map();
  muniFeats.forEach(f => {
    if (!f.group) return;
    const k = f.pref + "\0" + f.group;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  });
  groups.forEach((members, k) => {
    const gname = k.split("\0")[1];
    let bbox = null, cx = 0, cy = 0, wsum = 0;
    members.forEach(m => {
      bbox = mergeBbox(bbox, m.bbox);
      const w = featArea(m);
      cx += m.centroid[0] * w; cy += m.centroid[1] * w; wsum += w;
    });
    add(gname, "city", {
      name: gname, members, bbox,
      centroid: [cx / wsum, cy / wsum],
      prefCode: members[0].prefCode,
    });
  });

  // 島・地点は muni (所属市町村コード) があれば文脈解決に使えるようにする
  const addPlace = p => add(p.name, p.type || "point", {
    ...p,
    muniCode: p.muni || null,
    prefCode: p.muni ? p.muni.slice(0, 2) : null,
  });
  window.EXTRA_PLACES.forEach(addPlace);
  (window.CUSTOM_PLACES || []).forEach(addPlace);
  window.REGIONS.forEach(r => add(r.name, "region", r));

  // 間切 (明治期の沖縄の行政区分)
  (window.MAGIRI || []).forEach(([name, muniCode, lon, lat]) => {
    add(name, "magiri", { name, lon, lat, muniCode, prefCode: "47" });
  });

  // 主要な自然地名 (places.js の GEO_CURATED, 1件に確定)
  (window.GEO_CURATED || []).forEach(([name, lon, lat, cls]) => {
    add(name, "geo", { name, lon, lat, muniCode: null, prefCode: null, cls });
  });

  // 追加の島辞書 (Wikidata由来, islands_ext.js)。手作り辞書 (places.js) が正で、
  // 同名キーが既にあればスキップする (竹富島などが曖昧化しないように)。
  // 3文字以上・「島」で終わる名前のみ収録済み (「大島」等の一般語は手作りのみ)
  {
    const taken0 = new Set([...map.values()].map(e => norm(e.key)));
    (window.ISLANDS_EXT || []).forEach(([name, muniCode, lon, lat]) => {
      if (taken0.has(norm(name))) return;
      add(name, "island", { name, lon, lat, muniCode: muniCode || null,
                            prefCode: muniCode ? muniCode.slice(0, 2) : null });
    });
  }

  // 自然地名辞書 (Wikidata由来, geo_ext.js: 山・湖・岬・峠・半島・平野・盆地)。
  // GEO_CURATED や他の地名と同名のものはスキップ (手作り・既存が常に優先)
  {
    const takenG = new Set([...map.values()].map(e => norm(e.key)));
    (window.GEO_EXT || []).forEach(([name, muniCode, lon, lat, cls]) => {
      if (takenG.has(norm(name))) return;
      add(name, "geo", { name, lon, lat, muniCode: muniCode || null,
                         prefCode: muniCode ? muniCode.slice(0, 2) : null, cls });
    });
  }

  // 町字 (大字レベル, Geolonia住所データ由来)
  // 一般語と同形で誤検出しやすい名前はストップワードとして除外
  // 実在の町字だが一般語として頻出し誤検出の害が大きいもの
  const CHOME_STOP = new Set(["一部", "離島", "本島", "海岸", "山地", "平野", "高原", "渡り",
                              "学校", "病院", "大学", "駅前"]);
  Object.entries(window.CHOME).forEach(([muniCode, arr]) => {
    arr.forEach(([name, lon, lat]) => {
      if (CHOME_STOP.has(name)) return;
      // 接頭の「字」「大字」は剥がしてキーにする (青森の「大字◯◯」、沖縄の「字◯◯」など)。
      // テクスト側は「字長浜」と書かれても中の「長浜」でマッチできる
      const stripped = name.replace(/^大?字/, "");
      const key = stripped.length >= 2 ? stripped : name;
      add(key, "chome", { name, lon, lat, muniCode, prefCode: muniCode.slice(0, 2) });
    });
  });

  // ランドマーク (学校・病院、landmarks.js)。cls は 大学/高校/病院 などの種別
  (window.LANDMARKS || []).forEach(([name, muniCode, lon, lat, cls]) => {
    const cand = { name, lon, lat, muniCode, prefCode: muniCode.slice(0, 2), cls };
    const keys = new Set([name]);
    // 「青森県立深浦高等学校」→「深浦高等学校」のような設置者接頭辞を
    // 剥がした形でも引けるようにする (剥がした残りが短すぎるものは除く:
    // 「横浜市立大学」→「大学」のような校名自体が短いケース)
    const stripped = name.replace(/^(国立|私立|公立)/, "")
                         .replace(/^[^\s]{1,6}?[都道府県市町村区]立/, "");
    // 「盛岡市立高等学校」のように固有名部分が無い校名では、剥がした残りが
    // 一般語になるので登録しない
    if (stripped !== name && stripped.length >= 4 &&
        !/^(高等学校|中学校|小学校|大学|短期大学|高等専門学校|病院)$/.test(stripped))
      keys.add(stripped);
    // 高等学校⇔高校 の表記ゆれキー
    [...keys].forEach(k => {
      if (/高等学校$/.test(k)) keys.add(k.replace(/高等学校$/, "高校"));
      else if (/高校$/.test(k)) keys.add(k.replace(/高校$/, "高等学校"));
    });
    keys.forEach(k => add(k, "landmark", cand));
  });

  // 鉄道路線 (rail.js)。cand.rails は window.RAIL の添字リスト
  const RAIL_STOP = new Set(["本線", "新幹線"]);   // 単独では一般的すぎる名前
  const railByName = new Map();
  (window.RAIL || []).forEach((r, idx) => {
    if (!railByName.has(r.n)) railByName.set(r.n, []);
    railByName.get(r.n).push(idx);
  });
  railByName.forEach((idxs, name) => {
    if (RAIL_STOP.has(name)) return;
    const cand = { name, rails: idxs };
    add(name, "rail", cand);
    // ◯◯本線⇔◯◯線 の表記ゆれキー (実在の別路線名は上書きしない)
    let alt = null;
    if (/本線$/.test(name)) alt = name.replace(/本線$/, "線");
    else if (/線$/.test(name) && !/(新幹線|本線)$/.test(name)) alt = name.replace(/線$/, "本線");
    if (alt && alt.length >= 3 && !railByName.has(alt)) add(alt, "rail", cand);
    // 「4号線(中央線)」のような併記名は括弧内でも引けるようにする
    const m = name.match(/[(（]([^)）]+)[)）]/);
    if (m && m[1].length >= 2 && !RAIL_STOP.has(m[1])) add(m[1], "rail", cand);
  });

  // 会社の通称 (「西武線」など、places.js の RAILCO)。
  // rail キーの後に登録する (同名衝突時は具体的な路線名を優先)
  (window.RAILCO || []).forEach(([alias, company]) => {
    add(alias, "railco", { name: alias, company });
  });

  // 駅: 正式名+「駅」は常に登録。lines は rail.js の添字 (乗り入れ路線)
  window.STATIONS.forEach(([name, muniCode, lon, lat, lines]) => {
    add(name + "駅", "station",
        { name: name + "駅", lon, lat, muniCode, prefCode: muniCode.slice(0, 2), lines: lines || [] });
  });
  // 駅名単独 (「恋ヶ窪」等) は、3文字以上かつ他の地名と衝突しない場合のみ登録
  // (「大学前」のような一般語の暴発と、市町村名等との二重マッチを防ぐ)
  const taken = new Set([...map.values()].map(e => norm(e.key)));
  window.STATIONS.forEach(([name, muniCode, lon, lat, lines]) => {
    if (name.length >= 3 && !taken.has(norm(name))) {
      add(name, "station", { name, lon, lat, muniCode, prefCode: muniCode.slice(0, 2), lines: lines || [] });
    }
  });

  // 旧市町村 (歴史的行政区域データセット由来、廃止された市区町村)。
  // 現存の地名キーと衝突する場合は現行を優先してスキップ
  const taken2 = new Set([...map.values()].map(e => norm(e.key)));
  (window.HIST_MUNI || []).forEach(([name, prefCode, lon, lat]) => {
    if (!taken2.has(norm(name))) {
      add(name, "hist", { name, lon, lat, muniCode: null, prefCode });
    }
  });

  // 方言形・現地語形エイリアス (places.js の ALIASES)。
  // 対象の正式地名を既存エントリから探し、その候補をエイリアス名で複製する
  const byNkey = new Map();
  map.forEach(e => {
    const k = norm(e.key);
    if (!byNkey.has(k)) byNkey.set(k, []);
    byNkey.get(k).push(e);
  });
  const ALIAS_PRIO = { muni: 9, city: 8, island: 7, hist: 6, magiri: 5,
                       point: 4, chome: 3, station: 2, region: 1, pref: 0 };
  (window.ALIASES || []).forEach(([alias, target]) => {
    const es = byNkey.get(norm(target));
    if (!es || !es.length || !alias || alias.length < 2) return;
    const best = es.slice().sort((a, b) =>
      (ALIAS_PRIO[b.kind] || 0) - (ALIAS_PRIO[a.kind] || 0))[0];
    const k = alias + " " + best.kind;
    if (!map.has(k))
      map.set(k, { key: alias, kind: best.kind, cands: best.cands, aliasOf: target });
  });

  return [...map.values()]
    .map(e => ({ ...e, nkey: norm(e.key) }))
    .sort((a, b) => b.key.length - a.key.length);
})();

/* ================= テクスト解析 ================= */

const DICT_BY_ID = new Map(DICT.map(e => [e.key + " " + e.kind, e]));
const KATA_ONLY = /^[ァ-ヶー]+$/;
const KATA_CH = /[ァ-ヶー]/;
const HIRA_ONLY = /^[ぁ-ゖー]+$/;
const HIRA_CH = /[ぁ-ゖー]/;

// accepted: 「もしかして」提案から採用された辞書ID ("key kind") の集合
function analyzeText(text, accepted = new Set()) {
  const ntext = norm(text);   // ヶ/ケ・旧字体などの表記ゆれを吸収してマッチング
  const claimed = [];
  const found = [];
  for (const e of DICT) {
    // かなだけの地名は、かな語の一部への誤マッチを防ぐため、前後が同じ
    // 文字種でないときだけ採用する (「またがる」の「たが」、カタカナ語中の
    // 方言形エイリアスなど)
    const kanaCh = KATA_ONLY.test(e.nkey) ? KATA_CH
                 : HIRA_ONLY.test(e.nkey) ? HIRA_CH : null;
    let idx = 0;
    const spans = [];
    while ((idx = ntext.indexOf(e.nkey, idx)) !== -1) {
      const end = idx + e.nkey.length;
      const okBoundary = !kanaCh ||
        (!(idx > 0 && kanaCh.test(ntext[idx - 1])) &&
         !(end < ntext.length && kanaCh.test(ntext[end])));
      if (okBoundary && !claimed.some(c => idx < c[1] && c[0] < end)) {
        claimed.push([idx, end]);
        spans.push([idx, end]);
      }
      idx = end;
    }
    if (spans.length) found.push({ ...e, spans, excluded: false, ambiguous: false });
  }

  // 「もしかして」から採用された地名を追加
  accepted.forEach(id => {
    const e = DICT_BY_ID.get(id);
    if (e && !found.some(f => f.key === e.key && f.kind === e.kind))
      found.push({ ...e, excluded: false, ambiguous: false, accepted: true });
  });

  // 文脈の都道府県コード (曖昧解決に使う)
  const ctx = new Set();
  found.forEach(e => {
    if (e.kind === "pref") ctx.add(e.cands[0].code);
    if (e.kind === "region" && e.cands[0].prefs) e.cands[0].prefs.forEach(c => ctx.add(c));
  });

  found.forEach(e => {
    if ((e.kind === "muni" || e.kind === "city") && e.cands.length > 1) {
      const inCtx = e.cands.filter(c => ctx.has(c.prefCode));
      if (inCtx.length >= 1) e.cands = inCtx;
      else { e.ambiguous = true; e.excluded = true; }
    }
  });

  // 政令市・郡の言及で、同名の区・町村を解決する (「仙台市青葉区」の青葉区は
  // 横浜市にもあるが、仙台市が出ていれば仙台市の区に絞れる)
  const cityMembers = new Set();
  found.forEach(e => {
    if (e.kind === "city" && !e.excluded)
      e.cands.forEach(c => c.members.forEach(m => cityMembers.add(m.code)));
  });
  found.forEach(e => {
    if (e.kind === "muni" && e.excluded && e.ambiguous) {
      const inCity = e.cands.filter(c => cityMembers.has(c.code));
      if (inCity.length >= 1) {
        e.cands = inCity;
        e.excluded = false;
        e.ambiguous = false;
      }
    }
  });

  // 文脈の市区町村コード (町字・駅の解決に使う)
  const ctxMuni = new Set();
  found.forEach(e => {
    if (e.excluded) return;
    if (e.kind === "muni") e.cands.forEach(c => ctxMuni.add(c.code));
    if (e.kind === "city") e.cands.forEach(c => c.members.forEach(m => ctxMuni.add(m.code)));
  });

  // 島・地点の曖昧解決を先に行い、その所属市町村も文脈に加える
  // (「伊良部島の佐和田」のように、島の言及で町字の同名候補を絞れるようにする)
  found.forEach(e => {
    if ((e.kind === "island" || e.kind === "point") && e.cands.length > 1) {
      let inCtx = e.cands.filter(c => ctxMuni.has(c.muniCode));
      if (!inCtx.length) inCtx = e.cands.filter(c => ctx.has(c.prefCode));
      if (inCtx.length >= 1) e.cands = inCtx;
      else { e.ambiguous = true; e.excluded = true; }
    }
  });
  found.forEach(e => {
    if (e.excluded) return;
    if (e.kind === "island" || e.kind === "point" || e.kind === "magiri")
      e.cands.forEach(c => { if (c.muniCode) ctxMuni.add(c.muniCode); });
  });

  // 同名ランドマークでも互いに近接していれば同一機関のキャンパス群とみなして
  // 全部残す (東京大学の本郷・駒場・柏など)。全国に散る同名校は曖昧扱いのまま
  found.forEach(e => {
    if (e.kind !== "landmark" || e.cands.length <= 1) return;
    let b = null;
    e.cands.forEach(c => { b = mergeBbox(b, [c.lon, c.lat, c.lon, c.lat]); });
    if (b[2] - b[0] < 0.6 && b[3] - b[1] < 0.6) e.campus = true;
  });

  // 町字・駅・旧市町村・間切・ランドマークの曖昧解決:
  // 市区町村 → 都道府県 の順で文脈を見る
  found.forEach(e => {
    if (e.campus) return;
    if (["chome", "station", "hist", "magiri", "landmark", "geo"].includes(e.kind) && e.cands.length > 1) {
      let inCtx = e.cands.filter(c => ctxMuni.has(c.muniCode));
      if (!inCtx.length) inCtx = e.cands.filter(c => ctx.has(c.prefCode));
      if (inCtx.length >= 1) e.cands = inCtx;
      else { e.ambiguous = true; e.excluded = true; }
    }
  });

  // 駅・ランドマークの言及も市区町村の文脈に加えて、曖昧のままの
  // 町字・旧市町村・間切を再試行する (「恋ヶ窪で下車…国分寺まで」の
  // 国分寺は、恋ヶ窪駅が国分寺市にあることから絞れる)
  found.forEach(e => {
    if (e.excluded) return;
    if ((e.kind === "station" || e.kind === "landmark") && e.cands.length === 1 && e.cands[0].muniCode)
      ctxMuni.add(e.cands[0].muniCode);
  });
  found.forEach(e => {
    if (["chome", "hist", "magiri"].includes(e.kind) && e.excluded && e.ambiguous) {
      const inCtx = e.cands.filter(c => ctxMuni.has(c.muniCode));
      if (inCtx.length >= 1) {
        e.cands = inCtx;
        e.excluded = false;
        e.ambiguous = false;
      }
    }
  });

  // それでも曖昧なままの町字が、文脈の市区町村にある駅名と一致するなら
  // 駅として拾い直す (「中央線で国分寺まで行き」の国分寺 = 国分寺駅)
  found.forEach(e => {
    if (e.kind !== "chome" || !e.excluded || !e.ambiguous) return;
    const st = DICT_BY_ID.get(e.key + "駅 station");
    if (!st) return;
    const inCtx = st.cands.filter(c => ctxMuni.has(c.muniCode));
    if (inCtx.length === 1) {
      e.kind = "station";
      e.cands = inCtx;
      e.excluded = false;
      e.ambiguous = false;
    }
  });

  // 市町村名・島名と同語幹の町字は、「〜方言」「〜弁」「〜語」のような
  // 言語名の複合語の中でだけマッチした場合に冗長とみなして除外する
  // (例: 「深浦町」言及時の「深浦方言」の深浦、「池間島」言及時の「池間方言」の池間。
  //  語幹が一致すれば町字の所在は問わない — 「五木方言」の五木が他県の同名町字に
  //  マッチして残るのを防ぐ)。単独で現れた場合 (「伊良部島の伊良部」など) は
  //  実在の集落への言及なので残す
  const muniStems = new Set();
  found.forEach(e => {
    if (e.kind === "muni" && !e.excluded)
      e.cands.forEach(c => muniStems.add(norm(c.name).replace(/[市町村区]$/, "")));
  });
  const islandStems = new Set();
  found.forEach(e => {
    if (e.kind === "island" && !e.excluded)
      islandStems.add(norm(e.key).replace(/島$/, ""));
  });
  found.forEach(e => {
    if (e.kind !== "chome" || e.excluded) return;
    const k = norm(e.key);
    if (!muniStems.has(k) && !islandStems.has(k)) return;
    const compoundOnly = (e.spans || []).every(([, end]) =>
      end < ntext.length && /[方弁語]/.test(ntext[end]));
    if (compoundOnly) e.excluded = true;
  });

  // 「〜方言」の複合語をまたいで切り出された町字を除外する
  // (「里方言」の「里方」が実在の町字にマッチする類。マッチ末尾が「方」で
  //  直後が「言」なら、テクスト上は「◯◯方言」の一部とみなす)
  found.forEach(e => {
    if (e.kind !== "chome" || e.excluded) return;
    if (!/方$/.test(norm(e.key))) return;
    const compoundOnly = (e.spans || []).every(([, end]) =>
      end < ntext.length && ntext[end] === "言");
    if (compoundOnly) e.excluded = true;
  });

  // 表示フラグ
  const flags = {
    prefBorder: /県境|府県境|都道府県.{0,3}境/.test(text),
    muniBorder: /市町村境|市区町村境|市町村.{0,2}境界|行政界/.test(text),
  };
  return { items: found, flags,
           suggestions: suggestNear(ntext, claimed, found, accepted) };
}

/* --- 「もしかして」候補 (編集距離1の近似マッチ) --- */

// 提案対象の種別と優先度。町字・駅は数が多くノイズになるため対象外
const SUGGEST_KINDS = { muni: 9, city: 8, island: 7, pref: 6, hist: 5, point: 4, region: 3 };
const SUGGEST_POOL = DICT.filter(e => SUGGEST_KINDS[e.kind] !== undefined && e.nkey.length >= 3);

// 編集距離が1以内か (置換・挿入・削除いずれか1回まで)
function withinDist1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  const n = Math.min(la, lb);
  while (i < n && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1);
  const [s, l] = la < lb ? [a, b] : [b, a];
  return s.slice(i) === l.slice(i + 1);
}

function suggestNear(ntext, claimed, found, accepted) {
  const foundIds = new Set(found.map(f => f.key + " " + f.kind));
  // 辞書にマッチしなかった漢字の連なりを候補トークンとして拾う
  const tokens = new Set();
  const re = /[㐀-鿿々]+/g;
  let m;
  while ((m = re.exec(ntext))) {
    const start = m.index, end = start + m[0].length;
    const cuts = claimed.filter(c => c[0] < end && start < c[1]).sort((x, y) => x[0] - y[0]);
    const segs = [];
    let cur = start;
    cuts.forEach(c => { if (c[0] > cur) segs.push([cur, c[0]]); cur = Math.max(cur, c[1]); });
    if (cur < end) segs.push([cur, end]);
    segs.forEach(([a, b]) => {
      const t = ntext.slice(a, b);
      // 3〜8文字。「〜語」「〜弁」「〜方言」など言語名らしい語尾は地名の
      // 誤記ではないので除く (琉球諸語→琉球諸島 のような誤提案を防ぐ)
      if (t.length >= 3 && t.length <= 8 && !/[語弁言]$/.test(t)) tokens.add(t);
    });
  }
  // 採用済みの提案に近いトークンは解決済みとみなし、次点候補を出し続けない
  const acceptedEntries = [...accepted].map(id => DICT_BY_ID.get(id)).filter(Boolean);
  const out = [];
  tokens.forEach(t => {
    if (acceptedEntries.some(e => withinDist1(t, e.nkey))) return;
    let best = null, bestScore = -1;
    for (const e of SUGGEST_POOL) {
      if (Math.abs(e.nkey.length - t.length) > 1) continue;
      if (!withinDist1(t, e.nkey)) continue;
      const id = e.key + " " + e.kind;
      if (foundIds.has(id) || accepted.has(id)) continue;
      const score = SUGGEST_KINDS[e.kind] * 10 + (e.nkey.length === t.length ? 5 : 0);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (best) out.push({ token: t, entry: best });
  });
  return out.slice(0, 6);
}

/* ================= 描画 ================= */

const C = {
  land: "#dcdcdc", landHi: "#c9c9c9", muniHi: "#9e9e9e",
  border: "#666", borderLight: "#999", ink: "#2b2b2b", grey: "#5a5a5a",
};
const FONT = "'Hiragino Sans','Noto Sans JP',sans-serif";

function makeProj(extent, w, h, pad) {
  const midLat = (extent[1] + extent[3]) / 2;
  const k = Math.cos(midLat * Math.PI / 180);
  const dx = (extent[2] - extent[0]) * k, dy = extent[3] - extent[1];
  const s = Math.min((w - 2 * pad) / dx, (h - 2 * pad) / dy);
  const ox = (w - s * dx) / 2, oy = (h - s * dy) / 2;
  return {
    x: lon => ox + (lon - extent[0]) * k * s,
    y: lat => oy + (extent[3] - lat) * s,
    s,
  };
}

function featPath(f, proj, extent) {
  let d = "";
  f.polys.forEach(rings => {
    // ポリゴンの外接矩形が表示範囲と交差しなければスキップ。
    // (「頂点が範囲内にあるか」で判定すると、大きなポリゴンの内部に
    //  深くズームしたとき頂点が1つも入らず陸地ごと消えることがある)
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (const pt of rings[0]) {
      if (pt[0] < bx0) bx0 = pt[0]; if (pt[0] > bx1) bx1 = pt[0];
      if (pt[1] < by0) by0 = pt[1]; if (pt[1] > by1) by1 = pt[1];
    }
    if (bx1 < extent[0] || bx0 > extent[2] || by1 < extent[1] || by0 > extent[3]) return;
    rings.forEach(r => {
      let rd = "", x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      r.forEach((pt, i) => {
        const x = proj.x(pt[0]), y = proj.y(pt[1]);
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        rd += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      });
      // 描画サイズが 1.5px 未満の極小リングは間引く (DOM 肥大化防止)
      if (x1 - x0 < 1.5 && y1 - y0 < 1.5) return;
      d += rd + "Z";
    });
  });
  return d;
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escA(s) {
  return esc(s).replace(/"/g, "&quot;");
}

// 引き出し線の端点。ラベル箱の近い側の横に付け、点が箱の中や至近なら消す
function leaderGeom(px, py, box) {
  const cy = (box[1] + box[3]) / 2;
  const anchorX = px < (box[0] + box[2]) / 2 ? box[0] - 3 : box[2] + 3;
  const show = Math.hypot(anchorX - px, cy - py) > 18 &&
               !(px >= box[0] - 4 && px <= box[2] + 4 && py >= box[1] - 4 && py <= box[3] + 4);
  return { x1: px, y1: py, x2: anchorX, y2: cy, show };
}

// ラベル配置 (簡易衝突回避): placed = [[x0,y0,x1,y1],...]
function placeLabel(px, py, textW, textH, placed, W, H) {
  const offs = [[14, -8], [14, 14], [-textW - 14, -8], [-textW - 14, 14],
                [14, -26], [-textW - 14, -26], [0, 24], [0, -30]];
  for (const [dx, dy] of offs) {
    const b = [px + dx, py + dy - textH, px + dx + textW, py + dy + 4];
    if (b[0] < 4 || b[1] < 4 || b[2] > W - 4 || b[3] > H - 4) continue;
    if (!placed.some(p => b[0] < p[2] && p[0] < b[2] && b[1] < p[3] && p[1] < b[3])) {
      placed.push(b);
      return { lx: px + dx, ly: py + dy, box: b };
    }
  }
  const b = [px + 14, py - 8 - textH, px + 14 + textW, py - 4];
  placed.push(b);
  return { lx: px + 14, ly: py - 8, box: b };
}

function renderMap(spec) {
  const { extent, items, flags, muniBorders, boxLabels } = spec;
  const mode = spec.annotMode || "full";   // full | dots | none
  const W = 820, H = 620, pad = 24;
  const proj = makeProj(extent, W, H, pad);
  // ズームが深いほど注釈を大きくする (範囲の度数から倍率を決定)
  const span = Math.max(extent[2] - extent[0], extent[3] - extent[1]);
  const zs = span < 0.15 ? 1.5 : span < 0.5 ? 1.35 : span < 2 ? 1.15 : 1;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`);
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`);

  const active = items.filter(i => !i.excluded);
  const hiPrefCodes = new Set();
  active.forEach(i => {
    if (i.kind === "pref") hiPrefCodes.add(i.cands[0].code);
  });

  // --- 都道府県ポリゴン (陸地) ---
  // DOM ノード数を抑えるため、通常/強調の2つの path に統合する
  const prefStroke = flags.prefBorder ? "#4a4a4a" : C.border;
  const prefSW = flags.prefBorder ? 1.1 : 0.7;
  let dLand = "", dLandHi = "";
  prefFeats.forEach(f => {
    if (!bboxIntersects(f.bbox, extent)) return;
    const d = featPath(f, proj, extent);
    if (!d) return;
    if (hiPrefCodes.has(f.code)) dLandHi += d; else dLand += d;
  });
  if (dLand) parts.push(`<path d="${dLand}" fill="${C.land}" stroke="${prefStroke}" stroke-width="${prefSW}" stroke-linejoin="round"/>`);
  if (dLandHi) parts.push(`<path d="${dLandHi}" fill="${C.landHi}" stroke="${prefStroke}" stroke-width="${prefSW}" stroke-linejoin="round"/>`);

  // --- 市区町村境界 (1本の path に統合) ---
  if (muniBorders) {
    let dMuni = "";
    muniFeats.forEach(f => {
      if (!bboxIntersects(f.bbox, extent)) return;
      dMuni += featPath(f, proj, extent);
    });
    if (dMuni) parts.push(`<path d="${dMuni}" fill="none" stroke="${C.borderLight}" stroke-width="${(0.45 * zs).toFixed(2)}" stroke-linejoin="round"/>`);
  }

  // --- 対象市町村の強調塗り (住所文脈の市区町村は強調しない) ---
  const info = contextInfo(items);
  const hiMunis = [];
  active.forEach(i => {
    if (i.kind === "muni")
      i.cands.forEach(c => { if (!info.ctxMuni.has(c.code)) hiMunis.push(c); });
    if (i.kind === "city")
      i.cands.forEach(c => {
        if (!isContextCity(c, info)) hiMunis.push(...c.members);
      });
  });
  hiMunis.forEach(f => {
    if (!bboxIntersects(f.bbox, extent)) return;
    const d = featPath(f, proj, extent);
    if (d) parts.push(`<path d="${d}" fill="${C.muniHi}" fill-opacity="0.55" stroke="#555" stroke-width="0.6" stroke-linejoin="round"/>`);
  });

  // --- 鉄道路線 ---
  // 路線名の言及 (rail) はその路線を描く。会社の通称 (railco, 「西武線」など) は、
  // 言及された駅を通るその会社の路線だけに絞る (「西武線で恋ヶ窪へ」→国分寺線)。
  // 駅から特定できないときはその会社の全路線 (表示範囲でクリップされる)
  const railIdx = new Set();
  active.forEach(i => {
    if (i.kind === "rail")
      i.cands.forEach(c => c.rails.forEach(x => railIdx.add(x)));
  });
  const railComps = [];
  active.forEach(i => { if (i.kind === "railco") railComps.push(i.cands[0].company); });
  if (railComps.length) {
    const stLines = new Set();
    active.forEach(i => {
      if (i.kind === "station")
        i.cands.forEach(c => (c.lines || []).forEach(x => stLines.add(x)));
    });
    railComps.forEach(comp => {
      let hit = false;
      stLines.forEach(x => { if (window.RAIL[x].c === comp) { railIdx.add(x); hit = true; } });
      if (!hit) window.RAIL.forEach((r, x) => { if (r.c === comp) railIdx.add(x); });
    });
  }
  const railLabelJobs = [];
  if (railIdx.size) {
    let dRail = "";
    railIdx.forEach(x => {
      const r = window.RAIL[x];
      const inPts = [];
      (r.s || []).forEach(seg => {
        let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
        seg.forEach(p => {
          if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0];
          if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1];
        });
        if (bx1 < extent[0] || bx0 > extent[2] || by1 < extent[1] || by0 > extent[3]) return;
        let d = "";
        seg.forEach((p, i) => {
          d += (i ? "L" : "M") + proj.x(p[0]).toFixed(1) + " " + proj.y(p[1]).toFixed(1);
          if (p[0] >= extent[0] && p[0] <= extent[2] && p[1] >= extent[1] && p[1] <= extent[3])
            inPts.push(p);
        });
        dRail += d;
      });
      if (inPts.length) {
        // ラベル位置の候補: 中点を第一候補に、線上の別の点も控えとして持つ
        const cand = [0.5, 0.3, 0.7, 0.15, 0.85].map(f =>
          inPts[Math.min(inPts.length - 1, Math.floor(inPts.length * f))]);
        railLabelJobs.push({ name: r.n,
          pts: cand.map(p => [proj.x(p[0]), proj.y(p[1])]) });
      }
    });
    if (dRail) {
      parts.push(`<path d="${dRail}" fill="none" stroke="white" stroke-width="${(3.2 * zs).toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>`);
      parts.push(`<path d="${dRail}" fill="none" stroke="#3d3d3d" stroke-width="${(1.4 * zs).toFixed(1)}" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${(7 * zs).toFixed(1)} ${(3.5 * zs).toFixed(1)}"/>`);
    }
  }

  // --- 地方の破線囲み (bbox 型の region のみ、注釈なしモードでは省略) ---
  if (mode !== "none") active.forEach(i => {
    if (i.kind !== "region" || !i.cands[0].bbox) return;
    const b = i.cands[0].bbox;
    const x = proj.x(b[0]), y = proj.y(b[3]);
    const w = proj.x(b[2]) - x, h = proj.y(b[1]) - y;
    if (w < 10 || h < 10 || w > W * 0.98) return;
    parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="18" fill="none" stroke="#4a4a4a" stroke-width="1.4" stroke-dasharray="9 6"/>`);
  });

  // --- ドット + ラベル ---
  const placed = [];
  const labelJobs = [];
  const regionJobs = [];
  active.forEach(i => {
    if (i.kind === "muni" || i.kind === "city") {
      i.cands.forEach(c => {
        // 住所文脈の市区町村はドット・ラベルを付けない
        if (i.kind === "muni" && info.ctxMuni.has(c.code)) return;
        if (i.kind === "city" && isContextCity(c, info)) return;
        const [lon, lat] = c.centroid;
        if (lon < extent[0] || lon > extent[2] || lat < extent[1] || lat > extent[3]) return;
        labelJobs.push({ name: i.key, px: proj.x(lon), py: proj.y(lat), dot: true, box: boxLabels });
      });
    } else if (["island", "point", "chome", "station", "hist", "magiri", "landmark", "geo"].includes(i.kind)) {
      i.cands.forEach(c => {
        if (c.lon < extent[0] || c.lon > extent[2] || c.lat < extent[1] || c.lat > extent[3]) return;
        labelJobs.push({ name: i.key, px: proj.x(c.lon), py: proj.y(c.lat), dot: i.kind !== "island", box: boxLabels });
      });
    } else if (i.kind === "region" && i.cands[0].bbox) {
      if (mode !== "full") return;
      const b = i.cands[0].bbox;
      const x = proj.x(b[0]), y = proj.y(b[3]);
      if (x > -50 && y > 10 && x < W)
        regionJobs.push({ name: i.key, x: x + 8, y: y - 8 });
    }
  });

  const fs = Math.round(13 * zs);       // ズーム倍率でラベル・ドットを拡大
  const dotR = 4.2 * zs;
  // 注釈は「正確なベース地図の上の編集レイヤー」。各注釈を g.ann に
  // まとめ、ラベル移動 (ドラッグ) とドット拡縮 (クリック) の調整値
  // (spec.edits, 案ごとに保持) を反映して描く
  const edits = spec.edits || {};
  const nameSeq = {};
  const dotHits = [];   // ラベルに覆われたドットもクリックできるよう最前面に置く透明ヒット円
  labelJobs.forEach(j => {
    const id = "p|" + j.name + "|" + (nameSeq[j.name] = (nameSeq[j.name] || 0) + 1);
    const ed = edits[id] || {};
    const dx = ed.dx || 0, dy = ed.dy || 0, rs = ed.r || 1;
    const mx = ed.mx || 0, my = ed.my || 0;   // ドットの移動量 (ドラッグ)
    const showDot = mode !== "none" && (j.dot || mode === "dots") && !ed.hideDot;
    const withLabel = mode === "full";
    if (!showDot && !withLabel) return;
    parts.push(`<g class="ann" data-id="${escA(id)}" data-px="${j.px.toFixed(1)}" data-py="${j.py.toFixed(1)}">`);
    if (showDot) {
      parts.push(`<circle class="dot" cx="${(j.px + mx).toFixed(1)}" cy="${(j.py + my).toFixed(1)}" r="${(dotR * rs).toFixed(1)}" data-r0="${dotR.toFixed(1)}" fill="#222" stroke="white" stroke-width="${(1.4 * zs).toFixed(1)}"/>`);
      dotHits.push({ id, x: j.px + mx, y: j.py + my, r: dotR * rs + 3 });
    }
    // ラベル文字はダブルクリックで編集可能 (ed.text)。空文字なら非表示
    const disp = ed.text != null ? ed.text : j.name;
    if (withLabel && disp !== "") {
      const textW = disp.length * fs + (j.box ? 14 : 4);
      const pos = placeLabel(j.px, j.py, textW, fs + (j.box ? 10 : 2), placed, W, H);
      const b = pos.box;
      // 引き出し線 (調整後のドット位置・ラベル位置から計算。近ければ非表示)
      const lg = leaderGeom(j.px + mx, j.py + my, [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]);
      parts.push(`<line class="lead" x1="${lg.x1.toFixed(1)}" y1="${lg.y1.toFixed(1)}" x2="${lg.x2.toFixed(1)}" y2="${lg.y2.toFixed(1)}" stroke="#777" stroke-width="${(0.8 * zs).toFixed(1)}"${lg.show ? "" : ' display="none"'}/>`);
      parts.push(`<g class="lblg" data-x0="${b[0].toFixed(1)}" data-y0="${b[1].toFixed(1)}" data-x1="${b[2].toFixed(1)}" data-y1="${b[3].toFixed(1)}" transform="translate(${dx.toFixed(1)},${dy.toFixed(1)})">`);
      if (j.box) {
        parts.push(`<rect x="${(pos.lx - 2).toFixed(1)}" y="${(pos.ly - fs - 4).toFixed(1)}" width="${textW}" height="${fs + 10}" rx="6" fill="white" stroke="#3a3a3a" stroke-width="1.1"/>`);
        parts.push(`<text x="${(pos.lx + 5).toFixed(1)}" y="${(pos.ly + 1).toFixed(1)}" font-size="${fs}" fill="${C.ink}">${esc(disp)}</text>`);
      } else {
        parts.push(`<text x="${pos.lx.toFixed(1)}" y="${pos.ly.toFixed(1)}" font-size="${fs}" fill="${C.ink}" stroke="white" stroke-width="3" paint-order="stroke">${esc(disp)}</text>`);
      }
      parts.push(`</g>`);
    }
    parts.push(`</g>`);
  });

  // --- 地方名ラベル (ドラッグ可能、引き出し線なし) ---
  const fsR = Math.round(14 * zs);
  regionJobs.forEach(j => {
    const id = "r|" + j.name;
    const ed = edits[id] || {};
    const dx = ed.dx || 0, dy = ed.dy || 0;
    const disp = ed.text != null ? ed.text : j.name;
    if (disp === "") return;
    const w = disp.length * fsR;
    parts.push(`<g class="ann" data-id="${escA(id)}">` +
      `<g class="lblg" data-x0="${j.x.toFixed(1)}" data-y0="${(j.y - fsR).toFixed(1)}" data-x1="${(j.x + w).toFixed(1)}" data-y1="${(j.y + 4).toFixed(1)}" transform="translate(${dx.toFixed(1)},${dy.toFixed(1)})">` +
      `<text x="${j.x.toFixed(1)}" y="${j.y.toFixed(1)}" font-size="${fsR}" fill="#4a4a4a">${esc(disp)}</text>` +
      `</g></g>`);
  });

  // --- 路線名ラベル (ドラッグ可能。表示範囲内の路線の中間点に置く) ---
  if (mode === "full" && railLabelJobs.length) {
    const fsL = Math.round(12 * zs);
    const seenRail = new Set();
    railLabelJobs.forEach(j => {
      if (seenRail.has(j.name)) return;
      seenRail.add(j.name);
      const id = "rl|" + j.name;
      const ed = edits[id] || {};
      const disp = ed.text != null ? ed.text : j.name;
      if (disp === "") return;
      const w = disp.length * fsL;
      // 他のラベルと重ならない位置を線上の候補点から選ぶ
      let px = null, py = null, box = null;
      for (const [cx, cy] of j.pts) {
        const b = [cx - w / 2, cy - fsL, cx + w / 2, cy + 4];
        if (b[0] < 4 || b[2] > W - 4 || b[1] < 4 || b[3] > H - 4) continue;
        if (placed.some(p => b[0] < p[2] && p[0] < b[2] && b[1] < p[3] && p[1] < b[3])) continue;
        px = cx; py = cy; box = b;
        break;
      }
      if (!box) return;
      placed.push(box);
      const dx = ed.dx || 0, dy = ed.dy || 0;
      parts.push(`<g class="ann" data-id="${escA(id)}">` +
        `<g class="lblg" data-x0="${box[0].toFixed(1)}" data-y0="${box[1].toFixed(1)}" data-x1="${box[2].toFixed(1)}" data-y1="${box[3].toFixed(1)}" transform="translate(${dx.toFixed(1)},${dy.toFixed(1)})">` +
        `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" font-size="${fsL}" fill="#4d4d4d" text-anchor="middle" stroke="white" stroke-width="3" paint-order="stroke">${esc(disp)}</text>` +
        `</g></g>`);
    });
  }

  // --- 周辺の市区町村名 (文脈ラベル) ---
  // ズームが深いときだけ、範囲内の市区町村名を控えめなグレーで表示する。
  // 面積の大きい順に最大12件。対象 (強調塗り) と重なるラベルは除外
  if (mode === "full" && muniBorders && span < 2.2) {
    const hiCodes = new Set(hiMunis.map(f => f.code));
    const fsC = Math.round(11 * zs);
    muniFeats
      .filter(f => !hiCodes.has(f.code) &&
        f.centroid[0] > extent[0] && f.centroid[0] < extent[2] &&
        f.centroid[1] > extent[1] && f.centroid[1] < extent[3])
      .sort((a, b) => featArea(b) - featArea(a))
      .slice(0, 12)
      .forEach(f => {
        const px = proj.x(f.centroid[0]), py = proj.y(f.centroid[1]);
        const w = f.name.length * fsC;
        const box = [px - w / 2, py - fsC, px + w / 2, py + 4];
        if (box[0] < 4 || box[2] > W - 4 || box[1] < 4 || box[3] > H - 4) return;
        if (placed.some(p => box[0] < p[2] && p[0] < box[2] && box[1] < p[3] && p[1] < box[3])) return;
        placed.push(box);
        const id = "c|" + f.code;
        const ed = edits[id] || {};
        const dx = ed.dx || 0, dy = ed.dy || 0;
        const disp = ed.text != null ? ed.text : f.name;
        if (disp === "") return;
        parts.push(`<g class="ann" data-id="${escA(id)}">` +
          `<g class="lblg" data-x0="${box[0].toFixed(1)}" data-y0="${box[1].toFixed(1)}" data-x1="${box[2].toFixed(1)}" data-y1="${box[3].toFixed(1)}" transform="translate(${dx.toFixed(1)},${dy.toFixed(1)})">` +
          `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" font-size="${fsC}" fill="#8f8f8f" text-anchor="middle" stroke="white" stroke-width="2.5" paint-order="stroke">${esc(disp)}</text>` +
          `</g></g>`);
      });
  }

  // --- ドットのヒット円 (透明・最前面。保存時は download() で除去) ---
  if (dotHits.length) {
    parts.push(`<g class="dotHits">` + dotHits.map(h =>
      `<circle class="dot-hit" data-for="${escA(h.id)}" cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="${h.r.toFixed(1)}" fill="#000" fill-opacity="0"/>`
    ).join("") + `</g>`);
  }

  // --- 方位記号 ---
  parts.push(`<line x1="34" y1="52" x2="34" y2="22" stroke="#333" stroke-width="1.6"/>`);
  parts.push(`<path d="M34 16 L29 27 L39 27 Z" fill="#333"/>`);
  parts.push(`<text x="34" y="70" font-size="13" fill="#333" text-anchor="middle">北</text>`);

  // --- クレジット (2行: 作図ツールのDOIとデータ出典) ---
  parts.push(`<text x="${W - 8}" y="${H - 19}" font-size="9" fill="#aaa" text-anchor="end">作図: テクスト→地図ジェネレーター (doi:10.5281/zenodo.21766019)</text>`);
  parts.push(`<text x="${W - 8}" y="${H - 8}" font-size="9" fill="#aaa" text-anchor="end">出典: 国土数値情報(N03,N02,P29,P04)を加工, Geolonia住所データ, 歴史的行政区域データセット(CODH)</text>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

/* ================= 3案の生成 ================= */

// 「住所の文脈」の市区町村コード集合を返す。
// 言及された町字・駅を含んでいる市区町村 (「福岡市博多区の御供所町」の
// 福岡市・博多区など) は所在を示す修飾とみなし、範囲計算や強調から外す
// 住所文脈の判定情報。
//   points:    言及された町字・駅を含む市区町村コード
//   mentioned: 言及された市区町村コード
//   ctxMuni:   文脈扱いにする市区町村 (町字・駅を含むもの)
// 郡・政令市 (city) は、言及された市町村・町字・駅をメンバーに含むなら
// 住所文脈 (「西津軽郡深浦町」の郡、「福岡市博多区」の市) → isContextCity で判定
function contextInfo(items) {
  const act = items.filter(i => !i.excluded);
  const points = new Set();
  act.forEach(i => {
    if (i.kind === "chome" || i.kind === "station" || i.kind === "landmark")
      i.cands.forEach(c => points.add(c.muniCode));
  });
  const mentioned = new Set();
  act.forEach(i => {
    if (i.kind === "muni") i.cands.forEach(c => mentioned.add(c.code));
  });
  const ctxMuni = new Set();
  act.forEach(i => {
    if (i.kind === "muni")
      i.cands.forEach(c => { if (points.has(c.code)) ctxMuni.add(c.code); });
  });
  return { points, mentioned, ctxMuni };
}

function isContextCity(cityCand, info) {
  return cityCand.members.some(m =>
    info.points.has(m.code) || info.mentioned.has(m.code));
}

// 表示範囲: 具体的な言及ほど優先する
//   第1層: 地方 (region) / 第2層: 市町村・町字・駅・島・地点 / 第3層: 都道府県
// 戻り値: {bbox, level}  level は "region" | "point" | "muni" | "pref"
// (level=point のときは呼び出し側でズーム下限を細かくする)
function targetExtent(items) {
  const act = items.filter(i => !i.excluded);
  let b = null;
  act.forEach(i => {
    if (i.kind === "region") {
      const r = i.cands[0];
      if (r.bbox) b = mergeBbox(b, r.bbox);
      else r.prefs.forEach(p => { if (prefByCode[p]) b = mergeBbox(b, prefByCode[p].mbox); });
    }
  });
  if (b) return { bbox: b, level: "region" };

  // 点的な地名 (町字・駅・ランドマークは狭い余白、島・地点は広め)
  let pts = null;
  act.forEach(i => {
    if (["chome", "station", "hist", "magiri", "landmark"].includes(i.kind)) {
      i.cands.forEach(c => {
        pts = mergeBbox(pts, [c.lon - 0.02, c.lat - 0.02, c.lon + 0.02, c.lat + 0.02]);
      });
    } else if (i.kind === "geo") {
      // 半島・平野・盆地は広がりのある地形なので余白を大きく取る
      i.cands.forEach(c => {
        const m = ["半島", "平野", "盆地", "湖"].includes(c.cls) ? 0.12 : 0.05;
        pts = mergeBbox(pts, [c.lon - m, c.lat - m, c.lon + m, c.lat + m]);
      });
    } else if (i.kind === "island" || i.kind === "point") {
      i.cands.forEach(c => {
        pts = mergeBbox(pts, [c.lon - 0.12, c.lat - 0.12, c.lon + 0.12, c.lat + 0.12]);
      });
    }
  });
  // 市区町村 (住所文脈のものは除く)
  const info = contextInfo(items);
  let mb = null;
  act.forEach(i => {
    if (i.kind === "muni") {
      i.cands.forEach(c => { if (!info.ctxMuni.has(c.code)) mb = mergeBbox(mb, c.bbox); });
    } else if (i.kind === "city") {
      i.cands.forEach(c => {
        if (!isContextCity(c, info)) mb = mergeBbox(mb, c.bbox);
      });
    }
  });
  if (pts && mb) return { bbox: mergeBbox(pts, mb), level: "muni" };
  if (pts) return { bbox: pts, level: "point" };
  if (mb) return { bbox: mb, level: "muni" };

  // 路線だけが言及された場合は、その路線の広がりを範囲にする
  let rb = null;
  act.forEach(i => {
    if (i.kind === "rail")
      i.cands.forEach(c => c.rails.forEach(x => { rb = mergeBbox(rb, railBbox(x)); }));
  });
  if (rb) return { bbox: rb, level: "muni" };

  act.forEach(i => {
    if (i.kind === "pref") b = mergeBbox(b, i.cands[0].mbox);
  });
  return b ? { bbox: b, level: "pref" } : null;
}

// 路線の外接矩形 (初回参照時に計算してキャッシュ)
const railBboxCache = new Map();
function railBbox(idx) {
  if (railBboxCache.has(idx)) return railBboxCache.get(idx);
  let b = null;
  ((window.RAIL[idx] || {}).s || []).forEach(seg => seg.forEach(p => {
    b = mergeBbox(b, [p[0], p[1], p[0], p[1]]);
  }));
  railBboxCache.set(idx, b || JAPAN_BBOX);
  return railBboxCache.get(idx);
}

function clampBbox(b, lim) {
  return [Math.max(b[0], lim[0]), Math.max(b[1], lim[1]),
          Math.min(b[2], lim[2]), Math.min(b[3], lim[3])];
}

function buildProposals(analysis) {
  const te = targetExtent(analysis.items);
  const t = te ? te.bbox : JAPAN_BBOX;
  const level = te ? te.level : "japan";
  const span = Math.max(t[2] - t[0], t[3] - t[1]);
  // 焦点が町字・駅などの「点」だけなら、ズーム下限を大幅に細かくする
  const floorStd = level === "point" ? 0.12 : 1.6;
  const floorDet = level === "point" ? 0.05 : 0.65;
  const wide = clampBbox(padBbox(t, 1.6, Math.max(span * 3.2, level === "point" ? 8 : 10)), JAPAN_BBOX);
  const std  = padBbox(t, 0.45, floorStd);
  const det  = padBbox(t, 0.22, floorDet);
  return [
    {
      id: "wide", title: "案1 広域",
      desc: "全体の中での位置づけを示す。都道府県レベルの輪郭のみ。",
      extent: wide, items: analysis.items, flags: analysis.flags,
      muniBorders: false, boxLabels: true,
    },
    {
      id: "std", title: "案2 標準",
      desc: "言及地域にズーム。県境と地名ラベルを表示。",
      extent: std, items: analysis.items, flags: analysis.flags,
      muniBorders: analysis.flags.muniBorder, boxLabels: false,
    },
    {
      id: "detail", title: "案3 詳細",
      desc: "さらにズームし、市区町村境界・周辺の地名・対象の強調塗りを表示。",
      extent: det, items: analysis.items,
      flags: { ...analysis.flags, prefBorder: true },
      muniBorders: true, boxLabels: false,
    },
  ];
}

/* ================= UI ================= */

const KIND_LABEL = { pref: "都道府県", muni: "市町村", city: "市・郡",
                     island: "島", point: "地点", region: "地方",
                     chome: "町字", station: "駅",
                     hist: "旧市町村", magiri: "間切",
                     rail: "路線", railco: "路線" };

// チップの種別表示。ランドマークは大学/高校/病院などの実種別を出す
function kindLabel(item) {
  if (item.kind === "landmark") return (item.cands[0] && item.cands[0].cls) || "施設";
  if (item.kind === "geo") return (item.cands[0] && item.cands[0].cls) || "自然地名";
  return KIND_LABEL[item.kind] || item.kind;
}

let currentAnalysis = null;
let currentText = "";
let acceptedSug = new Set();   // 採用済みの「もしかして」提案 ("key kind")
let annEdits = {};             // 注釈の手動調整 {specId: {annId: {dx,dy,r}}}
let zoomExt = {};              // 手動ズーム・パン後の表示範囲 {specId: extent}

function generate(updateHash = true) {
  const text = document.getElementById("inputText").value.trim();
  if (!text) return;
  if (text !== currentText) { acceptedSug = new Set(); annEdits = {}; zoomExt = {}; }
  currentText = text;
  currentAnalysis = analyzeText(text, acceptedSug);
  renderChips();
  renderProposals();
  // 共有用: テクストを URL ハッシュに保存 (リンクを開くと同じ地図を再現)
  if (updateHash) {
    history.replaceState(null, "", "#q=" + encodeURIComponent(text));
  }
}

function renderChips() {
  const el = document.getElementById("chips");
  el.innerHTML = "";
  const head = document.createElement("span");
  head.className = "note";
  head.textContent = currentAnalysis.items.length
    ? "検出された地名 (クリックで除外/復帰):"
    : "地名を検出できませんでした。都道府県名・市町村名・島名などを含むテクストを入力してください。";
  el.appendChild(head);
  currentAnalysis.items.forEach((item, idx) => {
    const c = document.createElement("button");
    c.className = "chip" + (item.excluded ? " off" : "") + (item.ambiguous ? " amb" : "");
    const alias = item.aliasOf ? "=" + esc(item.aliasOf) + "・" : "";
    c.innerHTML = `${esc(item.key)}<small>${alias}${kindLabel(item)}${item.ambiguous ? "・曖昧" : ""}</small>`;
    if (item.ambiguous)
      c.title = "同名の自治体が複数あるため既定では除外。クリックで全候補を表示します。";
    c.onclick = () => {
      item.excluded = !item.excluded;
      renderChips();
      renderProposals();
    };
    el.appendChild(c);
  });

  // 「もしかして」提案 (未マッチの語に綴りが近い地名)
  (currentAnalysis.suggestions || []).forEach(sg => {
    const c = document.createElement("button");
    c.className = "chip sug";
    c.innerHTML = `${esc(sg.entry.key)}<small>もしかして←${esc(sg.token)}</small>`;
    c.title = `「${sg.token}」は「${sg.entry.key}」かもしれません。クリックで地図に追加します。`;
    c.onclick = () => acceptSuggestion(sg.entry);
    el.appendChild(c);
  });
}

// 提案を採用して再解析する。ユーザーがチップで切り替えた除外状態は引き継ぐ
function acceptSuggestion(entry) {
  acceptedSug.add(entry.key + " " + entry.kind);
  const prev = new Map(currentAnalysis.items.map(i => [i.key + " " + i.kind, i.excluded]));
  currentAnalysis = analyzeText(currentText, acceptedSug);
  currentAnalysis.items.forEach(i => {
    const p = prev.get(i.key + " " + i.kind);
    if (p !== undefined) i.excluded = p;
  });
  renderChips();
  renderProposals();
}

function renderProposals() {
  const grid = document.getElementById("results");
  grid.innerHTML = "";
  document.getElementById("editGuide").hidden = false;
  buildProposals(currentAnalysis).forEach(spec => {
    spec.edits = annEdits[spec.id] || (annEdits[spec.id] = {});
    const defaultExtent = spec.extent;
    if (zoomExt[spec.id]) spec.extent = zoomExt[spec.id];
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="cardHead"><b>${spec.title}</b><span>${spec.desc}</span>
        <span class="zoomCtl">
          <button class="zi" title="拡大 (ホイールでも)">＋</button>
          <button class="zo" title="縮小 (ホイールでも)">−</button>
          <button class="zr" title="自動で決めた表示範囲に戻す">範囲リセット</button>
        </span></div>
      <div class="mapBox"></div>
      <div class="btns">
        <button class="dl" data-fmt="svg">SVG保存</button>
        <button class="dl" data-fmt="png">PNG保存</button>
        <button class="clr" title="この案のラベルと点をすべて消して白地図にする (「編集をリセット」で戻せます)">注釈を全部消す</button>
        <button class="rst" title="この案の移動・拡縮・文字編集・削除をすべて元に戻す">編集をリセット</button>
      </div>`;
    const box = card.querySelector(".mapBox");
    // この案だけを再描画する (ズーム・パン時に使う)。注釈の編集値は再適用される
    const rerender = () => {
      box.innerHTML = renderMap(spec);
      attachAnnotEdit(box.querySelector("svg"), spec);
    };
    rerender();
    attachZoomPan(box, spec, rerender);
    // 保存は編集後の現在の状態を書き出す
    card.querySelectorAll(".dl").forEach(btn => {
      btn.onclick = () => download(box.querySelector("svg").outerHTML, spec.id, btn.dataset.fmt);
    });
    // ズーム操作
    card.querySelector(".zi").onclick = () => zoomBy(spec, 1 / 1.5, null, rerender);
    card.querySelector(".zo").onclick = () => zoomBy(spec, 1.5, null, rerender);
    card.querySelector(".zr").onclick = () => {
      delete zoomExt[spec.id];
      spec.extent = defaultExtent;
      rerender();
    };
    // 一括編集: この案の全注釈 (ラベル・ドット) を消して白地図にする
    card.querySelector(".clr").onclick = () => {
      box.querySelectorAll("g.ann").forEach(g => {
        const ed = spec.edits[g.dataset.id] || (spec.edits[g.dataset.id] = {});
        ed.text = "";
        ed.hideDot = true;
      });
      renderProposals();
    };
    // この案の手動調整 (移動・拡縮・文字編集・削除) をすべて元に戻す
    card.querySelector(".rst").onclick = () => {
      annEdits[spec.id] = {};
      renderProposals();
    };
    grid.appendChild(card);
  });
}

/* --- ズーム・パン: 表示範囲 (extent) を操作して再描画する --- */

const ZOOM_MIN_SPAN = 0.015, ZOOM_MAX_SPAN = 45;

// factor<1 で拡大、>1 で縮小。anchor ([lon,lat]) を支点に伸縮する (nullなら中心)
function zoomBy(spec, factor, anchor, rerender) {
  const e = spec.extent;
  const maxSpan = Math.max(e[2] - e[0], e[3] - e[1]);
  let f = factor;
  if (maxSpan * f < ZOOM_MIN_SPAN) f = ZOOM_MIN_SPAN / maxSpan;
  if (maxSpan * f > ZOOM_MAX_SPAN) f = ZOOM_MAX_SPAN / maxSpan;
  const ax = anchor ? anchor[0] : (e[0] + e[2]) / 2;
  const ay = anchor ? anchor[1] : (e[1] + e[3]) / 2;
  const ne = [ax - (ax - e[0]) * f, ay - (ay - e[1]) * f,
              ax + (e[2] - ax) * f, ay + (e[3] - ay) * f];
  zoomExt[spec.id] = ne;
  spec.extent = ne;
  rerender();
}

// makeProj と同じ計算で、クライアント座標 → 経緯度
function clientToLonLat(rect, extent, cx, cy) {
  const W = 820, H = 620, pad = 24;
  const vx = (cx - rect.left) * W / rect.width;
  const vy = (cy - rect.top) * H / rect.height;
  const midLat = (extent[1] + extent[3]) / 2;
  const k = Math.cos(midLat * Math.PI / 180);
  const dx = (extent[2] - extent[0]) * k, dy = extent[3] - extent[1];
  const s = Math.min((W - 2 * pad) / dx, (H - 2 * pad) / dy);
  const ox = (W - s * dx) / 2, oy = (H - s * dy) / 2;
  return [extent[0] + (vx - ox) / (s * k), extent[3] - (vy - oy) / s];
}

// mapBox (再描画してもDOMが残る親) にホイールズームと背景ドラッグのパンを付ける
function attachZoomPan(box, spec, rerender) {
  box.addEventListener("wheel", e => {
    e.preventDefault();
    const anchor = clientToLonLat(box.getBoundingClientRect(), spec.extent, e.clientX, e.clientY);
    zoomBy(spec, e.deltaY > 0 ? 1.3 : 1 / 1.3, anchor, rerender);
  }, { passive: false });

  let pan = null, raf = 0;
  box.addEventListener("pointerdown", e => {
    // ラベル・ドットの操作は妨げない (それらは自身のハンドラで処理)
    if (e.target.closest(".lblg") || e.target.closest(".dot-hit")) return;
    if (e.button !== 0) return;
    e.preventDefault();
    pan = { x: e.clientX, y: e.clientY, ext: spec.extent.slice() };
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener("pointermove", e => {
    if (!pan) return;
    const rect = box.getBoundingClientRect();
    const W = 820, H = 620, pad = 24;
    const midLat = (pan.ext[1] + pan.ext[3]) / 2;
    const k = Math.cos(midLat * Math.PI / 180);
    const dx = (pan.ext[2] - pan.ext[0]) * k, dy = pan.ext[3] - pan.ext[1];
    const s = Math.min((W - 2 * pad) / dx, (H - 2 * pad) / dy);
    const dLon = (e.clientX - pan.x) * (W / rect.width) / (s * k);
    const dLat = (e.clientY - pan.y) * (H / rect.height) / s;
    const ne = [pan.ext[0] - dLon, pan.ext[1] + dLat, pan.ext[2] - dLon, pan.ext[3] + dLat];
    zoomExt[spec.id] = ne;
    spec.extent = ne;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; rerender(); });
  });
  const endPan = () => { pan = null; };
  box.addEventListener("pointerup", endPan);
  box.addEventListener("pointercancel", endPan);
}

/* --- 注釈の手動調整: ラベルはドラッグで移動、ドットはクリックで拡縮 --- */
function attachAnnotEdit(svg, spec) {
  const edits = spec.edits;
  const pt = svg.createSVGPoint();
  const toSvg = e => {
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  svg.querySelectorAll("g.ann").forEach(g => {
    const id = g.dataset.id;
    const ed = edits[id] || (edits[id] = {});
    const lblg = g.querySelector(".lblg");
    const lead = g.querySelector(".lead");
    const dot = g.querySelector(".dot");
    const px = parseFloat(g.dataset.px), py = parseFloat(g.dataset.py);

    const updateLeader = () => {
      if (!lead || !lblg) return;
      const dx = ed.dx || 0, dy = ed.dy || 0;
      const d = lblg.dataset;
      // ドットが動かされていれば (ed.mx/my) その位置から引く
      const lg = leaderGeom(px + (ed.mx || 0), py + (ed.my || 0),
                            [+d.x0 + dx, +d.y0 + dy, +d.x1 + dx, +d.y1 + dy]);
      lead.setAttribute("x1", lg.x1.toFixed(1));
      lead.setAttribute("y1", lg.y1.toFixed(1));
      lead.setAttribute("x2", lg.x2.toFixed(1));
      lead.setAttribute("y2", lg.y2.toFixed(1));
      if (lg.show) lead.removeAttribute("display");
      else lead.setAttribute("display", "none");
    };

    if (lblg) {
      let drag = null;
      lblg.addEventListener("pointerdown", e => {
        e.preventDefault();
        drag = { start: toSvg(e), dx0: ed.dx || 0, dy0: ed.dy || 0 };
        lblg.setPointerCapture(e.pointerId);
      });
      lblg.addEventListener("pointermove", e => {
        if (!drag) return;
        const p = toSvg(e);
        ed.dx = drag.dx0 + p.x - drag.start.x;
        ed.dy = drag.dy0 + p.y - drag.start.y;
        lblg.setAttribute("transform", `translate(${ed.dx.toFixed(1)},${ed.dy.toFixed(1)})`);
        updateLeader();
      });
      const end = () => { drag = null; };
      lblg.addEventListener("pointerup", end);
      lblg.addEventListener("pointercancel", end);
      // ダブルクリック: ラベル文字の編集 (空欄で非表示)。⌥+ダブルクリックで位置リセット
      lblg.addEventListener("dblclick", e => {
        if (e.altKey) {
          ed.dx = 0; ed.dy = 0;
          lblg.setAttribute("transform", "translate(0,0)");
          updateLeader();
          return;
        }
        const t = lblg.querySelector("text");
        const cur = ed.text != null ? ed.text : (t ? t.textContent : "");
        const val = prompt("ラベルの文字を編集 (空欄にすると非表示):", cur);
        if (val === null) return;
        ed.text = val;
        renderProposals();   // 幅・引き出し線を含めて再描画 (編集値は保持される)
      });
      // 右クリック (タッチは長押し) でラベルをドットごと削除。
      // ラベルだけ消したい場合はダブルクリック→空欄 (ドットは残る)。
      // 「編集をリセット」で復元できる
      lblg.addEventListener("contextmenu", e => {
        e.preventDefault();
        ed.text = "";
        ed.hideDot = true;
        renderProposals();
      });
    }
  });

  // ドットの操作は最前面の透明ヒット円で受ける (ラベル文字に覆われた
  // ドットへのクリックがテキストに吸われるのを防ぐ)。
  // ドラッグで移動、クリックで拡大 (⌥/Shiftで縮小)、右クリックで削除、
  // ダブルクリックで位置・サイズをリセット
  svg.querySelectorAll("circle.dot-hit").forEach(hit => {
    const g = svg.querySelector(`g.ann[data-id="${CSS.escape(hit.dataset.for)}"]`);
    const dot = g && g.querySelector(".dot");
    if (!dot) return;
    const id = hit.dataset.for;
    const ed = edits[id] || (edits[id] = {});
    const r0 = parseFloat(dot.dataset.r0);
    const px = parseFloat(g.dataset.px), py = parseFloat(g.dataset.py);
    const lead = g.querySelector(".lead"), lblg = g.querySelector(".lblg");
    const apply = () => {
      dot.setAttribute("cx", (px + (ed.mx || 0)).toFixed(1));
      dot.setAttribute("cy", (py + (ed.my || 0)).toFixed(1));
      dot.setAttribute("r", (r0 * (ed.r || 1)).toFixed(1));
      hit.setAttribute("cx", (px + (ed.mx || 0)).toFixed(1));
      hit.setAttribute("cy", (py + (ed.my || 0)).toFixed(1));
      hit.setAttribute("r", (r0 * (ed.r || 1) + 3).toFixed(1));
      if (lead && lblg) {
        const dx = ed.dx || 0, dy = ed.dy || 0;
        const d = lblg.dataset;
        const lg = leaderGeom(px + (ed.mx || 0), py + (ed.my || 0),
                              [+d.x0 + dx, +d.y0 + dy, +d.x1 + dx, +d.y1 + dy]);
        lead.setAttribute("x1", lg.x1.toFixed(1));
        lead.setAttribute("y1", lg.y1.toFixed(1));
        lead.setAttribute("x2", lg.x2.toFixed(1));
        lead.setAttribute("y2", lg.y2.toFixed(1));
        if (lg.show) lead.removeAttribute("display");
        else lead.setAttribute("display", "none");
      }
    };
    let drag = null, moved = false;
    hit.addEventListener("pointerdown", e => {
      e.preventDefault();
      drag = { start: toSvg(e), mx0: ed.mx || 0, my0: ed.my || 0 };
      moved = false;
      hit.setPointerCapture(e.pointerId);
    });
    hit.addEventListener("pointermove", e => {
      if (!drag) return;
      const p = toSvg(e);
      const nx = drag.mx0 + p.x - drag.start.x;
      const ny = drag.my0 + p.y - drag.start.y;
      // 3px 未満はクリック扱い (拡縮) にするため動かさない
      if (!moved && Math.hypot(nx - drag.mx0, ny - drag.my0) < 3) return;
      moved = true;
      ed.mx = nx; ed.my = ny;
      apply();
    });
    const end = () => { drag = null; };
    hit.addEventListener("pointerup", end);
    hit.addEventListener("pointercancel", end);
    hit.addEventListener("click", e => {          // クリックで拡大、⌥/Shiftで縮小
      if (moved) { moved = false; return; }       // ドラッグ直後の click は無視
      let r = ed.r || 1;
      r = (e.altKey || e.shiftKey) ? r / 1.25 : r * 1.25;
      ed.r = Math.max(0.4, Math.min(3, r));
      apply();
    });
    hit.addEventListener("dblclick", () => {      // ダブルクリックで位置・サイズをリセット
      ed.r = 1; ed.mx = 0; ed.my = 0;
      apply();
    });
    hit.addEventListener("contextmenu", e => {    // 右クリックでドットを削除
      e.preventDefault();
      ed.hideDot = true;
      renderProposals();
    });
  });
}

function download(svgText, id, fmt) {
  // 編集用の透明ヒット円は成果物に含めない
  svgText = svgText.replace(/<g class="dotHits">[\s\S]*?<\/g>/, "");
  if (fmt === "svg") {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    triggerDL(URL.createObjectURL(blob), `map_${id}.svg`);
    return;
  }
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 820 * 2; canvas.height = 620 * 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => triggerDL(URL.createObjectURL(b), `map_${id}.png`));
  };
  img.src = url;
}
function triggerDL(url, name) {
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

document.getElementById("goBtn").onclick = () => generate();
document.getElementById("inputText").addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
});

/* --- 共有リンク --- */
const shareBtn = document.getElementById("shareBtn");
shareBtn.onclick = () => {
  const url = location.href;
  const done = () => {
    shareBtn.textContent = "コピーしました ✓";
    setTimeout(() => { shareBtn.textContent = "共有リンクをコピー"; }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, () => fallbackCopy(url, done));
  } else {
    fallbackCopy(url, done);
  }
};
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { /* noop */ }
  ta.remove();
}

/* --- URL ハッシュからの復元 (#q=... は生成込み、#t=... は入力欄のみ) --- */
function initFromHash() {
  const m = location.hash.match(/^#(q|t)=(.+)$/);
  if (!m) return;
  try {
    const text = decodeURIComponent(m[2]);
    document.getElementById("inputText").value = text;
    if (m[1] === "q") generate(false);
  } catch (e) { /* 不正なハッシュは無視 */ }
}
window.addEventListener("hashchange", initFromHash);
initFromHash();
