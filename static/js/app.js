const API = {
  async get(url) {
    const r = await fetch(url);
    return r.json();
  },
  async post(url, data) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { data: await r.json(), ok: r.ok };
  },
  async put(url, data) {
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { data: await r.json(), ok: r.ok };
  },
  async del(url) {
    const r = await fetch(url, { method: "DELETE" });
    return { data: await r.json(), ok: r.ok };
  },
};

function fmt(n) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n || 0));
}

function fmtCurrency(n) {
  return fmt(n) + " VND";
}

function showToast(msg, type = "success") {
  const container =
    document.getElementById("toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function createToastContainer() {
  const c = document.createElement("div");
  c.id = "toast-container";
  c.className = "toast-container";
  document.body.appendChild(c);
  return c;
}

const state = {
  page: "calculator",
  woodTypes: [],
  legTypes: [],
  chairTypes: [],
  deals: [],
  stats: {},
  dealFilter: "all",
  customers: [],
};

async function loadComponentData() {
  const [wood, legs, chairs] = await Promise.all([
    API.get("/api/wood-types"),
    API.get("/api/leg-types"),
    API.get("/api/chair-types"),
  ]);
  state.woodTypes = wood;
  state.legTypes = legs;
  state.chairTypes = chairs;
}

function navigate(page) {
  state.page = page;
  document
    .querySelectorAll(".sidebar-nav li, .mobile-nav .nav-item")
    .forEach((el) => {
      el.classList.toggle("active", el.dataset.page === page);
    });
  renderPage();
}

function renderPage() {
  const main = document.getElementById("main-content");
  switch (state.page) {
    case "calculator":
      renderCalculator(main);
      break;
    case "deals":
      renderDeals(main);
      break;
    case "customers":
      renderCustomers(main);
      break;
    case "wood":
      renderComponentManager(main, "wood");
      break;
    case "legs":
      renderComponentManager(main, "legs");
      break;
    case "chairs":
      renderComponentManager(main, "chairs");
      break;
  }
}

// ── Calculator Page ──

function renderCalculator(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>New Deal Calculator</h1>
    </div>
    <div class="calculator-layout">
      <div class="calculator-form">
        <div class="card">
          <div class="card-title">Table Dimensions</div>
          <div class="form-row">
            <div class="form-group">
              <label>Width (cm)</label>
              <input type="number" class="form-control" id="calc-width" min="0" step="1" value="0" oninput="updateCalc()">
            </div>
            <div class="form-group">
              <label>Length (cm)</label>
              <input type="number" class="form-control" id="calc-length" min="0" step="1" value="0" oninput="updateCalc()">
            </div>
          </div>
          <div class="form-group">
            <label>Area: <strong id="calc-area">0</strong> m²</label>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Wood Type</div>
          <div class="form-group">
            <label>Select Wood</label>
            <select class="form-control" id="calc-wood" onchange="updateCalc()">
              <option value="">-- No wood selected --</option>
              ${state.woodTypes.map((w) => `<option value="${w.id}" data-price="${w.price_per_m2}" data-name="${w.name}">${w.name} (${fmt(w.price_per_m2)}/m²)</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Legs</div>
          <div class="form-row">
            <div class="form-group">
              <label>Leg Type</label>
              <select class="form-control" id="calc-leg" onchange="updateCalc()">
                <option value="">-- No legs --</option>
                ${state.legTypes.map((l) => `<option value="${l.id}" data-price="${l.price}" data-name="${l.name}">${l.name} (${fmt(l.price)} each)</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Quantity</label>
              <input type="number" class="form-control" id="calc-leg-qty" min="0" value="4" oninput="updateCalc()">
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Chairs</div>
          <div class="form-row">
            <div class="form-group">
              <label>Chair Type</label>
              <select class="form-control" id="calc-chair" onchange="updateCalc()">
                <option value="">-- No chairs --</option>
                ${state.chairTypes.map((c) => `<option value="${c.id}" data-price="${c.price}" data-name="${c.name}">${c.name} (${fmt(c.price)} each)</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Quantity</label>
              <input type="number" class="form-control" id="calc-chair-qty" min="0" value="0" oninput="updateCalc()">
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Additional Fees</div>
          <div class="form-row">
            <div class="form-group">
              <label>Extra Fee</label>
              <input type="number" class="form-control" id="calc-extra" min="0" value="0" oninput="updateCalc()">
            </div>
            <div class="form-group">
              <label>Extra Fee Note</label>
              <input type="text" class="form-control" id="calc-extra-note" placeholder="e.g. surface coating">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Shipping Fee</label>
              <input type="number" class="form-control" id="calc-shipping" min="0" value="0" oninput="updateCalc()">
            </div>
            <div class="form-group">
              <label>Discount (%)</label>
              <input type="number" class="form-control" id="calc-discount" min="0" max="100" value="0" oninput="updateCalc()">
            </div>
          </div>
        </div>
      </div>

      <div class="price-summary">
        <div class="card">
          <div class="card-title">Price Breakdown</div>
          <div id="price-breakdown">
            <div class="price-line"><span class="label">Wood</span><span id="sum-wood">0</span></div>
            <div class="price-line"><span class="label">Legs</span><span id="sum-legs">0</span></div>
            <div class="price-line"><span class="label">Chairs</span><span id="sum-chairs">0</span></div>
            <div class="price-line"><span class="label">Extra Fee</span><span id="sum-extra">0</span></div>
            <hr class="section-divider">
            <div class="price-line"><span class="label">Subtotal</span><span id="sum-subtotal">0</span></div>
            <div class="price-line"><span class="label">Discount</span><span id="sum-discount">-0</span></div>
            <div class="price-line"><span class="label">Shipping</span><span id="sum-shipping">0</span></div>
            <div class="price-line total"><span class="label">TOTAL</span><span id="sum-total">0 VND</span></div>
          </div>
          <hr class="section-divider">
          <button class="btn btn-success btn-lg" style="width:100%" onclick="openSaveDeal()">
            Save Deal
          </button>
        </div>
      </div>
    </div>
  `;
  updateCalc();
}

function getCalcValues() {
  const width = parseFloat(document.getElementById("calc-width")?.value) || 0;
  const length =
    parseFloat(document.getElementById("calc-length")?.value) || 0;
  const area = (width * length) / 10000;

  const woodSel = document.getElementById("calc-wood");
  const woodOpt = woodSel?.selectedOptions[0];
  const woodPrice = parseFloat(woodOpt?.dataset.price) || 0;
  const woodName = woodOpt?.dataset.name || "";
  const woodId = woodSel?.value || "";

  const legSel = document.getElementById("calc-leg");
  const legOpt = legSel?.selectedOptions[0];
  const legPrice = parseFloat(legOpt?.dataset.price) || 0;
  const legName = legOpt?.dataset.name || "";
  const legId = legSel?.value || "";
  const legQty = parseInt(document.getElementById("calc-leg-qty")?.value) || 0;

  const chairSel = document.getElementById("calc-chair");
  const chairOpt = chairSel?.selectedOptions[0];
  const chairPrice = parseFloat(chairOpt?.dataset.price) || 0;
  const chairName = chairOpt?.dataset.name || "";
  const chairId = chairSel?.value || "";
  const chairQty =
    parseInt(document.getElementById("calc-chair-qty")?.value) || 0;

  const extra =
    parseFloat(document.getElementById("calc-extra")?.value) || 0;
  const extraNote = document.getElementById("calc-extra-note")?.value || "";
  const shipping =
    parseFloat(document.getElementById("calc-shipping")?.value) || 0;
  const discount =
    parseFloat(document.getElementById("calc-discount")?.value) || 0;

  const woodTotal = area * woodPrice;
  const legTotal = legPrice * legQty;
  const chairTotal = chairPrice * chairQty;
  const subtotal = woodTotal + legTotal + chairTotal + extra;
  const discountAmt = subtotal * (discount / 100);
  const total = subtotal - discountAmt + shipping;

  return {
    width,
    length,
    area,
    woodId,
    woodName,
    woodPrice,
    woodTotal,
    legId,
    legName,
    legPrice,
    legQty,
    legTotal,
    chairId,
    chairName,
    chairPrice,
    chairQty,
    chairTotal,
    extra,
    extraNote,
    shipping,
    discount,
    subtotal,
    discountAmt,
    total,
  };
}

function updateCalc() {
  const v = getCalcValues();
  const areaEl = document.getElementById("calc-area");
  if (areaEl) areaEl.textContent = v.area.toFixed(4);

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(val);
  };
  setEl("sum-wood", v.woodTotal);
  setEl("sum-legs", v.legTotal);
  setEl("sum-chairs", v.chairTotal);
  setEl("sum-extra", v.extra);
  setEl("sum-subtotal", v.subtotal);
  setEl("sum-shipping", v.shipping);

  const discEl = document.getElementById("sum-discount");
  if (discEl) discEl.textContent = "-" + fmt(v.discountAmt);

  const totalEl = document.getElementById("sum-total");
  if (totalEl) totalEl.textContent = fmtCurrency(v.total);
}

function openSaveDeal() {
  const v = getCalcValues();
  if (v.total <= 0) {
    showToast("Total must be greater than 0", "error");
    return;
  }

  const overlay = document.getElementById("modal-overlay");
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Save Deal — ${fmtCurrency(v.total)}</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="form-group">
        <label>Customer Name *</label>
        <input type="text" class="form-control" id="deal-name" placeholder="Customer name">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Phone</label>
          <input type="text" class="form-control" id="deal-phone" placeholder="Phone number">
        </div>
        <div class="form-group">
          <label>Address</label>
          <input type="text" class="form-control" id="deal-address" placeholder="Delivery address">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" id="deal-notes" placeholder="Special instructions, preferences..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="saveDeal()">Save Deal</button>
      </div>
    </div>
  `;
  overlay.classList.add("active");
}

async function saveDeal() {
  const v = getCalcValues();
  const name = document.getElementById("deal-name").value.trim();
  if (!name) {
    showToast("Customer name is required", "error");
    return;
  }

  const payload = {
    customer_name: name,
    customer_phone: document.getElementById("deal-phone").value.trim(),
    customer_address: document.getElementById("deal-address").value.trim(),
    notes: document.getElementById("deal-notes").value.trim(),
    table_width_cm: v.width,
    table_length_cm: v.length,
    wood_type_id: v.woodId,
    wood_type_name: v.woodName,
    wood_price_per_m2: v.woodPrice,
    leg_type_id: v.legId,
    leg_type_name: v.legName,
    leg_price_each: v.legPrice,
    leg_qty: v.legQty,
    chair_type_id: v.chairId,
    chair_type_name: v.chairName,
    chair_price_each: v.chairPrice,
    chair_qty: v.chairQty,
    extra_fee: v.extra,
    extra_fee_note: v.extraNote,
    shipping_fee: v.shipping,
    discount_percent: v.discount,
  };

  const { data, ok } = await API.post("/api/deals", payload);
  if (ok) {
    showToast("Deal saved!");
    closeModal();
    navigate("deals");
  } else {
    showToast(data.error || "Failed to save deal", "error");
  }
}

// ── Deals Page ──

async function renderDeals(container) {
  const [deals, stats] = await Promise.all([
    API.get("/api/deals"),
    API.get("/api/stats"),
  ]);
  state.deals = deals;
  state.stats = stats;

  const filtered =
    state.dealFilter === "all"
      ? deals
      : deals.filter((d) => d.status === state.dealFilter);

  container.innerHTML = `
    <div class="page-header">
      <h1>Deals</h1>
      <button class="btn btn-primary" onclick="navigate('calculator')">+ New Deal</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${stats.total_deals}</div><div class="stat-label">Total Deals</div></div>
      <div class="stat-card pending"><div class="stat-value">${stats.pending}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card on_delivery"><div class="stat-value">${stats.on_delivery}</div><div class="stat-label">On Delivery</div></div>
      <div class="stat-card success"><div class="stat-value">${stats.success}</div><div class="stat-label">Success</div></div>
      <div class="stat-card returning"><div class="stat-value">${stats.returning}</div><div class="stat-label">Returning</div></div>
      <div class="stat-card fail"><div class="stat-value">${stats.fail}</div><div class="stat-label">Failed</div></div>
    </div>

    <div class="filter-tabs">
      <span class="filter-tab ${state.dealFilter === "all" ? "active" : ""}" onclick="filterDeals('all')">All <span class="count">${deals.length}</span></span>
      <span class="filter-tab ${state.dealFilter === "pending" ? "active" : ""}" onclick="filterDeals('pending')">Pending <span class="count">${stats.pending}</span></span>
      <span class="filter-tab ${state.dealFilter === "on_delivery" ? "active" : ""}" onclick="filterDeals('on_delivery')">On Delivery <span class="count">${stats.on_delivery}</span></span>
      <span class="filter-tab ${state.dealFilter === "success" ? "active" : ""}" onclick="filterDeals('success')">Success <span class="count">${stats.success}</span></span>
      <span class="filter-tab ${state.dealFilter === "returning" ? "active" : ""}" onclick="filterDeals('returning')">Returning <span class="count">${stats.returning}</span></span>
      <span class="filter-tab ${state.dealFilter === "fail" ? "active" : ""}" onclick="filterDeals('fail')">Failed <span class="count">${stats.fail}</span></span>
    </div>

    <div id="deals-list">
      ${
        filtered.length === 0
          ? '<div class="empty-state"><div class="icon">📋</div><p>No deals found</p></div>'
          : filtered.map((d) => renderDealCard(d)).join("")
      }
    </div>
  `;
}

function renderDealCard(d) {
  const statusLabel = d.status.replace("_", " ");
  return `
    <div class="deal-card" onclick="viewDeal('${d.id}')">
      <div class="deal-card-header">
        <span class="deal-card-customer">${d.customer_name || "No customer"}</span>
        <span class="badge badge-${d.status}">${statusLabel}</span>
      </div>
      <div class="deal-card-details">
        <span>Table: ${d.table_width_cm}x${d.table_length_cm}cm</span>
        <span>${d.wood_type_name || "No wood"} ${d.leg_type_name ? "• " + d.leg_type_name : ""}</span>
        <span class="deal-card-total">${fmtCurrency(d.total)}</span>
      </div>
    </div>
  `;
}

function filterDeals(status) {
  state.dealFilter = status;
  renderPage();
}

async function viewDeal(id) {
  const deal = await API.get(`/api/deals/${id}`);
  const statusLabel = deal.status.replace("_", " ");

  const overlay = document.getElementById("modal-overlay");
  overlay.innerHTML = `
    <div class="modal" style="max-width:700px">
      <div class="modal-header">
        <h2>Deal Details</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <h3>${deal.customer_name || "No customer"}</h3>
          <span style="color:var(--gray-500);font-size:13px">${deal.customer_phone || ""} ${deal.customer_address ? "• " + deal.customer_address : ""}</span>
        </div>
        <select class="status-select badge badge-${deal.status}" onchange="changeDealStatus('${deal.id}', this.value)" style="font-size:13px;padding:6px 12px">
          <option value="pending" ${deal.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="on_delivery" ${deal.status === "on_delivery" ? "selected" : ""}>On Delivery</option>
          <option value="success" ${deal.status === "success" ? "selected" : ""}>Success</option>
          <option value="returning" ${deal.status === "returning" ? "selected" : ""}>Returning</option>
          <option value="fail" ${deal.status === "fail" ? "selected" : ""}>Failed</option>
        </select>
      </div>

      <div class="card" style="background:var(--gray-50)">
        <div class="detail-grid">
          <div class="detail-item"><label>Table Size</label><div class="value">${deal.table_width_cm} x ${deal.table_length_cm} cm (${deal.table_area_m2.toFixed(4)} m²)</div></div>
          <div class="detail-item"><label>Wood Type</label><div class="value">${deal.wood_type_name || "None"} (${fmt(deal.wood_price_per_m2)}/m²)</div></div>
          <div class="detail-item"><label>Legs</label><div class="value">${deal.leg_type_name || "None"} x${deal.leg_qty} (${fmt(deal.leg_price_each)} each)</div></div>
          <div class="detail-item"><label>Chairs</label><div class="value">${deal.chair_type_name || "None"} x${deal.chair_qty} (${fmt(deal.chair_price_each)} each)</div></div>
        </div>
      </div>

      <div class="card" style="background:var(--gray-50)">
        <div class="price-line"><span class="label">Wood</span><span>${fmtCurrency(deal.wood_total)}</span></div>
        <div class="price-line"><span class="label">Legs</span><span>${fmtCurrency(deal.leg_total)}</span></div>
        <div class="price-line"><span class="label">Chairs</span><span>${fmtCurrency(deal.chair_total)}</span></div>
        <div class="price-line"><span class="label">Extra Fee</span><span>${fmtCurrency(deal.extra_fee)}${deal.extra_fee_note ? " (" + deal.extra_fee_note + ")" : ""}</span></div>
        <hr class="section-divider">
        <div class="price-line"><span class="label">Subtotal</span><span>${fmtCurrency(deal.subtotal)}</span></div>
        <div class="price-line"><span class="label">Discount (${deal.discount_percent}%)</span><span>-${fmtCurrency(deal.discount_amount)}</span></div>
        <div class="price-line"><span class="label">Shipping</span><span>${fmtCurrency(deal.shipping_fee)}</span></div>
        <div class="price-line total"><span class="label">TOTAL</span><span>${fmtCurrency(deal.total)}</span></div>
      </div>

      ${deal.notes ? `<div class="card" style="background:var(--gray-50)"><div class="card-title">Notes</div><p style="font-size:14px">${deal.notes}</p></div>` : ""}

      <div class="modal-footer">
        <button class="btn btn-danger btn-sm" onclick="deleteDeal('${deal.id}')">Delete Deal</button>
        <button class="btn btn-outline" onclick="closeModal()">Close</button>
      </div>
    </div>
  `;
  overlay.classList.add("active");
}

async function changeDealStatus(id, status) {
  const { ok } = await API.put(`/api/deals/${id}/status`, { status });
  if (ok) {
    showToast(`Status updated to ${status.replace("_", " ")}`);
    closeModal();
    renderPage();
  } else {
    showToast("Failed to update status", "error");
  }
}

async function deleteDeal(id) {
  if (!confirm("Are you sure you want to delete this deal?")) return;
  const { ok } = await API.del(`/api/deals/${id}`);
  if (ok) {
    showToast("Deal deleted");
    closeModal();
    renderPage();
  } else {
    showToast("Failed to delete deal", "error");
  }
}

// ── Customers Page ──

async function renderCustomers(container) {
  const customers = await API.get("/api/customers");
  state.customers = customers;

  container.innerHTML = `
    <div class="page-header">
      <h1>Customers</h1>
    </div>
    ${
      customers.length === 0
        ? '<div class="empty-state"><div class="icon">👥</div><p>No customers yet. Create a deal first.</p></div>'
        : customers
            .map(
              (c) => `
      <div class="customer-card">
        <div class="customer-header">
          <div>
            <div class="customer-name">${c.customer_name}</div>
            <span style="font-size:13px;color:var(--gray-500)">${c.customer_phone || ""} ${c.customer_address ? "• " + c.customer_address : ""}</span>
          </div>
          <span style="font-size:16px;font-weight:600;color:var(--primary)">${fmtCurrency(c.total_spent)}</span>
        </div>
        <div class="customer-stats">
          <span>${c.deal_count} deal(s)</span>
          <span>${c.active_deals} active</span>
          <span>${c.completed_deals} completed</span>
        </div>
      </div>
    `
            )
            .join("")
    }
  `;
}

// ── Component Manager (Wood / Legs / Chairs) ──

function renderComponentManager(container, type) {
  const config = {
    wood: {
      title: "Wood Types",
      items: state.woodTypes,
      apiPath: "/api/wood-types",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        {
          key: "price_per_m2",
          label: "Price per m²",
          type: "number",
          required: true,
        },
        {
          key: "cost_per_m2",
          label: "Cost per m²",
          type: "number",
          required: false,
        },
        {
          key: "description",
          label: "Description",
          type: "text",
          required: false,
        },
      ],
      columns: ["Name", "Price/m²", "Cost/m²", "Description", "Actions"],
      renderRow: (item) => `
        <td>${item.name}</td>
        <td>${fmt(item.price_per_m2)}</td>
        <td>${fmt(item.cost_per_m2)}</td>
        <td>${item.description || "-"}</td>
      `,
    },
    legs: {
      title: "Leg Types",
      items: state.legTypes,
      apiPath: "/api/leg-types",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "price", label: "Price (each)", type: "number", required: true },
        {
          key: "cost_price",
          label: "Cost Price",
          type: "number",
          required: false,
        },
        {
          key: "description",
          label: "Description",
          type: "text",
          required: false,
        },
      ],
      columns: ["Name", "Price", "Cost", "Description", "Actions"],
      renderRow: (item) => `
        <td>${item.name}</td>
        <td>${fmt(item.price)}</td>
        <td>${fmt(item.cost_price)}</td>
        <td>${item.description || "-"}</td>
      `,
    },
    chairs: {
      title: "Chair Types",
      items: state.chairTypes,
      apiPath: "/api/chair-types",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "price", label: "Price (each)", type: "number", required: true },
        {
          key: "cost_price",
          label: "Cost Price",
          type: "number",
          required: false,
        },
        {
          key: "description",
          label: "Description",
          type: "text",
          required: false,
        },
      ],
      columns: ["Name", "Price", "Cost", "Description", "Actions"],
      renderRow: (item) => `
        <td>${item.name}</td>
        <td>${fmt(item.price)}</td>
        <td>${fmt(item.cost_price)}</td>
        <td>${item.description || "-"}</td>
      `,
    },
  };

  const cfg = config[type];

  container.innerHTML = `
    <div class="page-header">
      <h1>${cfg.title}</h1>
      <button class="btn btn-primary" onclick="openComponentModal('${type}')">+ Add</button>
    </div>
    <div class="card">
      ${
        cfg.items.length === 0
          ? `<div class="empty-state"><div class="icon">📦</div><p>No ${cfg.title.toLowerCase()} yet</p></div>`
          : `
        <table class="data-table">
          <thead><tr>${cfg.columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
          <tbody>
            ${cfg.items
              .map(
                (item) => `
              <tr>
                ${cfg.renderRow(item)}
                <td class="actions">
                  <button class="btn btn-outline btn-sm" onclick="openComponentModal('${type}', '${item.id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteComponent('${type}', '${item.id}')">Delete</button>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `
      }
    </div>
  `;
}

function openComponentModal(type, editId) {
  const config = {
    wood: {
      title: "Wood Type",
      items: state.woodTypes,
      apiPath: "/api/wood-types",
      fields: [
        { key: "name", label: "Name", type: "text" },
        { key: "price_per_m2", label: "Price per m²", type: "number" },
        { key: "cost_per_m2", label: "Cost per m²", type: "number" },
        { key: "description", label: "Description", type: "text" },
      ],
    },
    legs: {
      title: "Leg Type",
      items: state.legTypes,
      apiPath: "/api/leg-types",
      fields: [
        { key: "name", label: "Name", type: "text" },
        { key: "price", label: "Price (each)", type: "number" },
        { key: "cost_price", label: "Cost Price", type: "number" },
        { key: "description", label: "Description", type: "text" },
      ],
    },
    chairs: {
      title: "Chair Type",
      items: state.chairTypes,
      apiPath: "/api/chair-types",
      fields: [
        { key: "name", label: "Name", type: "text" },
        { key: "price", label: "Price (each)", type: "number" },
        { key: "cost_price", label: "Cost Price", type: "number" },
        { key: "description", label: "Description", type: "text" },
      ],
    },
  };

  const cfg = config[type];
  const existing = editId ? cfg.items.find((i) => i.id === editId) : null;
  const isEdit = !!existing;

  const overlay = document.getElementById("modal-overlay");
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${isEdit ? "Edit" : "Add"} ${cfg.title}</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      ${cfg.fields
        .map(
          (f) => `
        <div class="form-group">
          <label>${f.label}</label>
          <input type="${f.type}" class="form-control" id="comp-${f.key}"
            value="${isEdit ? existing[f.key] || "" : ""}"
            ${f.type === "number" ? 'min="0" step="any"' : ""}>
        </div>
      `
        )
        .join("")}
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveComponent('${type}', ${isEdit ? `'${editId}'` : "null"})">
          ${isEdit ? "Update" : "Create"}
        </button>
      </div>
    </div>
  `;
  overlay.classList.add("active");
}

async function saveComponent(type, editId) {
  const config = {
    wood: {
      apiPath: "/api/wood-types",
      fields: ["name", "price_per_m2", "cost_per_m2", "description"],
    },
    legs: {
      apiPath: "/api/leg-types",
      fields: ["name", "price", "cost_price", "description"],
    },
    chairs: {
      apiPath: "/api/chair-types",
      fields: ["name", "price", "cost_price", "description"],
    },
  };

  const cfg = config[type];
  const payload = {};
  for (const key of cfg.fields) {
    const el = document.getElementById(`comp-${key}`);
    payload[key] = el ? el.value : "";
  }

  if (!payload.name || !payload.name.trim()) {
    showToast("Name is required", "error");
    return;
  }

  let result;
  if (editId) {
    result = await API.put(`${cfg.apiPath}/${editId}`, payload);
  } else {
    result = await API.post(cfg.apiPath, payload);
  }

  if (result.ok) {
    showToast(editId ? "Updated!" : "Created!");
    closeModal();
    await loadComponentData();
    renderPage();
  } else {
    showToast(result.data.error || "Failed to save", "error");
  }
}

async function deleteComponent(type, id) {
  if (!confirm("Delete this item?")) return;
  const paths = {
    wood: "/api/wood-types",
    legs: "/api/leg-types",
    chairs: "/api/chair-types",
  };
  const { ok } = await API.del(`${paths[type]}/${id}`);
  if (ok) {
    showToast("Deleted!");
    await loadComponentData();
    renderPage();
  } else {
    showToast("Failed to delete", "error");
  }
}

// ── Modal Helpers ──

function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("active");
  overlay.innerHTML = "";
}

// ── Init ──

async function init() {
  await loadComponentData();
  navigate("calculator");

  document.querySelectorAll("[data-page]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.page));
  });
}

document.addEventListener("DOMContentLoaded", init);
