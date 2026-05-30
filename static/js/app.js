const API = "/api/products";
let allProducts = [];
let allCombos = [];
let allCustomers = [];
let allDeals = [];
let cart = [];
let searchTimeout = null;
let customerSearchTimeout = null;
let selectedCustomerId = null;

function formatVND(n) { return Number(n).toLocaleString("vi-VN") + "₫"; }

function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

const STATUS_MAP = {
    pending: { label: "Chờ xử lý", cls: "badge-pending" },
    confirmed: { label: "Đã xác nhận", cls: "badge-confirmed" },
    processing: { label: "Đang xử lý", cls: "badge-processing" },
    shipping: { label: "Đang giao", cls: "badge-shipping" },
    delivered: { label: "Đã giao", cls: "badge-delivered" },
    completed: { label: "Hoàn thành", cls: "badge-completed" },
    cancelled: { label: "Đã huỷ", cls: "badge-cancelled" },
    returning: { label: "Hoàn trả", cls: "badge-returning" },
    refunded: { label: "Hoàn tiền", cls: "badge-refunded" },
};
function statusBadge(s) { const m = STATUS_MAP[s] || { label: s, cls: "badge-refunded" }; return `<span class="badge-status ${m.cls}">${m.label}</span>`; }

const AVATAR_COLORS = ["#2563eb","#7c3aed","#db2777","#dc2626","#ea580c","#16a34a","#0891b2","#4f46e5"];
function avatarColor(name) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    loadPendingCount();
});

// ===== NAVIGATION =====
function go(view) {
    ["dashboard", "products", "orders", "customers", "customTable"].forEach(v => {
        const el = document.getElementById("view-" + v);
        if (el) el.style.display = "none";
        const nav = document.getElementById("nav-" + v);
        if (nav) nav.classList.remove("active");
    });
    const el = document.getElementById("view-" + view);
    if (el) el.style.display = "block";
    const nav = document.getElementById("nav-" + view);
    if (nav) nav.classList.add("active");

    if (view === "dashboard") loadDashboard();
    else if (view === "products") { applyShopFilters(); }
    else if (view === "orders") loadDeals();
    else if (view === "customers") loadCustomers();
    else if (view === "customTable") loadCustomTableData();
}

// ===== DASHBOARD =====
async function loadDashboard() {
    const [statsRes, dealsRes] = await Promise.all([
        fetch("/api/deals/stats"),
        fetch("/api/deals")
    ]);
    const stats = await statsRes.json();
    allDeals = await dealsRes.json();

    document.getElementById("statsRow").innerHTML = `
        <div class="stat-card"><div class="stat-label">Tổng doanh thu</div><div class="stat-value">${formatVND(stats.total_revenue || 0)}</div></div>
        <div class="stat-card"><div class="stat-label">Lợi nhuận</div><div class="stat-value" style="color:var(--success)">${formatVND(stats.total_profit || 0)}</div></div>
        <div class="stat-card"><div class="stat-label">Tổng đơn</div><div class="stat-value">${stats.total_deals || 0}</div></div>
        <div class="stat-card"><div class="stat-label">Chờ xử lý</div><div class="stat-value" style="color:var(--warning)">${stats.pending || 0}</div></div>
        <div class="stat-card"><div class="stat-label">Đang giao</div><div class="stat-value" style="color:var(--info)">${(stats.shipping || 0) + (stats.processing || 0)}</div></div>
        <div class="stat-card"><div class="stat-label">Hoàn thành</div><div class="stat-value" style="color:var(--success)">${(stats.completed || 0) + (stats.delivered || 0)}</div></div>
    `;

    const recent = allDeals.slice(0, 5);
    const container = document.getElementById("recentDeals");
    if (recent.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="bi bi-receipt"></i><p>Chưa có đơn hàng nào</p></div>`;
        return;
    }
    container.innerHTML = `<table class="table table-hover mb-0"><tbody>` + recent.map(d => {
        const date = new Date(d.created_at).toLocaleDateString("vi-VN");
        return `<tr class="cursor-pointer" onclick="showDealDetail('${d.id}')" style="cursor:pointer">
            <td><span class="fw-600">${escapeHtml(d.customer_name || "Khách mới")}</span><br><small class="text-muted">${date}</small></td>
            <td class="text-end">${statusBadge(d.status)}</td>
            <td class="text-end fw-600">${formatVND(d.total)}</td>
        </tr>`;
    }).join("") + `</tbody></table>`;
}

// ===== PRODUCTS =====
function showProductTab(tab) {
    ["shop", "manage", "combos", "categories"].forEach(t => {
        document.getElementById("ptab-" + t).classList.toggle("active", t === tab);
        const content = document.getElementById("ptab" + t + "-content");
        if (content) content.style.display = t === tab ? "block" : "none";
    });
    if (tab === "shop") applyShopFilters();
    else if (tab === "manage") applyFilters();
    else if (tab === "combos") loadCombos();
    else if (tab === "categories") loadCategories();
}

async function loadProducts() {
    const [pRes, cRes, catRes] = await Promise.all([fetch(API), fetch("/api/combos"), fetch("/api/categories")]);
    allProducts = await pRes.json();
    allCombos = await cRes.json();
    allCategories = await catRes.json();
    populateCategoryFilter();
    populateShopCategoryFilter();
    applyShopFilters();
}

function populateCategoryFilter() {
    const sel = document.getElementById("categoryFilter");
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Tất cả</option>' + allCategories.map(c => `<option value="${c.name}"${c.name === cur ? " selected" : ""}>${c.name}</option>`).join("");
}
function populateShopCategoryFilter() {
    const sel = document.getElementById("shopCategoryFilter");
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Tất cả danh mục</option>' + allCategories.map(c => `<option value="${c.name}"${c.name === cur ? " selected" : ""}>${c.name}</option>`).join("");
}

function applyFilters() {
    const search = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const category = document.getElementById("categoryFilter")?.value || "";
    let filtered = allProducts.filter(p => {
        if (search && !p.name.toLowerCase().includes(search) && !(p.category || "").toLowerCase().includes(search) && !(p.size || "").toLowerCase().includes(search) && !(p.color || "").toLowerCase().includes(search)) return false;
        if (category && p.category !== category) return false;
        return true;
    });
    renderProducts(filtered);
}

function clearFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("categoryFilter").value = "";
    applyFilters();
}

function renderProducts(products) {
    const tbody = document.getElementById("productTableBody");
    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="bi bi-inbox fs-3 d-block mb-2"></i>Không tìm thấy sản phẩm</td></tr>`;
        return;
    }
    tbody.innerHTML = products.map(p => `<tr>
        <td class="fw-600">${escapeHtml(p.name)}</td>
        <td>${p.category ? `<span class="badge-cat">${escapeHtml(p.category)}</span>` : "—"}</td>
        <td>${p.size ? escapeHtml(p.size) : "—"}</td>
        <td>${p.color ? escapeHtml(p.color) : "—"}</td>
        <td class="text-end fw-600">${formatVND(p.price)}</td>
        <td class="text-end text-muted">${p.cost_price ? formatVND(p.cost_price) : "—"}</td>
        <td class="text-center">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="showEditModal('${p.id}')" title="Sửa"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="showDeleteModal('${p.id}','${escapeHtml(p.name)}')" title="Xoá"><i class="bi bi-trash"></i></button>
        </td>
    </tr>`).join("");
}

function applyShopFilters() {
    const search = (document.getElementById("shopSearch")?.value || "").trim().toLowerCase();
    const category = document.getElementById("shopCategoryFilter")?.value || "";
    let filtered = allProducts.filter(p => {
        if (search && !p.name.toLowerCase().includes(search) && !(p.category || "").toLowerCase().includes(search)) return false;
        if (category && p.category !== category) return false;
        return true;
    });

    let comboHtml = "";
    let filteredCombos = allCombos;
    if (search) filteredCombos = allCombos.filter(c => c.name.toLowerCase().includes(search) || c.items.some(i => i.product_name.toLowerCase().includes(search)));
    if (filteredCombos.length > 0) {
        comboHtml = `<div class="col-12 mb-2"><h6 class="text-muted fw-600">Gói sản phẩm</h6></div>` +
            filteredCombos.map(c => renderComboCard(c)).join("") +
            `<div class="col-12 mt-3 mb-2"><h6 class="text-muted fw-600">Sản phẩm đơn lẻ</h6></div>`;
    }

    const grid = document.getElementById("shopGrid");
    if (filtered.length === 0 && !comboHtml) {
        grid.innerHTML = `<div class="empty-state"><i class="bi bi-inbox"></i><p>Không tìm thấy sản phẩm</p></div>`;
        return;
    }
    grid.innerHTML = comboHtml + filtered.map(p => renderShopCard(p)).join("");
}

function renderShopCard(p) {
    return `<div class="shop-item">
        <div class="shop-item-name">${escapeHtml(p.name)}</div>
        <div class="shop-item-meta">${p.category ? escapeHtml(p.category) : ""}${p.size ? " · " + escapeHtml(p.size) : ""}${p.color ? " · " + escapeHtml(p.color) : ""}</div>
        <div class="shop-item-price">${formatVND(p.price)}</div>
        <button class="btn btn-sm btn-warning" onclick="addToCart('${p.id}')"><i class="bi bi-cart-plus me-1"></i>Thêm</button>
    </div>`;
}

function renderComboCard(c) {
    const saving = c.original_price - c.combo_price;
    const pct = c.original_price > 0 ? ((saving / c.original_price) * 100).toFixed(0) : 0;
    const items = c.items.map(i => `${i.product_name} ×${i.qty}`).join(", ");
    return `<div class="shop-item combo-item">
        <div class="shop-item-name">${escapeHtml(c.name)}</div>
        <div class="shop-item-meta">${escapeHtml(items)}</div>
        <div class="d-flex align-items-center gap-2">
            <div class="shop-item-price">${formatVND(c.combo_price)}</div>
            ${pct > 0 ? `<span class="badge-status badge-pending">-${pct}%</span>` : ""}
        </div>
        <button class="btn btn-sm btn-warning" onclick="addComboToCart('${c.id}')"><i class="bi bi-cart-plus me-1"></i>Thêm</button>
    </div>`;
}

// ===== PRODUCT CRUD =====
function populateProductCategoryDropdown(selected) {
    const sel = document.getElementById("productCategory");
    sel.innerHTML = '<option value="">-- Chọn danh mục --</option>' + allCategories.map(c => `<option value="${c.name}"${c.name === selected ? " selected" : ""}>${c.name}</option>`).join("");
}
function showAddModal() {
    document.getElementById("productModalTitle").textContent = "Thêm sản phẩm";
    document.getElementById("productId").value = "";
    document.getElementById("productName").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productCostPrice").value = "";
    document.getElementById("productSize").value = "";
    document.getElementById("productColor").value = "";
    document.getElementById("productImageUrl").value = "";
    document.getElementById("productDescription").value = "";
    populateProductCategoryDropdown("");
    new bootstrap.Modal(document.getElementById("productModal")).show();
}
function showEditModal(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    document.getElementById("productModalTitle").textContent = "Sửa sản phẩm";
    document.getElementById("productId").value = p.id;
    document.getElementById("productName").value = p.name;
    document.getElementById("productPrice").value = p.price;
    document.getElementById("productCostPrice").value = p.cost_price || "";
    populateProductCategoryDropdown(p.category || "");
    document.getElementById("productSize").value = p.size || "";
    document.getElementById("productColor").value = p.color || "";
    document.getElementById("productImageUrl").value = p.image_url || "";
    document.getElementById("productDescription").value = p.description || "";
    new bootstrap.Modal(document.getElementById("productModal")).show();
}
async function saveProduct() {
    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value.trim();
    const price = document.getElementById("productPrice").value;
    const category = document.getElementById("productCategory").value.trim();
    if (!name || !price || !category) { showToast("Tên, giá và danh mục là bắt buộc", "danger"); return; }
    const body = {
        name, price: parseFloat(price),
        cost_price: parseFloat(document.getElementById("productCostPrice").value) || 0,
        category,
        size: document.getElementById("productSize").value.trim(),
        color: document.getElementById("productColor").value.trim(),
        image_url: document.getElementById("productImageUrl").value.trim(),
        description: document.getElementById("productDescription").value.trim(),
    };
    const res = await fetch(id ? `${API}/${id}` : API, { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { showToast((await res.json()).error || "Lỗi", "danger"); return; }
    bootstrap.Modal.getInstance(document.getElementById("productModal")).hide();
    showToast(id ? "Đã cập nhật" : "Đã tạo sản phẩm", "success");
    loadProducts();
}
function showDeleteModal(id, name) {
    document.getElementById("deleteProductName").textContent = name;
    const modal = new bootstrap.Modal(document.getElementById("deleteModal"));
    document.getElementById("confirmDeleteBtn").onclick = async () => {
        const res = await fetch(`${API}/${id}`, { method: "DELETE" });
        if (res.ok) { modal.hide(); showToast("Đã xoá", "success"); loadProducts(); }
    };
    modal.show();
}
function showImportModal() {
    const fi = document.getElementById("importFile");
    const ji = document.getElementById("jsonInput");
    const ir = document.getElementById("importResults");
    if (fi) fi.value = "";
    if (ji) ji.value = "";
    if (ir) ir.classList.add("d-none");
    const modal = document.getElementById("importModal");
    if (modal) new bootstrap.Modal(modal).show();
}
async function importProducts() {
    const fileInput = document.getElementById("importFile");
    const jsonInput = document.getElementById("jsonInput").value.trim();
    const isFile = document.querySelector("#importModal .nav-link.active")?.getAttribute("data-bs-target") === "#fileTab";
    let res;
    if (isFile && fileInput.files.length > 0) {
        const fd = new FormData(); fd.append("file", fileInput.files[0]);
        res = await fetch(`${API}/import`, { method: "POST", body: fd });
    } else if (!isFile && jsonInput) {
        try { JSON.parse(jsonInput); } catch { showToast("JSON không hợp lệ", "danger"); return; }
        res = await fetch(`${API}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: jsonInput });
    } else { showToast("Chọn file hoặc dán JSON", "danger"); return; }
    const data = await res.json();
    const results = document.getElementById("importResults");
    const alert = document.getElementById("importAlert");
    results.classList.remove("d-none");
    if (data.imported > 0) {
        alert.className = "alert alert-success"; alert.innerHTML = `<i class="bi bi-check-circle me-1"></i>Đã nhập ${data.imported} sản phẩm`;
        loadProducts();
    } else {
        alert.className = "alert alert-danger"; alert.innerHTML = data.error ? escapeHtml(data.error) : "Không nhập được sản phẩm nào";
    }
}

// ===== CART =====
function toggleCart() {
    const s = document.getElementById("cartSidebar");
    const o = document.getElementById("cartOverlay");
    const open = s.classList.toggle("open");
    o.classList.toggle("open", open);
}
function addToCart(pid) {
    const p = allProducts.find(x => x.id === pid);
    if (!p) return;
    const ex = cart.find(i => i.id === pid);
    if (ex) ex.qty++; else cart.push({ id: p.id, name: p.name, price: p.price, cost_price: p.cost_price || 0, qty: 1 });
    renderCart(); showToast(`${p.name} đã thêm vào giỏ`, "success");
}
function addComboToCart(cid) {
    const c = allCombos.find(x => x.id === cid);
    if (!c) return;
    const cartId = `combo_${cid}`;
    const ex = cart.find(i => i.id === cartId);
    if (ex) ex.qty++; else cart.push({ id: cartId, name: `[GÓI] ${c.name}`, price: c.combo_price, cost_price: c.cost_total || 0, qty: 1 });
    renderCart(); showToast(`Gói "${c.name}" đã thêm`, "success");
}
function removeFromCart(pid) { cart = cart.filter(i => i.id !== pid); renderCart(); }
function updateCartQty(pid, d) { const i = cart.find(x => x.id === pid); if (!i) return; i.qty += d; if (i.qty <= 0) cart = cart.filter(x => x.id !== pid); renderCart(); }
function setCartQty(pid, v) { const q = parseInt(v, 10); if (isNaN(q) || q <= 0) cart = cart.filter(x => x.id !== pid); else { const i = cart.find(x => x.id === pid); if (i) i.qty = q; } renderCart(); }
function clearCart() { cart = []; document.getElementById("discountInput").value = 0; document.getElementById("shippingInput").value = 0; renderCart(); showToast("Đã xoá giỏ hàng", "success"); }

function renderCart() {
    const body = document.getElementById("cartBody");
    const footer = document.getElementById("cartFooter");
    const totalItems = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById("cartCount").textContent = totalItems;
    const shopCount = document.getElementById("shopCartCount");
    if (shopCount) shopCount.textContent = totalItems;

    if (cart.length === 0) {
        body.innerHTML = `<div class="empty-state"><i class="bi bi-cart-x"></i><p>Giỏ hàng trống</p></div>`;
        footer.style.display = "none"; return;
    }
    footer.style.display = "block";
    let sub = 0, cost = 0;
    body.innerHTML = cart.map(item => {
        const line = item.price * item.qty; sub += line; cost += (item.cost_price || 0) * item.qty;
        const detailsHtml = (item.details && item.details.length > 0)
            ? `<div class="mt-1" style="font-size:.7rem;color:var(--text-3)">${item.details.map(d => `<div>· ${escapeHtml(d)}</div>`).join("")}</div>`
            : "";
        return `<div class="cart-item">
            <div class="d-flex justify-content-between align-items-start">
                <strong class="me-2" style="font-size:.82rem">${escapeHtml(item.name)}</strong>
                <button class="btn btn-sm p-0 border-0 text-muted" onclick="removeFromCart('${item.id}')"><i class="bi bi-x"></i></button>
            </div>
            ${detailsHtml}
            <div class="d-flex justify-content-between align-items-center mt-1">
                <div class="input-group input-group-sm" style="width:100px">
                    <button class="btn btn-outline-secondary btn-sm" onclick="updateCartQty('${item.id}',-1)">-</button>
                    <input type="number" class="form-control form-control-sm text-center" value="${item.qty}" min="1" onchange="setCartQty('${item.id}',this.value)" style="max-width:40px">
                    <button class="btn btn-outline-secondary btn-sm" onclick="updateCartQty('${item.id}',1)">+</button>
                </div>
                <span class="fw-600" style="font-size:.82rem">${formatVND(line)}</span>
            </div>
            <small class="text-muted">${formatVND(item.price)}/cái</small>
        </div>`;
    }).join("");

    const discPct = parseFloat(document.getElementById("discountInput").value) || 0;
    const discAmt = sub * (discPct / 100);
    const ship = parseFloat(document.getElementById("shippingInput").value) || 0;
    const total = sub - discAmt + ship;
    const profit = total - cost;

    document.getElementById("cartItemCount").textContent = totalItems;
    document.getElementById("cartSubtotal").textContent = formatVND(sub);
    const discRow = document.getElementById("discountRow");
    if (discPct > 0) { discRow.style.setProperty("display", "flex", "important"); document.getElementById("cartDiscount").textContent = "-" + formatVND(discAmt); }
    else discRow.style.setProperty("display", "none", "important");
    document.getElementById("cartTotal").textContent = formatVND(total);
    document.getElementById("cartProfit").textContent = formatVND(profit);
    document.getElementById("cartProfit").className = `fw-600 ${profit >= 0 ? "text-success" : "text-danger"}`;
    const margin = total > 0 ? (profit / total * 100).toFixed(1) : 0;
    document.getElementById("cartMargin").textContent = margin + "%";
    document.getElementById("cartMargin").className = `small fw-600 ${profit >= 0 ? "text-success" : "text-danger"}`;
}

// ===== DEAL SUMMARY =====
function showDealSummary() {
    if (cart.length === 0) return;
    const discPct = parseFloat(document.getElementById("discountInput").value) || 0;
    let sub = 0;
    const rows = cart.map(item => { const l = item.price * item.qty; sub += l; return `<tr><td>${escapeHtml(item.name)}</td><td class="text-center">${item.qty}</td><td class="text-end">${formatVND(item.price)}</td><td class="text-end">${formatVND(l)}</td></tr>`; }).join("");
    const discAmt = sub * (discPct / 100);
    const ship = parseFloat(document.getElementById("shippingInput").value) || 0;
    const total = sub - discAmt + ship;
    const date = new Date().toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric" });
    document.getElementById("dealSummaryBody").innerHTML = `<div id="dealPrintArea">
        <div class="text-center mb-3"><h5 class="fw-bold">Báo giá đơn hàng</h5><small class="text-muted">${date}</small></div>
        <table class="table table-bordered"><thead class="table-light"><tr><th>Sản phẩm</th><th class="text-center" style="width:70px">SL</th><th class="text-end" style="width:110px">Đơn giá</th><th class="text-end" style="width:110px">Thành tiền</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
            <tr><td colspan="3" class="text-end fw-600">Tạm tính</td><td class="text-end fw-600">${formatVND(sub)}</td></tr>
            ${discPct > 0 ? `<tr><td colspan="3" class="text-end text-danger">Giảm ${discPct}%</td><td class="text-end text-danger">-${formatVND(discAmt)}</td></tr>` : ""}
            ${ship > 0 ? `<tr><td colspan="3" class="text-end">Phí ship</td><td class="text-end">${formatVND(ship)}</td></tr>` : ""}
            <tr class="table-primary"><td colspan="3" class="text-end fw-bold">Tổng cộng</td><td class="text-end fw-bold">${formatVND(total)}</td></tr>
        </tfoot></table></div>`;
    new bootstrap.Modal(document.getElementById("dealSummaryModal")).show();
}
function printDealSummary() {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Tóm tắt</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{padding:2rem;font-size:13px}@media print{body{padding:0}}</style></head><body>${document.getElementById("dealPrintArea").innerHTML}</body></html>`);
    w.document.close(); w.onload = () => w.print();
}

// ===== CHECKOUT =====
function showCheckoutModal() {
    if (cart.length === 0) return;
    selectedCustomerId = null;
    document.getElementById("checkoutPhoneSearch").value = "";
    document.getElementById("checkoutName").value = "";
    document.getElementById("checkoutPhone").value = "";
    document.getElementById("checkoutAddress").value = "";
    document.getElementById("checkoutNotes").value = "";
    document.getElementById("customerSearchResults").style.display = "none";

    const discPct = parseFloat(document.getElementById("discountInput").value) || 0;
    const ship = parseFloat(document.getElementById("shippingInput").value) || 0;
    let sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const discAmt = sub * (discPct / 100);
    const total = sub - discAmt + ship;
    const items = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById("checkoutSummary").innerHTML = `<strong>${items} sản phẩm</strong> | Tạm tính: ${formatVND(sub)}${discPct > 0 ? ` | Giảm: ${discPct}%` : ""}${ship > 0 ? ` | Ship: ${formatVND(ship)}` : ""} | <strong>Tổng: ${formatVND(total)}</strong>`;
    toggleCart();
    new bootstrap.Modal(document.getElementById("checkoutModal")).show();
}

function debounceSearchCustomer() {
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(searchCheckoutCustomer, 300);
}
async function searchCheckoutCustomer() {
    const q = document.getElementById("checkoutPhoneSearch").value.trim();
    const box = document.getElementById("customerSearchResults");
    if (q.length < 2) { box.style.display = "none"; return; }
    const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
    const results = await res.json();
    if (results.length === 0) { box.style.display = "none"; return; }
    box.innerHTML = results.map(c => `<div class="search-result-item" onclick="selectCheckoutCustomer('${c.id}','${escapeHtml(c.name).replace(/'/g,"\\'")}','${escapeHtml(c.phone || "").replace(/'/g,"\\'")}','${escapeHtml(c.address || "").replace(/'/g,"\\'")}')">
        <strong>${escapeHtml(c.name)}</strong><br><small class="text-muted">${escapeHtml(c.phone || "—")} · ${escapeHtml(c.address || "—")}</small>
    </div>`).join("");
    box.style.display = "block";
}
function selectCheckoutCustomer(id, name, phone, address) {
    selectedCustomerId = id;
    document.getElementById("checkoutName").value = name;
    document.getElementById("checkoutPhone").value = phone;
    document.getElementById("checkoutAddress").value = address;
    document.getElementById("customerSearchResults").style.display = "none";
}

async function submitDeal() {
    const name = document.getElementById("checkoutName").value.trim();
    if (!name) { showToast("Tên khách hàng là bắt buộc", "danger"); return; }
    const body = {
        customer_id: selectedCustomerId || "",
        customer_name: name,
        customer_phone: document.getElementById("checkoutPhone").value.trim(),
        customer_address: document.getElementById("checkoutAddress").value.trim(),
        notes: document.getElementById("checkoutNotes").value.trim(),
        discount_pct: parseFloat(document.getElementById("discountInput").value) || 0,
        shipping_fee: parseFloat(document.getElementById("shippingInput").value) || 0,
        items: cart.map(i => ({ product_id: i.id.startsWith("combo_") ? "" : i.id, name: i.name, unit_price: i.price, cost_price: i.cost_price || 0, qty: i.qty, details: (i.details || []).join("\n") })),
    };
    const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { showToast((await res.json()).error || "Lỗi tạo đơn", "danger"); return; }
    bootstrap.Modal.getInstance(document.getElementById("checkoutModal")).hide();
    cart = []; document.getElementById("discountInput").value = 0; document.getElementById("shippingInput").value = 0;
    renderCart(); showToast("Đơn hàng đã tạo — Trạng thái: Chờ xử lý", "success");
    loadPendingCount();
}

// ===== ORDERS =====
async function loadDeals() {
    const status = document.getElementById("dealStatusFilter")?.value || "";
    const url = status ? `/api/deals?status=${status}` : "/api/deals";
    const res = await fetch(url);
    allDeals = await res.json();
    renderDeals(allDeals);
    loadOrderStats();
}
async function loadOrderStats() {
    const res = await fetch("/api/deals/stats");
    const s = await res.json();
    document.getElementById("orderStats").innerHTML = `
        <div class="stat-card"><div class="stat-label">Tổng đơn</div><div class="stat-value">${s.total_deals || 0}</div></div>
        <div class="stat-card"><div class="stat-label">Doanh thu</div><div class="stat-value">${formatVND(s.total_revenue || 0)}</div></div>
        <div class="stat-card"><div class="stat-label">Lợi nhuận</div><div class="stat-value" style="color:var(--success)">${formatVND(s.total_profit || 0)}</div></div>
    `;
}
function renderDeals(deals) {
    const c = document.getElementById("dealsList");
    if (deals.length === 0) { c.innerHTML = `<div class="empty-state"><i class="bi bi-receipt"></i><p>Không có đơn hàng nào</p></div>`; return; }
    c.innerHTML = deals.map(d => {
        const date = new Date(d.created_at).toLocaleDateString("vi-VN");
        const items = d.items.map(i => i.product_name).join(", ");
        return `<div class="deal-card" onclick="showDealDetail('${d.id}')">
            <div class="d-flex justify-content-between align-items-start">
                <div class="min-w-0">
                    <div class="fw-600">${escapeHtml(d.customer_name || "Khách mới")}</div>
                    <small class="text-muted">${d.customer_phone ? escapeHtml(d.customer_phone) + " · " : ""}${date}</small>
                    <div class="text-muted mt-1" style="font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px">${escapeHtml(items)}</div>
                </div>
                <div class="text-end flex-shrink-0 ms-3">
                    ${statusBadge(d.status)}
                    <div class="fw-600 mt-1">${formatVND(d.total)}</div>
                    <small class="text-muted">${d.items.length} SP</small>
                </div>
            </div>
        </div>`;
    }).join("");
}

async function loadPendingCount() {
    const res = await fetch("/api/deals?status=pending");
    const deals = await res.json();
    const b = document.getElementById("pendingCount");
    if (deals.length > 0) { b.textContent = deals.length; b.style.display = "inline"; }
    else b.style.display = "none";
}

async function showDealDetail(dealId) {
    const res = await fetch(`/api/deals/${dealId}`);
    const deal = await res.json();
    if (deal.error) return;
    const date = new Date(deal.created_at).toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric" });
    const rows = deal.items.map(i => {
        const detailsHtml = i.details ? `<div style="font-size:.7rem;color:var(--text-3);white-space:pre-line">${escapeHtml(i.details)}</div>` : "";
        return `<tr><td>${escapeHtml(i.product_name)}${detailsHtml}</td><td class="text-center">${i.qty}</td><td class="text-end">${formatVND(i.unit_price)}</td><td class="text-end">${formatVND(i.line_total)}</td></tr>`;
    }).join("");

    const history = (deal.history || []).map(h => {
        const t = new Date(h.changed_at).toLocaleString("vi-VN");
        return `<div class="history-entry${h.new_status === deal.status ? " current" : ""}">
            <div class="history-dot"></div>
            <div class="history-time">${t}</div>
            <div class="history-text">${statusBadge(h.old_status || "—")} → ${statusBadge(h.new_status)}</div>
            ${h.note ? `<div class="history-note">${escapeHtml(h.note)}</div>` : ""}
        </div>`;
    }).join("");

    document.getElementById("dealDetailBody").innerHTML = `
        <div class="row mb-3">
            <div class="col-md-6">
                <div class="text-muted mb-1" style="font-size:.72rem;text-transform:uppercase;letter-spacing:.04em">Khách hàng</div>
                <div class="fw-600">${escapeHtml(deal.customer_name || "Khách mới")}</div>
                ${deal.customer_phone ? `<div class="text-muted" style="font-size:.82rem"><i class="bi bi-telephone me-1"></i>${escapeHtml(deal.customer_phone)} <a href="https://zalo.me/${deal.customer_phone}" target="_blank" class="btn btn-sm btn-primary py-0 px-2 ms-1"><i class="bi bi-chat-dots-fill me-1"></i>Zalo</a></div>` : ""}
                ${deal.customer_address ? `<div class="text-muted" style="font-size:.82rem"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(deal.customer_address)}</div>` : ""}
                ${deal.notes ? `<div class="text-muted mt-1" style="font-size:.82rem"><i class="bi bi-sticky me-1"></i>${escapeHtml(deal.notes)}</div>` : ""}
            </div>
            <div class="col-md-6 text-md-end">
                ${statusBadge(deal.status)}
                <div class="text-muted mt-1" style="font-size:.82rem">${date}</div>
            </div>
        </div>
        <table class="table table-bordered"><thead class="table-light"><tr><th>Sản phẩm</th><th class="text-center" style="width:70px">SL</th><th class="text-end" style="width:110px">Đơn giá</th><th class="text-end" style="width:110px">Thành tiền</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
            <tr><td colspan="3" class="text-end fw-600">Tạm tính</td><td class="text-end fw-600">${formatVND(deal.subtotal)}</td></tr>
            ${deal.discount_pct > 0 ? `<tr><td colspan="3" class="text-end text-danger">Giảm ${deal.discount_pct}%</td><td class="text-end text-danger">-${formatVND(deal.discount_amt)}</td></tr>` : ""}
            ${(deal.shipping_fee || 0) > 0 ? `<tr><td colspan="3" class="text-end">Phí ship</td><td class="text-end">${formatVND(deal.shipping_fee)}</td></tr>` : ""}
            <tr class="table-primary"><td colspan="3" class="text-end fw-bold">Tổng</td><td class="text-end fw-bold">${formatVND(deal.total)}</td></tr>
        </tfoot></table>
        <div class="profit-section p-2 rounded mb-3">
            <div class="d-flex justify-content-between"><span class="small text-muted">Lợi nhuận:</span><span class="fw-600 ${deal.profit >= 0 ? "text-success" : "text-danger"}">${formatVND(deal.profit)}</span></div>
        </div>
        ${history ? `<div class="mb-2"><div class="text-muted mb-2" style="font-size:.72rem;text-transform:uppercase;letter-spacing:.04em">Lịch sử trạng thái</div><div class="history-timeline">${history}</div></div>` : ""}
    `;

    const statuses = ["pending","confirmed","processing","shipping","delivered","completed","cancelled","returning","refunded"];
    const opts = statuses.map(s => `<option value="${s}" ${s === deal.status ? "selected" : ""}>${STATUS_MAP[s]?.label || s}</option>`).join("");
    document.getElementById("dealDetailFooter").innerHTML = `
        <button class="btn btn-danger btn-sm me-auto" onclick="deleteDeal('${deal.id}')"><i class="bi bi-trash me-1"></i>Xoá</button>
        <div class="input-group" style="width:220px">
            <label class="input-group-text">Trạng thái</label>
            <select class="form-select form-select-sm" onchange="updateDealStatus('${deal.id}',this.value)">${opts}</select>
        </div>`;
    new bootstrap.Modal(document.getElementById("dealDetailModal")).show();
}
async function updateDealStatus(id, status) {
    await fetch(`/api/deals/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    bootstrap.Modal.getInstance(document.getElementById("dealDetailModal")).hide();
    showToast("Đã cập nhật trạng thái", "success"); loadDeals(); loadPendingCount();
}
async function deleteDeal(id) {
    if (!confirm("Xoá đơn hàng này?")) return;
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    bootstrap.Modal.getInstance(document.getElementById("dealDetailModal")).hide();
    showToast("Đã xoá đơn hàng", "success"); loadDeals(); loadPendingCount();
}

// ===== CUSTOMERS =====
async function loadCustomers() {
    const res = await fetch("/api/customers");
    allCustomers = await res.json();
    renderCustomers(allCustomers);
}
function filterCustomers() {
    const q = (document.getElementById("customerSearch")?.value || "").trim().toLowerCase();
    if (!q) { renderCustomers(allCustomers); return; }
    renderCustomers(allCustomers.filter(c => c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)));
}
function renderCustomers(customers) {
    const c = document.getElementById("customersList");
    if (customers.length === 0) { c.innerHTML = `<div class="empty-state"><i class="bi bi-people"></i><p>Chưa có khách hàng nào</p></div>`; return; }
    c.innerHTML = customers.map(cu => {
        const color = avatarColor(cu.name);
        const initial = cu.name.charAt(0).toUpperCase();
        const date = cu.last_order_date ? new Date(cu.last_order_date).toLocaleDateString("vi-VN") : "—";
        return `<div class="customer-item">
            <div class="customer-avatar" style="background:${color}">${initial}</div>
            <div class="customer-info min-w-0">
                <div class="customer-name">${escapeHtml(cu.name)}</div>
                <div class="customer-meta">
                    ${cu.phone ? `<i class="bi bi-telephone me-1"></i>${escapeHtml(cu.phone)}` : ""}
                    ${cu.total_orders ? ` · ${cu.total_orders} đơn` : ""}
                    ${cu.total_spent ? ` · ${formatVND(cu.total_spent)}` : ""}
                    ${date !== "—" ? ` · ${date}` : ""}
                </div>
            </div>
            <div class="customer-actions">
                ${cu.phone ? `<a href="https://zalo.me/${cu.phone}" target="_blank" class="btn btn-sm btn-primary" title="Zalo"><i class="bi bi-chat-dots-fill"></i></a>
                <a href="tel:${cu.phone}" class="btn btn-sm btn-outline-secondary" title="Gọi"><i class="bi bi-telephone"></i></a>` : ""}
                <button class="btn btn-sm btn-outline-primary" onclick="showEditCustomer('${cu.id}')" title="Sửa"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="showDeleteCustomer('${cu.id}','${escapeHtml(cu.name).replace(/'/g,"\\'")}')" title="Xoá"><i class="bi bi-trash"></i></button>
            </div>
        </div>`;
    }).join("");
}
function showAddCustomerModal() {
    document.getElementById("addCustomerModalTitle").textContent = "Thêm khách hàng";
    document.getElementById("editCustId").value = "";
    document.getElementById("editCustName").value = "";
    document.getElementById("editCustPhone").value = "";
    document.getElementById("editCustAddress").value = "";
    document.getElementById("editCustNotes").value = "";
    new bootstrap.Modal(document.getElementById("addCustomerModal")).show();
}
function showEditCustomer(id) {
    const c = allCustomers.find(x => x.id === id);
    if (!c) return;
    document.getElementById("addCustomerModalTitle").textContent = "Sửa khách hàng";
    document.getElementById("editCustId").value = c.id;
    document.getElementById("editCustName").value = c.name;
    document.getElementById("editCustPhone").value = c.phone || "";
    document.getElementById("editCustAddress").value = c.address || "";
    document.getElementById("editCustNotes").value = c.notes || "";
    new bootstrap.Modal(document.getElementById("addCustomerModal")).show();
}
async function saveCustomer() {
    const id = document.getElementById("editCustId").value;
    const name = document.getElementById("editCustName").value.trim();
    if (!name) { showToast("Tên khách hàng là bắt buộc", "danger"); return; }
    const body = { name, phone: document.getElementById("editCustPhone").value.trim(), address: document.getElementById("editCustAddress").value.trim(), notes: document.getElementById("editCustNotes").value.trim() };
    const url = id ? `/api/customers/${id}` : "/api/customers";
    const res = await fetch(url, { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { showToast((await res.json()).error || "Lỗi", "danger"); return; }
    bootstrap.Modal.getInstance(document.getElementById("addCustomerModal")).hide();
    showToast(id ? "Đã cập nhật" : "Đã thêm khách hàng", "success"); loadCustomers();
}
function showDeleteCustomer(id, name) {
    document.getElementById("deleteCustName").textContent = name;
    const modal = new bootstrap.Modal(document.getElementById("deleteCustomerModal"));
    document.getElementById("confirmDeleteCustBtn").onclick = async () => {
        const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
        if (res.ok) { modal.hide(); showToast("Đã xoá khách hàng", "success"); loadCustomers(); }
    };
    modal.show();
}

// ===== COMBOS =====
let comboItems = [];
async function loadCombos() {
    const res = await fetch("/api/combos");
    allCombos = await res.json();
    renderCombos();
}
function renderCombos() {
    const tbody = document.getElementById("comboTableBody");
    if (allCombos.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4"><i class="bi bi-collection fs-3 d-block mb-2"></i>Chưa có gói nào</td></tr>`; return; }
    tbody.innerHTML = allCombos.map(c => {
        const saving = c.original_price - c.combo_price;
        const pct = c.original_price > 0 ? ((saving / c.original_price) * 100).toFixed(0) : 0;
        const items = c.items.map(i => `${i.product_name} ×${i.qty}`).join(", ");
        return `<tr>
            <td class="fw-600">${escapeHtml(c.name)}</td>
            <td class="text-muted" style="font-size:.78rem;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(items)}</td>
            <td class="text-end text-muted text-decoration-line-through">${formatVND(c.original_price)}</td>
            <td class="text-end fw-600">${formatVND(c.combo_price)}</td>
            <td class="text-end"><span class="badge-status badge-cancelled">-${pct}%</span> ${formatVND(saving)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editCombo('${c.id}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteCombo('${c.id}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }).join("");
}
function showComboModal(comboId = null) {
    document.getElementById("comboModalTitle").textContent = comboId ? "Sửa gói" : "Tạo gói sản phẩm";
    document.getElementById("comboId").value = comboId || "";
    document.getElementById("comboName").value = "";
    document.getElementById("comboPrice").value = "";
    document.getElementById("comboDescription").value = "";
    comboItems = [];
    document.getElementById("comboProductSelect").innerHTML = '<option value="">Chọn sản phẩm...</option>' +
        allProducts.map(p => `<option value="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.price}" data-cost="${p.cost_price || 0}">${escapeHtml(p.name)} — ${formatVND(p.price)}</option>`).join("");
    if (comboId) {
        const c = allCombos.find(x => x.id === comboId);
        if (c) {
            document.getElementById("comboName").value = c.name;
            document.getElementById("comboPrice").value = c.combo_price;
            document.getElementById("comboDescription").value = c.description || "";
            comboItems = c.items.map(i => ({ product_id: i.product_id, product_name: i.product_name, unit_price: i.unit_price, cost_price: i.cost_price || 0, qty: i.qty }));
        }
    }
    renderComboItems();
    new bootstrap.Modal(document.getElementById("comboModal")).show();
}
function editCombo(id) { showComboModal(id); }
function addComboItem() {
    const sel = document.getElementById("comboProductSelect");
    const opt = sel.options[sel.selectedIndex];
    if (!sel.value) return;
    const qty = parseInt(document.getElementById("comboProductQty").value) || 1;
    const ex = comboItems.find(i => i.product_id === sel.value);
    if (ex) ex.qty += qty;
    else comboItems.push({ product_id: sel.value, product_name: opt.dataset.name, unit_price: parseFloat(opt.dataset.price), cost_price: parseFloat(opt.dataset.cost) || 0, qty });
    sel.value = ""; document.getElementById("comboProductQty").value = 1; renderComboItems();
}
function removeComboItem(idx) { comboItems.splice(idx, 1); renderComboItems(); }
function renderComboItems() {
    const tbody = document.getElementById("comboItemsBody");
    if (comboItems.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Chưa thêm sản phẩm</td></tr>`; document.getElementById("comboOriginalTotal").textContent = "0₫"; return; }
    let total = 0;
    tbody.innerHTML = comboItems.map((item, idx) => { const l = item.unit_price * item.qty; total += l; return `<tr><td>${escapeHtml(item.product_name)}</td><td class="text-center">${item.qty}</td><td class="text-end">${formatVND(item.unit_price)}</td><td class="text-end">${formatVND(l)}</td><td><button class="btn btn-sm p-0 border-0 text-danger" onclick="removeComboItem(${idx})"><i class="bi bi-x-lg"></i></button></td></tr>`; }).join("");
    document.getElementById("comboOriginalTotal").textContent = formatVND(total);
}
async function saveCombo() {
    const name = document.getElementById("comboName").value.trim();
    const price = parseFloat(document.getElementById("comboPrice").value);
    const desc = document.getElementById("comboDescription").value.trim();
    const id = document.getElementById("comboId").value;
    if (!name) { showToast("Tên gói là bắt buộc", "danger"); return; }
    if (!price || price <= 0) { showToast("Nhập giá gói hợp lệ", "danger"); return; }
    if (comboItems.length < 1) { showToast("Thêm ít nhất 1 sản phẩm", "danger"); return; }
    const res = await fetch(id ? `/api/combos/${id}` : "/api/combos", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, combo_price: price, description: desc, items: comboItems }) });
    if (!res.ok) { showToast((await res.json()).error || "Lỗi", "danger"); return; }
    bootstrap.Modal.getInstance(document.getElementById("comboModal")).hide();
    showToast(id ? "Đã cập nhật gói" : "Đã tạo gói", "success"); loadCombos(); loadProducts();
}
async function deleteCombo(id) {
    if (!confirm("Xoá gói này?")) return;
    await fetch(`/api/combos/${id}`, { method: "DELETE" });
    showToast("Đã xoá gói", "success"); loadCombos();
}

// ===== CUSTOM TABLE (BAO GIA) =====
const PAINT_FEE = 500000;
const WIDTH_PRICING = { 60: 55000000, 70: 80000000, 75: 85000000, 80: 90000000, 90: 100000000, 100: 110000000 };
const READY_MADE_DISCOUNT = 0.85;
let allCategories = [];

function getUnitPriceByWidth(widthCm) {
    const keys = Object.keys(WIDTH_PRICING).map(Number).sort((a, b) => a - b);
    for (const k of keys) { if (widthCm <= k) return WIDTH_PRICING[k]; }
    return WIDTH_PRICING[keys[keys.length - 1]];
}

async function loadCustomTableData() {
    const [cRes] = await Promise.all([fetch("/api/categories")]);
    allCategories = await cRes.json();
    if (allProducts.length === 0) { const pRes = await fetch("/api/products"); allProducts = await pRes.json(); }
    populateCustomTableSelects();
    initChairRows();
}

function populateCustomTableSelects() {
    const ls = document.getElementById("ctLegs");
    const cl = ls.value;
    const legProducts = allProducts.filter(p => (p.category || "").toLowerCase() === "chân bàn");
    ls.innerHTML = '<option value="">Không có chân</option>' + legProducts.map(p => `<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost_price || 0}">${escapeHtml(p.name)} — ${formatVND(p.price)}/cái</option>`).join("");
    if (cl) ls.value = cl;
    // Update existing chair rows with current product list
    updateAllChairSelects();
}

let chairRowCount = 0;
function initChairRows() {
    document.getElementById("ctChairRows").innerHTML = "";
    chairRowCount = 0;
    addChairRow();
}
function addChairRow() {
    const id = chairRowCount++;
    const chairProducts = allProducts.filter(p => (p.category || "").toLowerCase() === "ghế");
    const options = '<option value="">Chọn ghế...</option>' + chairProducts.map(p => `<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost_price || 0}">${escapeHtml(p.name)} — ${formatVND(p.price)}</option>`).join("");
    const row = document.createElement("div");
    row.className = "row g-2 mb-2 ct-chair-row";
    row.dataset.rowId = id;
    row.innerHTML = `
        <div class="col"><select class="form-select form-select-sm ct-chair-select" onchange="calcCustomTable()">${options}</select></div>
        <div class="col-3"><input type="number" class="form-control form-control-sm ct-chair-qty" min="1" value="1" placeholder="SL" oninput="calcCustomTable()"></div>
        <div class="col-auto"><button class="btn btn-sm btn-outline-danger" onclick="removeChairRow(${id})"><i class="bi bi-x-lg"></i></button></div>`;
    document.getElementById("ctChairRows").appendChild(row);
}
function removeChairRow(id) {
    const rows = document.querySelectorAll(".ct-chair-row");
    if (rows.length <= 1) { showToast("Cần ít nhất 1 dòng ghế", "danger"); return; }
    document.querySelector(`.ct-chair-row[data-row-id="${id}"]`)?.remove();
    calcCustomTable();
}
function updateAllChairSelects() {
    const chairProducts = allProducts.filter(p => (p.category || "").toLowerCase() === "ghế");
    const options = '<option value="">Chọn ghế...</option>' + chairProducts.map(p => `<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost_price || 0}">${escapeHtml(p.name)} — ${formatVND(p.price)}</option>`).join("");
    document.querySelectorAll(".ct-chair-select").forEach(sel => { sel.innerHTML = options; });
}
function getChairData() {
    const result = [];
    document.querySelectorAll(".ct-chair-row").forEach(row => {
        const sel = row.querySelector(".ct-chair-select");
        const qty = parseInt(row.querySelector(".ct-chair-qty").value) || 0;
        if (sel.value && qty > 0) {
            const opt = sel.options[sel.selectedIndex];
            result.push({ name: opt.text.split(" —")[0], price: parseFloat(opt.dataset.price) || 0, cost: parseFloat(opt.dataset.cost) || 0, qty });
        }
    });
    return result;
}

function addExtraRow() {
    const c = document.getElementById("ctExtras");
    const r = document.createElement("div"); r.className = "row g-2 mb-2 ct-extra-row";
    r.innerHTML = `<div class="col"><input type="text" class="form-control form-control-sm ct-extra-name" placeholder="Tên phí..."></div><div class="col-4"><input type="number" class="form-control form-control-sm ct-extra-price" placeholder="Giá" min="0" oninput="calcCustomTable()"></div><div class="col-auto"><button class="btn btn-sm btn-outline-danger" onclick="this.closest('.ct-extra-row').remove();calcCustomTable()"><i class="bi bi-x-lg"></i></button></div>`;
    c.appendChild(r);
}

function calcCustomTable() {
    const summary = document.getElementById("ctSummary");
    const l = parseFloat(document.getElementById("ctLength").value) || 0;
    const w = parseFloat(document.getElementById("ctWidth").value) || 0;
    const t = parseFloat(document.getElementById("ctThickness").value) || 0;
    const isReadyMade = document.getElementById("ctReadyMade").checked;
    const volumeM3 = (l / 100) * (w / 100) * (t / 100);
    document.getElementById("ctVolume").value = volumeM3 > 0 ? `${volumeM3.toFixed(6)} m³` : "";

    const unitPrice = w > 0 ? getUnitPriceByWidth(w) : 0;
    const tablePrice = volumeM3 * unitPrice;
    const paintFee = isReadyMade ? 0 : PAINT_FEE;
    const discount = isReadyMade ? tablePrice * (1 - READY_MADE_DISCOUNT) : 0;
    const tableAfterDiscount = tablePrice - discount;

    const ls = document.getElementById("ctLegs"); const lo = ls.options[ls.selectedIndex];
    const lq = parseInt(document.getElementById("ctLegQty").value) || 0;
    const legPrice = ls.value ? parseFloat(lo.dataset.price) * lq : 0;
    const legCost = ls.value ? parseFloat(lo.dataset.cost) * lq : 0;

    const chairs = getChairData();
    let chairsTotal = 0, chairsCost = 0;
    chairs.forEach(c => { chairsTotal += c.price * c.qty; chairsCost += c.cost * c.qty; });

    let extras = 0, extrasHtml = "";
    document.querySelectorAll(".ct-extra-row").forEach(r => {
        const n = r.querySelector(".ct-extra-name").value.trim() || "Phí";
        const p = parseFloat(r.querySelector(".ct-extra-price").value) || 0;
        if (p > 0) { extras += p; extrasHtml += `<div class="d-flex justify-content-between"><span class="text-muted">${escapeHtml(n)}</span><span>${formatVND(p)}</span></div>`; }
    });

    const total = tableAfterDiscount + paintFee + legPrice + chairsTotal + extras;
    const costTotal = legCost + chairsCost;
    const profit = total - costTotal;

    if (l === 0 || w === 0 || t === 0) {
        summary.innerHTML = `<div class="text-muted text-center py-3" style="font-size:.82rem">Nhập đầy đủ kích thước (dài, rộng, dày)</div>`;
        return;
    }

    let html = `
        <div class="d-flex justify-content-between mb-1"><span style="font-size:.82rem">Thể tích</span><span class="fw-600">${volumeM3.toFixed(6)} m³</span></div>
        <div class="text-muted mb-2" style="font-size:.72rem">${l}×${w}×${t}cm · Đơn giá ${formatVND(unitPrice)}/m³</div>
        <div class="d-flex justify-content-between mb-1"><span style="font-size:.82rem">Bàn gỗ</span><span class="fw-600">${formatVND(tablePrice)}</span></div>`;
    if (isReadyMade) html += `<div class="d-flex justify-content-between mb-1"><span style="font-size:.82rem;color:var(--danger)">Giảm bàn có sẵn (-15%)</span><span class="text-danger fw-600">-${formatVND(discount)}</span></div>`;
    if (!isReadyMade) html += `<div class="d-flex justify-content-between mb-1"><span style="font-size:.82rem">Phí sơn</span><span class="fw-600">${formatVND(paintFee)}</span></div>`;
    if (legPrice > 0) html += `<div class="d-flex justify-content-between mb-1"><span style="font-size:.82rem">${escapeHtml(lo.text.split(" —")[0])} ×${lq}</span><span class="fw-600">${formatVND(legPrice)}</span></div>`;
    chairs.forEach(c => { html += `<div class="d-flex justify-content-between mb-1"><span style="font-size:.82rem">${escapeHtml(c.name)} ×${c.qty}</span><span class="fw-600">${formatVND(c.price * c.qty)}</span></div>`; });
    if (extrasHtml) html += `<hr class="my-1">${extrasHtml}`;
    html += `
        <hr class="my-1">
        <div class="d-flex justify-content-between"><span class="fw-bold">TỔNG CỘNG</span><span class="fw-bold text-success" style="font-size:1.1rem">${formatVND(total)}</span></div>
        <div class="d-flex justify-content-between" style="font-size:.78rem"><span class="text-muted">Lợi nhuận</span><span class="${profit >= 0 ? "text-success" : "text-danger"} fw-600">${formatVND(profit)}</span></div>`;
    if (isReadyMade) html += `<div class="mt-2 p-2 rounded" style="background:var(--warning-bg);font-size:.75rem"><i class="bi bi-info-circle me-1"></i>Bàn có sẵn: miễn phí sơn, giảm 15%</div>`;
    summary.innerHTML = html;
}

function addCustomTableToCart() {
    const name = document.getElementById("ctName").value.trim() || "Sản phẩm tùy chỉnh";
    const l = parseFloat(document.getElementById("ctLength").value) || 0;
    const w = parseFloat(document.getElementById("ctWidth").value) || 0;
    const t = parseFloat(document.getElementById("ctThickness").value) || 0;
    if (l === 0 || w === 0 || t === 0) { showToast("Nhập đầy đủ kích thước (dài, rộng, dày)", "danger"); return; }

    const isReadyMade = document.getElementById("ctReadyMade").checked;
    const volumeM3 = (l / 100) * (w / 100) * (t / 100);
    const unitPrice = getUnitPriceByWidth(w);
    const tablePrice = volumeM3 * unitPrice;
    const discount = isReadyMade ? tablePrice * (1 - READY_MADE_DISCOUNT) : 0;
    const paintFee = isReadyMade ? 0 : PAINT_FEE;

    const ls = document.getElementById("ctLegs"); const lo = ls.options[ls.selectedIndex];
    const lq = parseInt(document.getElementById("ctLegQty").value) || 0;
    const legPrice = ls.value ? parseFloat(lo.dataset.price) * lq : 0;
    const legCost = ls.value ? parseFloat(lo.dataset.cost) * lq : 0;
    const legName = ls.value ? lo.text.split(" —")[0] : "";

    const chairs = getChairData();
    let chairsTotal = 0, chairsCost = 0;
    chairs.forEach(c => { chairsTotal += c.price * c.qty; chairsCost += c.cost * c.qty; });

    let extrasList = [];
    let extras = 0;
    document.querySelectorAll(".ct-extra-row").forEach(r => {
        const n = r.querySelector(".ct-extra-name").value.trim() || "Phí";
        const p = parseFloat(r.querySelector(".ct-extra-price").value) || 0;
        if (p > 0) { extras += p; extrasList.push({ name: n, price: p }); }
    });

    const total = (tablePrice - discount) + paintFee + legPrice + chairsTotal + extras;
    const costTotal = legCost + chairsCost;
    const tag = isReadyMade ? "CÓ SẴN" : "TÙY CHỈNH";

    const details = [];
    details.push(`Kích thước: ${l}×${w}×${t}cm`);
    if (legName && lq > 0) details.push(`Chân: ${legName} ×${lq}`);
    chairs.forEach(c => details.push(`Ghế: ${c.name} ×${c.qty}`));
    extrasList.forEach(e => details.push(`${e.name}: ${formatVND(e.price)}`));
    if (isReadyMade) details.push("Bàn có sẵn: miễn sơn, giảm 15%");

    cart.push({
        id: `custom_${Date.now()}`,
        name: `[${tag}] ${name}`,
        price: total,
        cost_price: costTotal,
        qty: 1,
        details: details
    });
    renderCart(); showToast(`Đã thêm "${name}" vào giỏ`, "success");
}

// ===== CATEGORIES =====
async function loadCategories() {
    const res = await fetch("/api/categories");
    allCategories = await res.json();
    renderCategories();
    populateCategoryFilter();
    populateShopCategoryFilter();
}
function renderCategories() {
    const tbody = document.getElementById("categoryTableBody");
    if (allCategories.length === 0) { tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4"><i class="bi bi-tag fs-3 d-block mb-2"></i>Chưa có danh mục nào</td></tr>`; return; }
    tbody.innerHTML = allCategories.map(c => `<tr>
        <td class="fw-600">${escapeHtml(c.name)}</td>
        <td class="text-center text-muted">${c.sort_order || 0}</td>
        <td class="text-center">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="showEditCategory('${c.id}')"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${c.id}','${escapeHtml(c.name).replace(/'/g,"\\'")}')"><i class="bi bi-trash"></i></button>
        </td>
    </tr>`).join("");
}
function showAddCategoryModal() {
    document.getElementById("categoryModalTitle").textContent = "Thêm danh mục";
    document.getElementById("categoryId").value = "";
    document.getElementById("categoryName").value = "";
    document.getElementById("categorySort").value = "0";
    new bootstrap.Modal(document.getElementById("categoryModal")).show();
}
function showEditCategory(id) {
    const c = allCategories.find(x => x.id === id);
    if (!c) return;
    document.getElementById("categoryModalTitle").textContent = "Sửa danh mục";
    document.getElementById("categoryId").value = c.id;
    document.getElementById("categoryName").value = c.name;
    document.getElementById("categorySort").value = c.sort_order || 0;
    new bootstrap.Modal(document.getElementById("categoryModal")).show();
}
async function saveCategory() {
    const id = document.getElementById("categoryId").value;
    const name = document.getElementById("categoryName").value.trim();
    if (!name) { showToast("Tên danh mục là bắt buộc", "danger"); return; }
    const body = { name, sort_order: parseInt(document.getElementById("categorySort").value) || 0 };
    const url = id ? `/api/categories/${id}` : "/api/categories";
    const res = await fetch(url, { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { showToast((await res.json()).error || "Lỗi", "danger"); return; }
    bootstrap.Modal.getInstance(document.getElementById("categoryModal")).hide();
    showToast(id ? "Đã cập nhật" : "Đã thêm danh mục", "success");
    await loadCategories();
    populateCategoryFilter();
    populateShopCategoryFilter();
}
async function deleteCategory(id, name) {
    if (!confirm(`Xoá danh mục "${name}"?`)) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    showToast("Đã xoá", "success");
    await loadCategories();
}

// ===== TOAST =====
function showToast(msg, type = "success") {
    const t = document.getElementById("appToast");
    const b = document.getElementById("toastBody");
    const icon = type === "success" ? "bi-check-circle-fill" : "bi-exclamation-circle-fill";
    t.className = `toast bg-${type} text-white`;
    b.innerHTML = `<i class="bi ${icon} me-2"></i>${msg}`;
    new bootstrap.Toast(t, { delay: 3000 }).show();
}
