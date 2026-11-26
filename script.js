// マスターズ大会一覧 - Freakers
const GAS_URL = "https://script.google.com/macros/s/AKfycbyEzOKQBamQhmCAaVvG58Zie7f9ZEo5Nmbo779-lI6GOOhHvh5Bo-Ay2OYfte6RfNsS/exec";
const SHEETS = ["2024年度公認大会一覧", "2025年度公認大会一覧", "2026年度公認大会一覧", "2027年度公認大会一覧"];

// シートの7列目（G列）以降の並び
const STROKES = [
  { key: "自由形", label: "自由形", dists: ["25", "50", "100", "200", "400", "800", "1500"] },
  { key: "背泳ぎ", label: "背泳ぎ", dists: ["25", "50", "100", "200"] },
  { key: "平泳ぎ", label: "平泳ぎ", dists: ["25", "50", "100", "200"] },
  { key: "バタフライ", label: "バタフライ", dists: ["25", "50", "100", "200"] },
  { key: "個人メドレー", label: "個人メドレー", dists: ["100", "200", "400"] },
  { key: "フリーリレー", label: "フリーリレー", dists: ["4×25", "4×50", "4×100", "4×200"] },
  { key: "メドレーリレー", label: "メドレーリレー", dists: ["4×25", "4×50", "4×100"] },
  { key: "混合フリーリレー", label: "混合フリーリレー", dists: ["4×25", "4×50", "4×100", "4×200"] },
  { key: "混合メドレーリレー", label: "混合メドレーリレー", dists: ["4×25", "4×50", "4×100"] },
];
const DOW = ["日", "月", "火", "水", "木", "金", "土"];

// シートの列（0始まり）：AQ列＝要項URL、AR列＝都道府県
const COL_URL = 42, COL_PREF = 43;

// 地域の区分（都道府県は北から順）
const REGIONS = [
  ["北海道・東北", ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"]],
  ["関東", ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"]],
  ["中部", ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"]],
  ["近畿", ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"]],
  ["中国・四国", ["鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県"]],
  ["九州・沖縄", ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]],
];
const regionOf = (pref) => (REGIONS.find(([, list]) => list.includes(pref)) || [""])[0];

const state = { period: "upcoming", area: "", style: "", dist: "", course: "", keyword: "", view: "cards", tableStroke: "自由形" };
const mobile = window.matchMedia("(max-width: 600px)");
let meets = [];
let failedSheets = [];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
// 今日の日付（日本時間）。ページを作るサーバーと見る人の端末で日付がずれないようにする
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

// 「2026年11月30日(月) ～ 12月14日(月)」「2027年1月30日(土)」などを [開始, 終了] に
function parseRange(text) {
  const t = String(text || "").normalize("NFKC").replace(/[〜~]/g, "～");
  const first = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!first) return ["", ""];
  const y = +first[1], m = +first[2], d = +first[3];
  const start = iso(y, m, d);
  const rest = t.slice(first.index + first[0].length);
  const second = rest.match(/～\s*(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
  if (!second) return [start, start];
  let y2 = second[1] ? +second[1] : y;
  const m2 = +second[2], d2 = +second[3];
  if (!second[1] && m2 < m) y2 = y + 1;
  return [start, iso(y2, m2, d2)];
}

function toMeet(r) {
  const [start, end] = parseRange(r[2]);
  const [entryStart, entryEnd] = parseRange(r[1]);
  const events = {};
  let col = 6;
  STROKES.forEach((s) => {
    s.dists.forEach((d) => {
      const v = String(r[col++] || "").trim();
      if (v === "〇" || v === "◯" || v === "○") (events[s.key] ||= []).push(d);
    });
  });
  const c = String(r[5] || "");
  const course = c.includes("短") ? "短水路" : c.includes("長") ? "長水路" : "";
  const name = String(r[0] || "").trim();
  const url = String(r[COL_URL] || "").trim();
  const pref = String(r[COL_PREF] || "").trim();
  return {
    name, entryText: String(r[1] || "").trim(), dateText: String(r[2] || "").trim(),
    org: String(r[3] || "").trim(), venue: String(r[4] || "").trim(), course,
    start, end, entryStart, entryEnd, events, year: start.slice(0, 4),
    url: /^https?:\/\//.test(url) ? url : "", pref, region: regionOf(pref),
    cancelled: /中止/.test(name), adjusting: /調整中|延期/.test(name),
  };
}

function entryStatus(m) {
  if (m.cancelled) return { cls: "alert", text: "中止" };
  if (m.adjusting) return { cls: "alert", text: "開催調整中" };
  if (m.end && m.end < today) return { cls: "closed", text: "終了" };
  if (m.entryStart && today < m.entryStart) return { cls: "soon", text: "申込前" };
  if (m.entryEnd && today <= m.entryEnd) return { cls: "open", text: "申込受付中" };
  if (m.entryEnd) return { cls: "closed", text: "申込締切" };
  return { cls: "closed", text: "申込未発表" };
}

// 読み込み
async function loadAll() {
  let done = 0;
  failedSheets = [];
  meets = [];
  $("progress-fill").style.width = "0%";
  const results = await Promise.all(SHEETS.map(async (name) => {
    try {
      // ページに埋め込み済みのデータがあればそれを使う（毎日の自動更新で作られる）
      if (window.MEETS_DATA && Array.isArray(window.MEETS_DATA[name])) return window.MEETS_DATA[name];
      const res = await fetch(`${GAS_URL}?sheet=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("想定外のデータ形式");
      return data.slice(3);
    } catch (e) {
      console.warn(`シート「${name}」を読み込めませんでした`, e);
      failedSheets.push(name);
      return [];
    } finally {
      done++;
      $("progress-fill").style.width = `${Math.round((done / SHEETS.length) * 100)}%`;
    }
  }));
  const seen = new Set();
  results.flat().forEach((r) => {
    if (!r || !String(r[0] || "").trim()) return;
    const m = toMeet(r);
    if (!m.start) return;
    const k = `${m.name}_${m.start}`;
    if (seen.has(k)) return;
    seen.add(k);
    meets.push(m);
  });
  meets.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name, "ja"));
}

// 絞り込み
function filtered() {
  const kw = state.keyword.trim().normalize("NFKC").toLowerCase();
  return meets.filter((m) => {
    if (state.period === "upcoming" && m.end < today) return false;
    if (state.period === "open" && entryStatus(m).cls !== "open") return false;
    if (/^\d{4}$/.test(state.period) && m.year !== state.period) return false;
    if (state.course && m.course !== state.course) return false;
    if (state.area.startsWith("r:") && m.region !== state.area.slice(2)) return false;
    if (state.area.startsWith("p:") && m.pref !== state.area.slice(2)) return false;
    if (state.style) {
      const list = m.events[state.style] || [];
      if (!list.length) return false;
      if (state.dist && !list.includes(state.dist)) return false;
    }
    if (kw) {
      const hay = `${m.name} ${m.venue} ${m.org} ${m.pref}`.normalize("NFKC").toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

function dateBlock(m) {
  const s = toDate(m.start), e = toDate(m.end);
  const multi = m.end !== m.start;
  return `<div class="date">
    <span class="md">${s.getMonth() + 1}/${s.getDate()}</span>
    <span class="dow">(${DOW[s.getDay()]})</span>
    ${multi ? `<span class="to">～${e.getMonth() + 1 !== s.getMonth() + 1 ? `${e.getMonth() + 1}/` : ""}${e.getDate()}(${DOW[e.getDay()]})</span>` : ""}
  </div>`;
}

function eventChips(m) {
  const items = STROKES.filter((s) => m.events[s.key]).map((s) => {
    const hit = state.style === s.key && (!state.dist || m.events[s.key].includes(state.dist));
    return `<li class="${hit ? "hit" : ""}">${esc(s.label)}<span>${m.events[s.key].join("・")}</span></li>`;
  });
  return items.length ? `<ul class="events">${items.join("")}</ul>` : `<p class="meta">実施種目：未発表</p>`;
}

function renderCards(list) {
  if (!list.length) {
    $("cards").innerHTML = `<div class="empty">条件に合う大会がありません。条件を変えてみてください。${failedSheets.length ? "<br>（一部の年度を読み込めていないため、表示されていない大会があるかもしれません）" : ""}</div>`;
    return;
  }
  let html = "", month = "";
  list.forEach((m) => {
    const ym = `${+m.start.slice(0, 4)}年${+m.start.slice(5, 7)}月`;
    if (ym !== month) { month = ym; html += `<h2 class="month">${ym}</h2>`; }
    const st = entryStatus(m);
    const cls = ["card", m.cancelled ? "is-cancelled" : "", m.end < today ? "is-past" : ""].join(" ");
    html += `<article class="${cls}">
      ${dateBlock(m)}
      <div class="body">
        <div class="tags">
          ${m.course ? `<span class="tag ${m.course === "短水路" ? "short" : "long"}">${m.course}</span>` : ""}
          <span class="tag ${st.cls}">${st.text}</span>
        </div>
        <h3 class="name">${esc(m.name)}</h3>
        <p class="meta">${m.pref ? `${esc(m.pref)}｜` : ""}${esc(m.venue)}${m.org ? `｜${esc(m.org)}` : ""}</p>
        <p class="entry"><b>申込</b>${esc(m.entryText || "未発表")}</p>
        ${eventChips(m)}
        ${m.url ? `<a class="doc" href="${esc(m.url)}" target="_blank" rel="noopener">大会要項を見る（PDF）</a>` : ""}
      </div>
    </article>`;
  });
  $("cards").innerHTML = html;
}

function renderTable(list) {
  const head1 = `<th class="sticky" rowspan="2">大会名</th><th rowspan="2">開催日</th><th rowspan="2">水路</th>` +
    STROKES.map((s) => `<th class="g" colspan="${s.dists.length}">${esc(s.label)}</th>`).join("");
  const head2 = STROKES.map((s) => s.dists.map((d, i) => `<th class="${i === 0 ? "g" : ""}">${d}</th>`).join("")).join("");
  document.querySelector("#data-table thead").innerHTML = `<tr>${head1}</tr><tr>${head2}</tr>`;
  document.querySelector("#data-table tbody").innerHTML = list.map((m) => {
    const s = toDate(m.start);
    const cells = STROKES.map((st) => st.dists.map((d, i) => {
      const on = (m.events[st.key] || []).includes(d);
      return `<td class="${i === 0 ? "g " : ""}${on ? "y" : "n"}">${on ? "〇" : "–"}</td>`;
    }).join("")).join("");
    return `<tr><td class="sticky">${esc(m.name)}<small>${m.pref ? `${esc(m.pref)}｜` : ""}${esc(m.venue)}</small></td>
      <td>${s.getMonth() + 1}/${s.getDate()}(${DOW[s.getDay()]})</td>
      <td class="${m.course === "短水路" ? "c-short" : m.course === "長水路" ? "c-long" : ""}">${m.course ? m.course.slice(0, 1) : "–"}</td>${cells}</tr>`;
  }).join("");
}

// スマホの種目表：泳法を1つ選んで、その距離だけを表示する
function renderStrokeTabs() {
  $("stroke-tabs").innerHTML = STROKES.map((s) =>
    `<button type="button" data-stroke="${s.key}" class="${s.key === state.tableStroke ? "on" : ""}">${esc(s.label)}</button>`).join("");
  $("stroke-tabs").querySelectorAll("[data-stroke]").forEach((b) => b.onclick = () => {
    state.tableStroke = b.dataset.stroke;
    render();
  });
  // 選んでいる泳法のボタンが見える位置までタブを横にずらす
  const on = $("stroke-tabs").querySelector(".on");
  if (on) $("stroke-tabs").scrollLeft = on.offsetLeft - $("stroke-tabs").offsetLeft - 12;
}

function renderTableCompact(list) {
  const st = STROKES.find((s) => s.key === state.tableStroke) || STROKES[0];
  const hitCol = state.style === st.key ? state.dist : "";
  document.querySelector("#data-table thead").innerHTML = `<tr><th class="sticky">大会</th>` +
    st.dists.map((d) => `<th class="${d === hitCol ? "hit" : ""}">${d}</th>`).join("") + `</tr>`;
  document.querySelector("#data-table tbody").innerHTML = list.map((m) => {
    const s = toDate(m.start);
    const list2 = m.events[st.key] || [];
    const cells = st.dists.map((d) => {
      const on = list2.includes(d);
      return `<td class="${on ? "y" : "n"}${d === hitCol ? " hit" : ""}">${on ? "●" : "・"}</td>`;
    }).join("");
    const cc = m.course === "短水路" ? "c-short" : m.course === "長水路" ? "c-long" : "";
    return `<tr class="${m.end < today ? "is-past" : ""}"><td class="sticky">
      <span class="when">${s.getMonth() + 1}/${s.getDate()}(${DOW[s.getDay()]})${m.course ? ` <b class="${cc}">${m.course}</b>` : ""}</span>
      ${esc(m.name)}<small>${m.pref ? `${esc(m.pref)}｜` : ""}${esc(m.venue)}</small></td>${cells}</tr>`;
  }).join("");
}

function renderWarning() {
  const box = $("load-warning");
  if (!failedSheets.length) { box.hidden = true; return; }
  const years = failedSheets.map((n) => n.replace("公認大会一覧", "")).join("・");
  box.innerHTML = `<p><b>${esc(years)}</b>の大会データを読み込めませんでした。表示されていない大会があります。</p>
    <button type="button" class="retry">もう一度読み込む</button>`;
  box.querySelector(".retry").onclick = () => { window.MEETS_DATA = null; start(); };
  box.hidden = false;
}

function render() {
  const list = filtered();
  $("count").innerHTML = `${list.length}件 <small>／ 全${meets.length}大会</small>`;
  $("cards").hidden = state.view !== "cards";
  $("table-wrap").hidden = state.view !== "table";
  const compact = state.view === "table" && mobile.matches;
  $("stroke-tabs").hidden = !compact;
  $("data-table").classList.toggle("compact", compact);
  if (state.view === "cards") renderCards(list);
  else if (compact) { renderStrokeTabs(); renderTableCompact(list); }
  else renderTable(list);
}

// フォーム
function setupControls() {
  const styleSel = $("style-filter"), distSel = $("distance-filter");
  styleSel.innerHTML = `<option value="">すべて</option>` + STROKES.map((s) => `<option value="${s.key}">${s.key}</option>`).join("");
  const fillDist = () => {
    const s = STROKES.find((x) => x.key === state.style);
    distSel.innerHTML = `<option value="">すべて</option>` + (s ? s.dists.map((d) => `<option value="${d}">${d}m</option>`).join("") : "");
    distSel.disabled = !s;
  };
  $("period-filter").onchange = (e) => { state.period = e.target.value; render(); };
  $("area-filter").onchange = (e) => { state.area = e.target.value; render(); };
  styleSel.onchange = (e) => {
    state.style = e.target.value; state.dist = "";
    if (state.style) state.tableStroke = state.style;
    fillDist(); render();
  };
  distSel.onchange = (e) => { state.dist = e.target.value; render(); };
  $("keyword").oninput = (e) => { state.keyword = e.target.value; render(); };
  document.querySelectorAll("[data-course]").forEach((b) => b.onclick = () => {
    state.course = b.dataset.course;
    document.querySelectorAll("[data-course]").forEach((x) => x.classList.toggle("on", x === b));
    render();
  });
  document.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => {
    state.view = b.dataset.view;
    document.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("on", x === b));
    render();
  });
  $("reset").onclick = () => {
    Object.assign(state, { period: "upcoming", area: "", style: "", dist: "", course: "", keyword: "" });
    $("period-filter").value = "upcoming"; $("area-filter").value = ""; styleSel.value = ""; $("keyword").value = ""; fillDist();
    document.querySelectorAll("[data-course]").forEach((x) => x.classList.toggle("on", x.dataset.course === ""));
    render();
  };
}

// 地域の選択肢（データにある都道府県だけ出す）
function fillAreas() {
  const sel = $("area-filter");
  const have = new Set(meets.map((m) => m.pref).filter(Boolean));
  sel.innerHTML = `<option value="">全国</option>` + REGIONS.map(([region, prefs]) => {
    const ps = prefs.filter((p) => have.has(p));
    if (!ps.length) return "";
    return `<optgroup label="${region}"><option value="r:${region}">${region}すべて</option>` +
      ps.map((p) => `<option value="p:${p}">${p}</option>`).join("") + `</optgroup>`;
  }).join("");
  if ([...sel.options].some((o) => o.value === state.area)) sel.value = state.area;
  else state.area = "";
}

async function start() {
  const embedded = !!window.MEETS_DATA;
  if (!embedded) { $("status").hidden = false; $("cards").innerHTML = ""; }
  $("load-warning").hidden = true;
  await loadAll();
  $("status").hidden = true;
  renderWarning();
  if (!meets.length) {
    $("count").innerHTML = "";
    $("cards").innerHTML = `<div class="empty">大会データを読み込めませんでした。通信状況を確認して、もう一度お試しください。</div>`;
    return;
  }
  fillAreas();
  render();
}

setupControls();
start();
// 画面幅が変わったら（スマホの縦横回転など）表を描き直す
mobile.addEventListener("change", () => { if (meets.length) render(); });

// 埋め込み先（Squareのストーリーなど）に高さを伝える。
// 親側でiframeの高さを合わせることで、iframe内だけがスクロールして
// スマホで上に戻れなくなる問題を防ぐ。
(function () {
  if (window.parent === window) return;
  let last = 0;
  const send = () => {
    const h = Math.ceil(document.body.getBoundingClientRect().height);
    if (h === last) return;
    last = h;
    window.parent.postMessage({ type: "masters-meet-height", height: h }, "*");
  };
  new ResizeObserver(send).observe(document.body);
  window.addEventListener("load", send);
  send();
})();
