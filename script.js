const gasBaseUrl = "https://script.google.com/macros/s/AKfycbyEzOKQBamQhmCAaVvG58Zie7f9ZEo5Nmbo779-lI6GOOhHvh5Bo-Ay2OYfte6RfNsS/exec";
//const sheetNames = ["2023年度公認大会一覧", "2024年度公認大会一覧", "2025年度公認大会一覧"];
const sheetNames = ["2024年度公認大会一覧", "2025年度公認大会一覧","2026年度公認大会一覧"];
const fixedHeaders = [
  "大会名", "締切", "日程", "主催", "会場", "水路",
  "自由形_25m", "自由形_50m", "自由形_100m", "自由形_200m", "自由形_400m", "自由形_800m", "自由形_1500m",
  "背泳ぎ_25m", "背泳ぎ_50m", "背泳ぎ_100m", "背泳ぎ_200m",
  "平泳ぎ_25m", "平泳ぎ_50m", "平泳ぎ_100m", "平泳ぎ_200m",
  "バタフライ_25m", "バタフライ_50m", "バタフライ_100m", "バタフライ_200m",
  "個人メドレー_100m", "個人メドレー_200m", "個人メドレー_400m",
  "フリーリレー_4x25m", "フリーリレー_4x50m", "フリーリレー_4x100m", "フリーリレー_4x200m",
  "メドレーリレー_4x25m", "メドレーリレー_4x50m", "メドレーリレー_4x100m",
  "混合フリーリレー_4x25m", "混合フリーリレー_4x50m", "混合フリーリレー_4x100m", "混合フリーリレー_4x200m",
  "混合メドレーリレー_4x25m", "混合メドレーリレー_4x50m", "混合メドレーリレー_4x100m"
];
let rawData = [];

const parseDateRange = txt => {
  if (!txt) return ["", ""];
  const clean = txt.replace(/[〜～~]/g, "～");
  const range = clean.match(/(\d{4})年(\d{1,2})月(\d{1,2})日.*?～.*?(\d{1,2})月(\d{1,2})日/);
  if (range) {
    const [_, y, m1, d1, m2, d2] = range;
    return [`${y}-${m1.padStart(2, 0)}-${d1.padStart(2, 0)}`, `${y}-${m2.padStart(2, 0)}-${d2.padStart(2, 0)}`];
  }
  const single = clean.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (single) {
    const [_, y, m, d] = single;
    return [`${y}-${m.padStart(2, 0)}-${d.padStart(2, 0)}`, `${y}-${m.padStart(2, 0)}-${d.padStart(2, 0)}`];
  }
  return ["", ""];
};

const normalizeCourse = v => v?.includes("短") ? "短水路" : v?.includes("長") ? "長水路" : v || "";

const loadSheet = async (name) => {
  const url = `${gasBaseUrl}?sheet=${encodeURIComponent(name)}`;
  const data = await fetch(url).then(r => r.json());
  if (!Array.isArray(data)) throw new Error("invalid data");
  return data.slice(3);
};

const setupFilters = () => {
  const styleSel = document.getElementById("style-filter");
  const distSel = document.getElementById("distance-filter");
  const styleSet = new Set(), distMap = {};
  fixedHeaders.forEach(k => {
    if (!k.includes("_")) return;
    const [s, d] = k.split("_");
    const dist = d.replace("m", "");
    styleSet.add(s);
    distMap[s] = distMap[s] || new Set();
    distMap[s].add(dist);
  });
  styleSel.innerHTML = `<option value="">--種目--</option>` + [...styleSet].map(s => `<option>${s}</option>`).join("");
  styleSel.onchange = () => {
    const s = styleSel.value;
    if (!s) return distSel.innerHTML = `<option value="">--距離--</option>`;
    const options = [...(distMap[s] || [])].sort((a, b) => +a - +b).map(d => `<option>${d}</option>`).join("");
    distSel.innerHTML = `<option value="">--距離--</option>` + options;
  };
};

const renderTable = (data) => {
  const thead = document.querySelector("#data-table thead");
  const tbody = document.querySelector("#data-table tbody");

  const styleMap = {};
  fixedHeaders.forEach(k => {
    if (!k.includes("_")) return;
    const [s, d] = k.split("_");
    styleMap[s] = styleMap[s] || [];
    styleMap[s].push(d.replace("m", "").replace("×", "×"));
  });

  const styleOrder = Object.keys(styleMap);

  const th1 =
    `<th class="title-col" rowspan="2">大会名</th>` +
    `<th class="venue-col" rowspan="2">会場</th>` +
    `<th class="course-col" rowspan="2">水路</th>` +
    `<th class="deadline-col" rowspan="2">締切</th>` +
    `<th colspan="2">開催日</th>` +
    styleOrder.map(s =>
      `<th class="event-col group-border" colspan="${styleMap[s].length}">${s}</th>`
    ).join("");

  const th2 =
    `<th class="date-col">開始</th><th class="date-col">終了</th>` +
    styleOrder.flatMap(s =>
      styleMap[s].map((d, i) =>
        `<th class="event-col ${i === 0 ? "group-border" : ""}">${d}</th>`
      )
    ).join("");

  thead.innerHTML = `<tr>${th1}</tr><tr>${th2}</tr>`;

  tbody.innerHTML = data.map(row => {
    const course = row["水路"] || "-";
    const color = course === "長水路" ? "red" : course === "短水路" ? "blue" : "black";

    return "<tr>" + [
      `<td class="title-col">${row["大会名"] || "-"}</td>`,
      `<td class="venue-col">${row["会場"] || "-"}</td>`,
      `<td class="course-col" style="color:${color}">${course}</td>`,
      `<td class="deadline-col">${row["締切"] || "-"}</td>`,
      `<td class="date-col">${row["開催日開始"] || "-"}</td>`,
      `<td class="date-col">${row["開催日終了"] || "-"}</td>`,
      ...styleOrder.flatMap(s =>
        styleMap[s].map((d, i) => {
          const key = `${s}_${d}m`;
          const val = row[key];
          return `<td class="event-col ${i === 0 ? "group-border" : ""}">${(val === "〇" || val === "◯") ? "〇" : "-"}</td>`;
        })
      )
    ].join("") + "</tr>";
  }).join("");
};

const applyFilter = () => {
  const y = document.getElementById("year-filter").value;
  const s = document.getElementById("start-date").value;
  const e = document.getElementById("end-date").value;
  const sty = document.getElementById("style-filter").value;
  const dist = document.getElementById("distance-filter").value;
  const key = sty && dist ? `${sty}_${dist}m` : null;
  const filtered = rawData.filter(r =>
    (!y || r["年度"] === y) &&
    (!key || r[key] === "〇" || r[key] === "◯") &&
    (!s || r["開催日終了"] >= s) &&
    (!e || r["開催日開始"] <= e)
  );
  renderTable(filtered);
  document.getElementById("data-table").classList.add("compact");
  document.getElementById("status").textContent = `${filtered.length}件表示中`;
};

const clearFilter = () => {
  document.getElementById("year-filter").value = "";
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";
  document.getElementById("style-filter").value = "";
  document.getElementById("distance-filter").innerHTML = `<option value="">--距離--</option>`;
  renderTable(rawData);
  document.getElementById("data-table").classList.add("compact");
  document.getElementById("status").textContent = `${rawData.length}件表示中`;
};

const toggleCompact = () => {
  document.getElementById("data-table").classList.toggle("compact");
};

// ✅ プログレスバー関数（開始・進行・完了時の表示演出）
function updateProgressBar(percent) {
  const label = document.querySelector(".progress-text");
  const swimmerWrapper = document.querySelector(".swimmer-wrapper");
  const swimBar = document.getElementById("swim-bar-fill");
  const swimmerImg = document.querySelector(".swimmer-img");

  if (swimBar) swimBar.style.width = `${percent}%`;

  if (percent === 0) {
    if (label) label.textContent = "読み込みを開始しています...";
    if (swimmerImg) swimmerImg.style.animationPlayState = "running"; // ✅ 初期状態で再生
  } else if (label) {
    label.textContent = `読み込み中... ${percent}% 完了`;
  }

  if (percent >= 100) {
    if (swimmerImg) swimmerImg.style.animationPlayState = "paused"; // ✅ 完了で止める
    if (swimmerWrapper) {
      setTimeout(() => {
        swimmerWrapper.style.transition = "opacity 0.5s ease";
        swimmerWrapper.style.opacity = 0;
        setTimeout(() => swimmerWrapper.style.display = "none", 500);
      }, 500);
    }
  }
}




// ✅ 年度フィルター 初期値を2026に設定
window.addEventListener("DOMContentLoaded", () => {
  const yearSelect = document.getElementById("year-filter");
  if (yearSelect) {
    yearSelect.value = "2026";
  }
});

// ✅ メイン処理（読み込み＋描画＋進捗反映）
(async () => {
  const seenKeys = new Set();
  const totalSheets = sheetNames.length;
  let completedSheets = 0;

  for (const name of sheetNames) {
    try {
      const rows = await loadSheet(name);
      rows.some(r => {
        if (!r[0]) return true;
        const o = {};
        fixedHeaders.forEach((k, i) => o[k] = r[i] || "");
        const [start, end] = parseDateRange(o["日程"]);
        o["開催日開始"] = start;
        o["開催日終了"] = end;
        o["年度"] = start ? start.slice(0, 4) : "";
        o["水路"] = normalizeCourse(o["水路"]);
        const uniqueKey = `${o["大会名"]}_${o["開催日開始"]}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          rawData.push(o);
        }
        return false;
      });
    } catch (err) {
      console.warn(`スキップ：シート「${name}」が見つかりませんでした`);
    }
    completedSheets++;
    updateProgressBar(Math.floor((completedSheets / totalSheets) * 100));
  }

  setupFilters();
  rawData.sort((a, b) => (a["開催日開始"] || "").localeCompare(b["開催日開始"] || ""));

  // ✅ 初期表示は必ず 2026年 に絞る
  document.getElementById("year-filter").value = "2026";
  applyFilter();

  document.getElementById("data-table").classList.add("compact");
  document.getElementById("status").textContent = `${rawData.length}件表示中`;

})();


