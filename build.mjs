// マスターズ大会一覧のページを作るスクリプト（GitHub Actions で毎日動く）
// 1. スプレッドシート（GAS）から大会データを取得
// 2. script.js をそのまま動かして、ブラウザと同じ大会カードのHTMLを作る
// 3. 大会名・日程などが最初から入った index.html を _site/ に書き出す
//    （検索エンジンがJavaScriptを動かさなくても大会情報を読めるようにするため）
import fs from "node:fs";
import vm from "node:vm";

const SITE = "https://swim.freakers.net/";
const OUT = "_site";

const scriptSrc = fs.readFileSync("script.js", "utf8");
const GAS_URL = scriptSrc.match(/const GAS_URL = "([^"]+)"/)[1];
const SHEETS = JSON.parse(scriptSrc.match(/const SHEETS = (\[[^\]]+\])/)[1]);

// --- 1. データ取得（1つでも失敗したら止める。前回のページがそのまま残る） ---
const data = {};
for (const name of SHEETS) {
  let rows;
  for (let attempt = 1; attempt <= 3 && !rows; attempt++) {
    try {
      // テスト用：MOCK_DIR を指定するとファイルから読む
      const json = process.env.MOCK_DIR
        ? JSON.parse(fs.readFileSync(`${process.env.MOCK_DIR}/${name}.json`, "utf8"))
        : await fetch(`${GAS_URL}?sheet=${encodeURIComponent(name)}`).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); });
      if (!Array.isArray(json)) throw new Error("想定外のデータ形式");
      rows = json.slice(3);
    } catch (e) {
      console.warn(`${name}: ${attempt}回目の取得に失敗 (${e.message})`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!rows) { console.error(`${name} を取得できなかったので中止します`); process.exit(1); }
  // 空の行を落として、末尾の空セルを詰める（ページを軽くするため）
  data[name] = rows
    .filter((r) => String(r[0] || "").trim())
    .map((r) => { const a = r.map((v) => (v == null ? "" : v)); while (a.length && a[a.length - 1] === "") a.pop(); return a; });
  console.log(`${name}: ${data[name].length}件`);
}

// --- 2. script.js を仮の画面で動かして、表示されるHTMLを受け取る ---
const els = {};
const makeEl = (id) => (els[id] ||= {
  id, innerHTML: "", hidden: false, value: "", disabled: false, style: {}, options: [], dataset: {},
  classList: { toggle() {}, add() {}, remove() {} },
  querySelector: () => makeEl(`${id}>q`), querySelectorAll: () => [], addEventListener() {},
});
const document = {
  getElementById: makeEl,
  querySelector: (sel) => makeEl(sel),
  querySelectorAll: () => [],
  body: { getBoundingClientRect: () => ({ height: 0 }) },
};
const window = {
  MEETS_DATA: data,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};
window.parent = window;
const ctx = vm.createContext({ window, document, console, fetch, Intl, Date, ResizeObserver: class { observe() {} } });
vm.runInContext(`${scriptSrc}\n;globalThis.__out = { meets: () => meets, today, entryStatus };`, ctx);
await new Promise((r) => setTimeout(r, 50));
const { meets: getMeets, today, entryStatus } = ctx.__out;
const meets = getMeets();
if (!meets.length) { console.error("大会が0件なので中止します"); process.exit(1); }

// --- 3. HTMLを組み立てる ---
let html = fs.readFileSync("index.html", "utf8");
const put = (re, content) => {
  if (!re.test(html)) { console.error(`差し込み位置が見つかりません: ${re}`); process.exit(1); }
  html = html.replace(re, (_, open, close) => `${open}${content}${close}`);
};
put(/(<div id="cards" class="cards">)(<\/div>)/, els.cards.innerHTML);
put(/(<p id="count" class="count" aria-live="polite">)(<\/p>)/, els.count.innerHTML);
put(/(<select id="area-filter">)[\s\S]*?(<\/select>)/, els["area-filter"].innerHTML);
put(/(<select id="style-filter">)[\s\S]*?(<\/select>)/, els["style-filter"].innerHTML);
html = html.replace('<div id="status" class="status">', '<div id="status" class="status" hidden>');

const [y, m, d] = today.split("-").map(Number);
html = html.replace("<!--UPDATED-->", `${y}年${m}月${d}日`);

// 埋め込みデータ（</script> がデータ内に出てこないように < をエスケープ）
const LT = "\\" + "u003c";
const json = JSON.stringify(data).replace(/</g, LT);
html = html.replace("<!--DATA-->", () => `<script>window.MEETS_DATA = ${json};</script>`);

// 構造化データ（これから開催の大会）
const upcoming = meets.filter((x) => x.end >= today);
const events = upcoming.map((x) => {
  const ev = {
    "@type": "SportsEvent",
    name: x.name,
    startDate: x.start,
    endDate: x.end,
    sport: "Swimming",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: x.venue,
      address: { "@type": "PostalAddress", ...(x.pref ? { addressRegion: x.pref } : {}), addressCountry: "JP" },
    },
    url: x.url || SITE,
  };
  if (x.cancelled) ev.eventStatus = "https://schema.org/EventCancelled";
  else if (!x.adjusting) ev.eventStatus = "https://schema.org/EventScheduled";
  if (x.org) ev.organizer = { "@type": "Organization", name: x.org };
  return ev;
});
const ld = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "これから開催されるマスターズ水泳公認大会",
  itemListElement: events.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })),
};
html = html.replace("<!--JSONLD-->", () => `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, LT)}</script>`);

// CSS・JSのキャッシュ対策（更新日でバージョンを付ける）
const ver = today.replace(/-/g, "");
html = html.replace(/(style\.css|script\.js)\?v=[\w]+/g, `$1?v=${ver}`);

// --- 書き出し ---
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
fs.writeFileSync(`${OUT}/index.html`, html);
for (const f of ["style.css", "script.js", "Freakers.png"]) if (fs.existsSync(f)) fs.copyFileSync(f, `${OUT}/${f}`);
fs.writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
fs.writeFileSync(`${OUT}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`);
console.log(`完成: 全${meets.length}大会（これから開催 ${upcoming.length}件） / ${Math.round(html.length / 1024)}KB`);
