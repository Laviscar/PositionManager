const STORAGE_KEY = "position-manager-state-v1";
const EXCEPTION_NAME = "exception/其他";

const state = loadState();

const panels = {
  plan: document.getElementById("plan"),
  positions: document.getElementById("positions"),
  dashboard: document.getElementById("dashboard"),
};

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    panels[btn.dataset.tab].classList.add("active");
    render();
  });
});

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const base = {
    totalCapital: 500000,
    categories: [
      { id: uid(), name: "分类A", targetPercent: 30, isException: false },
      { id: uid(), name: "分类B", targetPercent: 20, isException: false },
      { id: uid(), name: "分类C", targetPercent: 50, isException: false },
      { id: uid(), name: EXCEPTION_NAME, targetPercent: null, isException: true },
    ],
    positions: [],
  };

  if (!saved) return base;
  try {
    const parsed = JSON.parse(saved);
    const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    if (!categories.some((c) => c.isException)) {
      categories.push({ id: uid(), name: EXCEPTION_NAME, targetPercent: null, isException: true });
    }
    return {
      totalCapital: Number(parsed.totalCapital) || 0,
      categories,
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
    };
  } catch {
    return base;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtAmount(v) {
  return Number(v || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v) {
  return `${Number(v || 0).toFixed(2)}%`;
}

function plannedCategories() {
  return state.categories.filter((c) => !c.isException);
}

function exceptionCategory() {
  return state.categories.find((c) => c.isException);
}

function categoryActual(categoryId) {
  return state.positions.filter((p) => p.categoryId === categoryId).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

function renderPlan() {
  const planned = plannedCategories();
  const totalPct = planned.reduce((sum, c) => sum + Number(c.targetPercent || 0), 0);

  panels.plan.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>计划设置</h2>
    <div class="row">
      <label>可用总资金</label>
      <input id="totalCapital" type="number" min="0" step="0.01" value="${state.totalCapital}" />
    </div>
    <div id="categoryRows"></div>
    <div class="row" style="margin-top:10px;">
      <button class="primary" id="addCategory">新增分类</button>
    </div>
    <p id="pctMessage" class="message"></p>
    <small class="muted">系统会自动附带默认分类：${EXCEPTION_NAME}（不参与比例合计）。</small>
  `;

  panels.plan.appendChild(card);
  const rows = card.querySelector("#categoryRows");
  planned.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "category-row";
    const target = (state.totalCapital * Number(cat.targetPercent || 0)) / 100;
    row.innerHTML = `
      <input class="name-input" data-id="${cat.id}" value="${cat.name}" />
      <input class="pct-input" data-id="${cat.id}" type="number" min="0" step="0.01" value="${cat.targetPercent}" />
      <span>目标金额：${fmtAmount(target)}</span>
      <button class="danger" data-remove="${cat.id}">删除</button>
    `;
    rows.appendChild(row);
  });

  const msg = card.querySelector("#pctMessage");
  if (Math.abs(totalPct - 100) < 0.0001) {
    msg.className = "message ok";
    msg.textContent = `计划内分类合计：${fmtPct(totalPct)}（合法）`;
  } else {
    msg.className = "message error";
    msg.textContent = `计划内分类合计：${fmtPct(totalPct)}（需等于 100%）`;
  }

  card.querySelector("#totalCapital").addEventListener("change", (e) => {
    state.totalCapital = Math.max(0, Number(e.target.value || 0));
    saveState();
    render();
  });

  card.querySelector("#addCategory").addEventListener("click", () => {
    state.categories.splice(state.categories.length - 1, 0, {
      id: uid(),
      name: `新分类${plannedCategories().length + 1}`,
      targetPercent: 0,
      isException: false,
    });
    saveState();
    render();
  });

  card.querySelectorAll(".name-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const cat = state.categories.find((c) => c.id === e.target.dataset.id);
      if (cat) cat.name = e.target.value;
      saveState();
      renderPositions();
      renderDashboard();
    });
  });

  card.querySelectorAll(".pct-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const cat = state.categories.find((c) => c.id === e.target.dataset.id);
      if (cat) cat.targetPercent = Math.max(0, Number(e.target.value || 0));
      saveState();
      render();
    });
  });

  card.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.dataset.remove;
      state.categories = state.categories.filter((c) => c.id !== id);
      state.positions = state.positions.filter((p) => p.categoryId !== id);
      saveState();
      render();
    });
  });
}

function renderPositions() {
  panels.positions.innerHTML = "";
  const allCats = [...plannedCategories(), exceptionCategory()].filter(Boolean);

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>持仓录入</h2><small class="muted">个股没有目标比例，仅记录实际金额。</small>`;
  panels.positions.appendChild(card);

  allCats.forEach((cat) => {
    const box = document.createElement("div");
    box.className = "card";
    const actual = categoryActual(cat.id);
    box.innerHTML = `
      <h3>${cat.name}</h3>
      <p class="message ${cat.isException ? "warn" : ""}">${cat.isException ? "计划外分类，不受比例约束" : ""}</p>
      <p>当前分类已录入：${fmtAmount(actual)}</p>
      <div id="rows-${cat.id}"></div>
      <button class="primary" data-add-pos="${cat.id}">新增个股</button>
    `;
    panels.positions.appendChild(box);

    const rows = box.querySelector(`#rows-${cat.id}`);
    state.positions.filter((p) => p.categoryId === cat.id).forEach((pos) => {
      const row = document.createElement("div");
      row.className = "position-row";
      row.innerHTML = `
        <input data-sym="${pos.id}" value="${pos.symbol}" placeholder="代码" />
        <input data-name="${pos.id}" value="${pos.name}" placeholder="名称" />
        <input data-amt="${pos.id}" type="number" min="0" step="0.01" value="${pos.amount}" placeholder="金额" />
        <button class="danger" data-del-pos="${pos.id}">删除</button>
      `;
      rows.appendChild(row);
    });
  });

  panels.positions.querySelectorAll("[data-add-pos]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      state.positions.push({
        id: uid(),
        categoryId: e.target.dataset.addPos,
        symbol: "",
        name: "",
        amount: 0,
      });
      saveState();
      render();
    });
  });

  panels.positions.querySelectorAll("[data-del-pos]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.dataset.delPos;
      state.positions = state.positions.filter((p) => p.id !== id);
      saveState();
      render();
    });
  });

  ["sym", "name", "amt"].forEach((k) => {
    panels.positions.querySelectorAll(`[data-${k}]`).forEach((input) => {
      input.addEventListener("input", (e) => {
        const id = e.target.dataset[k];
        const pos = state.positions.find((p) => p.id === id);
        if (!pos) return;
        if (k === "sym") pos.symbol = e.target.value;
        if (k === "name") pos.name = e.target.value;
        if (k === "amt") pos.amount = Math.max(0, Number(e.target.value || 0));
        saveState();
        renderDashboard();
      });
    });
  });
}

function statusClass(usage) {
  if (usage > 1) return "status-danger";
  if (usage >= 0.9) return "status-warn";
  return "status-normal";
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function stockColor(index) {
  const palette = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c"];
  return palette[index % palette.length];
}

function renderDashboard() {
  panels.dashboard.innerHTML = "";
  const planned = plannedCategories();
  const exception = exceptionCategory();
  const actualException = exception ? categoryActual(exception.id) : 0;

  const plannedActual = planned.reduce((sum, c) => sum + categoryActual(c.id), 0);
  const actualTotal = plannedActual + actualException;
  const remainTotal = state.totalCapital - actualTotal;
  const usageTotal = state.totalCapital > 0 ? actualTotal / state.totalCapital : 0;

  const top = document.createElement("div");
  top.className = "card";
  top.innerHTML = `
    <h2>仓位仪表盘</h2>
    <div class="grid">
      <div class="metric"><h4>可用总资金</h4><strong>${fmtAmount(state.totalCapital)}</strong></div>
      <div class="metric"><h4>已投入</h4><strong>${fmtAmount(actualTotal)}</strong></div>
      <div class="metric"><h4>未投入</h4><strong class="${remainTotal < 0 ? "status-danger" : ""}">${fmtAmount(remainTotal)}</strong></div>
      <div class="metric"><h4>总利用率</h4><strong class="${statusClass(usageTotal)}">${fmtPct(usageTotal * 100)}</strong></div>
    </div>
  `;
  panels.dashboard.appendChild(top);

  const chartCard = document.createElement("div");
  chartCard.className = "card";
  const usagePct = clamp(usageTotal * 100, 0, 100);
  const exPct = clamp(state.totalCapital > 0 ? (actualException / state.totalCapital) * 100 : 0, 0, 100);
  chartCard.innerHTML = `
    <h3>图形化仓位视图</h3>
    <div class="viz-grid">
      <div class="viz-block">
        <div class="donut" style="--pct:${usagePct}; --color:#2563eb;"></div>
        <div>
          <h4>总仓位使用率</h4>
          <p class="${statusClass(usageTotal)}">${fmtPct(usagePct)}</p>
        </div>
      </div>
      <div class="viz-block">
        <div class="donut" style="--pct:${exPct}; --color:#b91c1c;"></div>
        <div>
          <h4>计划外持仓占比</h4>
          <p class="${statusClass(exPct / 100)}">${fmtPct(exPct)}</p>
        </div>
      </div>
    </div>
    <div class="bar-list" id="categoryBars"></div>
  `;
  panels.dashboard.appendChild(chartCard);

  const bars = chartCard.querySelector("#categoryBars");
  planned.forEach((c) => {
    const target = (state.totalCapital * Number(c.targetPercent || 0)) / 100;
    const actual = categoryActual(c.id);
    const usage = target > 0 ? actual / target : 0;
    const stocks = state.positions.filter((p) => p.categoryId === c.id && Number(p.amount || 0) > 0);
    const row = document.createElement("div");
    row.className = "bar-row";

    const segments = [];
    let consumed = 0;
    stocks.forEach((stock, idx) => {
      const stockPct = target > 0 ? (Number(stock.amount || 0) / target) * 100 : 0;
      const width = clamp(stockPct, 0, Math.max(0, 100 - consumed));
      consumed += width;
      segments.push(`
        <div class="bar-segment" style="width:${width}%; background:${stockColor(idx)}" title="${stock.symbol || stock.name || "未命名"} ${fmtPct(stockPct)}"></div>
      `);
    });

    const overflowPct = clamp(target > 0 ? ((actual - target) / target) * 100 : 0, 0, 100);
    const overflowWidth = Math.min(100, overflowPct);

    const legends = stocks
      .map((stock, idx) => {
        const stockPct = target > 0 ? (Number(stock.amount || 0) / target) * 100 : 0;
        const label = stock.symbol || stock.name || "未命名";
        return `<div class="legend-item"><span class="legend-dot" style="background:${stockColor(idx)}"></span>${label} · ${fmtPct(stockPct)}</div>`;
      })
      .join("");

    row.innerHTML = `
      <div class="bar-head">
        <span>${c.name}</span>
        <span class="${statusClass(usage)}">${fmtPct(usage * 100)}</span>
      </div>
      <div class="bar-track">
        ${segments.join("")}
        ${overflowWidth > 0 ? `<div class="bar-overflow" style="width:${overflowWidth}%" title="超配 ${fmtPct(overflowPct)}"></div>` : ""}
      </div>
      <div class="bar-legend">${legends || '<span class="muted">暂无个股持仓</span>'}</div>
    `;
    bars.appendChild(row);
  });

  const plannedCard = document.createElement("div");
  plannedCard.className = "card";
  plannedCard.innerHTML = "<h3>计划内分类</h3>";
  const grid = document.createElement("div");
  grid.className = "grid";

  planned.forEach((c) => {
    const target = (state.totalCapital * Number(c.targetPercent || 0)) / 100;
    const actual = categoryActual(c.id);
    const remain = target - actual;
    const usage = target > 0 ? actual / target : 0;
    const usageDisplay = usage * 100;
    const usageCapped = clamp(usageDisplay, 0, 100);
    const boardColor = usage > 1 ? "#b91c1c" : usage >= 0.9 ? "#b45309" : "#2563eb";
    const item = document.createElement("div");
    item.className = "metric category-board";
    item.innerHTML = `
      <h4>${c.name}（分类看板）</h4>
      <div class="board-main">
        <div class="donut" style="--pct:${usageCapped}; --color:${boardColor};"></div>
        <div>
          <div class="${statusClass(usage)} board-usage">${fmtPct(usageDisplay)}</div>
          <small class="muted">以该分类目标金额为 100%</small>
        </div>
      </div>
      <div>目标：${fmtAmount(target)}</div>
      <div>已用：${fmtAmount(actual)}</div>
      <div class="${remain < 0 ? "status-danger" : ""}">剩余：${fmtAmount(remain)}</div>
    `;
    grid.appendChild(item);
  });

  plannedCard.appendChild(grid);
  panels.dashboard.appendChild(plannedCard);

  const exCard = document.createElement("div");
  exCard.className = "card";
  const exRatio = state.totalCapital > 0 ? (actualException / state.totalCapital) * 100 : 0;
  exCard.innerHTML = `
    <h3>${EXCEPTION_NAME}</h3>
    <p>计划外持仓：<strong>${fmtAmount(actualException)}</strong></p>
    <p>计划外占比：<strong>${fmtPct(exRatio)}</strong></p>
  `;
  panels.dashboard.appendChild(exCard);
}

function render() {
  renderPlan();
  renderPositions();
  renderDashboard();
}

render();
