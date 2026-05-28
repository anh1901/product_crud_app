const API = "/api/products";
let allProducts = [];
let searchTimeout = null;
let cart = [];

function formatVND(amount) {
    return Number(amount).toLocaleString("vi-VN") + "₫";
}

document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    document.getElementById("searchInput").addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => applyFilters(), 300);
    });
});

async function loadProducts() {
    const res = await fetch(API);
    allProducts = await res.json();
    populateCategoryFilter();
    applyFilters();
}

function populateCategoryFilter() {
    const select = document.getElementById("categoryFilter");
    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
    const current = select.value;
    select.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${c}"${c === current ? " selected" : ""}>${c}</option>`).join("");
}

function applyFilters() {
    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const category = document.getElementById("categoryFilter").value;
    const minPrice = parseFloat(document.getElementById("priceMin").value);
    const maxPrice = parseFloat(document.getElementById("priceMax").value);

    let filtered = allProducts.filter(p => {
        if (search && !p.name.toLowerCase().includes(search) && !(p.category || "").toLowerCase().includes(search)) return false;
        if (category && p.category !== category) return false;
        if (!isNaN(minPrice) && p.price < minPrice) return false;
        if (!isNaN(maxPrice) && p.price > maxPrice) return false;
        return true;
    });

    renderProducts(filtered);
    updateStats(filtered);
}

function clearFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("categoryFilter").value = "";
    document.getElementById("priceMin").value = "";
    document.getElementById("priceMax").value = "";
    applyFilters();
}

const PLACEHOLDER_COLORS = ["#6366f1","#f43f5e","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];

function getPlaceholderColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

function renderProducts(products) {
    const grid = document.getElementById("productGrid");
    if (products.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                No products found.
            </div>`;
        return;
    }

    grid.innerHTML = products
        .map((p) => {
            const color = getPlaceholderColor(p.name);
            const initials = p.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
            return `
        <div class="col-xl-3 col-lg-4 col-md-6">
            <div class="product-card">
                <div class="product-img" style="background:linear-gradient(135deg, ${color}, ${color}dd)">
                    <span class="product-initials">${initials}</span>
                    ${p.category ? `<span class="product-badge">${escapeHtml(p.category)}</span>` : ""}
                </div>
                <div class="product-info">
                    <h6 class="product-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h6>
                    <p class="product-desc">${escapeHtml(p.description || "No description")}</p>
                    <div class="product-price">${formatVND(p.price)}</div>
                </div>
                <div class="product-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="showEditModal('${p.id}')" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="showDeleteModal('${p.id}', '${escapeHtml(p.name)}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-warning ms-auto" onclick="addToCart('${p.id}')" title="Add to cart">
                        <i class="bi bi-cart-plus me-1"></i>Add
                    </button>
                </div>
            </div>
        </div>`;
        })
        .join("");
}

function updateStats(products) {}

function showAddModal() {
    document.getElementById("productModalTitle").textContent = "Add Product";
    document.getElementById("productId").value = "";
    document.getElementById("productForm").reset();
    new bootstrap.Modal(document.getElementById("productModal")).show();
}

function showEditModal(id) {
    const product = allProducts.find((p) => p.id === id);
    if (!product) return;
    document.getElementById("productModalTitle").textContent = "Edit Product";
    document.getElementById("productId").value = product.id;
    document.getElementById("productName").value = product.name;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productCostPrice").value = product.cost_price || "";
    document.getElementById("productCategory").value = product.category || "";
    document.getElementById("productDescription").value =
        product.description || "";
    new bootstrap.Modal(document.getElementById("productModal")).show();
}

async function saveProduct() {
    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value.trim();
    const price = document.getElementById("productPrice").value;
    const category = document.getElementById("productCategory").value.trim();
    const description = document
        .getElementById("productDescription")
        .value.trim();

    if (!name || !price) {
        showToast("Name and price are required", "danger");
        return;
    }

    const costPrice = document.getElementById("productCostPrice").value;
    const body = { name, price: parseFloat(price), cost_price: costPrice ? parseFloat(costPrice) : 0, category, description };
    const url = id ? `${API}/${id}` : API;
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Failed to save", "danger");
        return;
    }

    bootstrap.Modal.getInstance(document.getElementById("productModal")).hide();
    showToast(id ? "Product updated" : "Product created", "success");
    loadProducts();
}

function showDeleteModal(id, name) {
    document.getElementById("deleteProductName").textContent = name;
    const modal = new bootstrap.Modal(document.getElementById("deleteModal"));
    const btn = document.getElementById("confirmDeleteBtn");
    btn.onclick = async () => {
        const res = await fetch(`${API}/${id}`, { method: "DELETE" });
        if (res.ok) {
            modal.hide();
            showToast("Product deleted", "success");
            loadProducts();
        } else {
            showToast("Failed to delete", "danger");
        }
    };
    modal.show();
}

function showImportModal() {
    document.getElementById("importFile").value = "";
    document.getElementById("jsonInput").value = "";
    document.getElementById("importResults").classList.add("d-none");
    new bootstrap.Modal(document.getElementById("importModal")).show();
}

async function importProducts() {
    const fileInput = document.getElementById("importFile");
    const jsonInput = document.getElementById("jsonInput").value.trim();
    const activeTab = document.querySelector("#importModal .nav-link.active");
    const isFileTab = activeTab?.getAttribute("data-bs-target") === "#fileTab";

    let res;

    if (isFileTab && fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        res = await fetch(`${API}/import`, { method: "POST", body: formData });
    } else if (!isFileTab && jsonInput) {
        try {
            JSON.parse(jsonInput);
        } catch {
            showToast("Invalid JSON format", "danger");
            return;
        }
        res = await fetch(`${API}/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: jsonInput,
        });
    } else {
        showToast("Please provide a file or paste JSON", "danger");
        return;
    }

    const data = await res.json();
    const resultsDiv = document.getElementById("importResults");
    const alertDiv = document.getElementById("importAlert");
    resultsDiv.classList.remove("d-none");

    if (data.imported > 0) {
        let msg = `<i class="bi bi-check-circle me-2"></i>Successfully imported ${data.imported} product(s).`;
        if (data.errors && data.errors.length > 0) {
            msg += `<br><small class="text-muted">${data.errors.length} row(s) had errors.</small>`;
        }
        alertDiv.className = "alert alert-success";
        alertDiv.innerHTML = msg;
        loadProducts();
    } else {
        let msg = `<i class="bi bi-x-circle me-2"></i>No products imported.`;
        if (data.errors && data.errors.length > 0) {
            msg += "<br>Errors:<ul class='mb-0 mt-1'>";
            data.errors.forEach((e) => {
                msg += `<li>Row ${e.row}: ${escapeHtml(e.error)}</li>`;
            });
            msg += "</ul>";
        }
        if (data.error) {
            msg = `<i class="bi bi-x-circle me-2"></i>${escapeHtml(data.error)}`;
        }
        alertDiv.className = "alert alert-danger";
        alertDiv.innerHTML = msg;
    }
}

function showToast(message, type = "success") {
    const toast = document.getElementById("appToast");
    const body = document.getElementById("toastBody");
    toast.className = `toast bg-${type} text-white`;
    const icon =
        type === "success" ? "bi-check-circle-fill" : "bi-exclamation-circle-fill";
    body.innerHTML = `<i class="bi ${icon} me-2"></i>${message}`;
    new bootstrap.Toast(toast, { delay: 3000 }).show();
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// --- Cart ---

function toggleCart() {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("cartOverlay");
    const open = sidebar.classList.toggle("open");
    overlay.classList.toggle("open", open);
}

function addToCart(productId) {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    const existing = cart.find((item) => item.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ id: product.id, name: product.name, price: product.price, cost_price: product.cost_price || 0, qty: 1 });
    }
    renderCart();
    showToast(`${product.name} added to cart`, "success");
}

function removeFromCart(productId) {
    cart = cart.filter((item) => item.id !== productId);
    renderCart();
}

function updateCartQty(productId, delta) {
    const item = cart.find((i) => i.id === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter((i) => i.id !== productId);
    }
    renderCart();
}

function setCartQty(productId, value) {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty <= 0) {
        cart = cart.filter((i) => i.id !== productId);
    } else {
        const item = cart.find((i) => i.id === productId);
        if (item) item.qty = qty;
    }
    renderCart();
}

function clearCart() {
    cart = [];
    document.getElementById("discountInput").value = 0;
    renderCart();
    showToast("Cart cleared", "success");
}

function showDealSummary() {
    if (cart.length === 0) return;
    const discountPct = parseFloat(document.getElementById("discountInput").value) || 0;
    let subtotal = 0;
    const rows = cart.map((item) => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;
        return `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td class="text-center">${item.qty}</td>
            <td class="text-end">${formatVND(item.price)}</td>
            <td class="text-end">${formatVND(lineTotal)}</td>
        </tr>`;
    }).join("");
    const discountAmt = subtotal * (discountPct / 100);
    const finalTotal = subtotal - discountAmt;
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    document.getElementById("dealSummaryBody").innerHTML = `
        <div id="dealPrintArea">
            <div class="text-center mb-4">
                <h4 class="fw-bold">Deal Quotation</h4>
                <p class="text-muted mb-0">${date}</p>
            </div>
            <table class="table table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>Product</th>
                        <th class="text-center" style="width:80px">Qty</th>
                        <th class="text-end" style="width:120px">Unit Price</th>
                        <th class="text-end" style="width:120px">Total</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="text-end fw-semibold">Subtotal</td>
                        <td class="text-end fw-semibold">${formatVND(subtotal)}</td>
                    </tr>
                    ${discountPct > 0 ? `<tr>
                        <td colspan="3" class="text-end text-danger">Discount (${discountPct}%)</td>
                        <td class="text-end text-danger">-${formatVND(discountAmt)}</td>
                    </tr>` : ""}
                    <tr class="table-primary">
                        <td colspan="3" class="text-end fs-5 fw-bold">Grand Total</td>
                        <td class="text-end fs-5 fw-bold">${formatVND(finalTotal)}</td>
                    </tr>
                </tfoot>
            </table>
            ${discountPct > 0 ? `<p class="text-muted small">* A ${discountPct}% bulk discount has been applied.</p>` : ""}
        </div>`;
    new bootstrap.Modal(document.getElementById("dealSummaryModal")).show();
}

function printDealSummary() {
    const content = document.getElementById("dealPrintArea").innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Deal Summary</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>body{padding:2rem}@media print{body{padding:0}}</style>
        </head><body>${content}</body></html>`);
    win.document.close();
    win.onload = () => { win.print(); };
}

function renderCart() {
    const body = document.getElementById("cartBody");
    const footer = document.getElementById("cartFooter");
    const countBadge = document.getElementById("cartCount");
    const totalItems = cart.reduce((s, i) => s + i.qty, 0);
    countBadge.textContent = totalItems;

    if (cart.length === 0) {
        body.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-cart-x fs-1 d-block mb-2"></i>
                Cart is empty. Add products to start a deal.
            </div>`;
        footer.style.display = "none";
        return;
    }

    footer.style.display = "block";
    let subtotalSum = 0;
    let costSum = 0;
    body.innerHTML = cart
        .map((item) => {
            const subtotal = item.price * item.qty;
            subtotalSum += subtotal;
            costSum += (item.cost_price || 0) * item.qty;
            return `
            <div class="cart-item">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <strong class="me-2">${escapeHtml(item.name)}</strong>
                    <button class="btn btn-sm btn-outline-danger border-0 p-0" onclick="removeFromCart('${item.id}')" title="Remove">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <div class="input-group input-group-sm" style="width:120px">
                        <button class="btn btn-outline-secondary" onclick="updateCartQty('${item.id}', -1)">−</button>
                        <input type="number" class="form-control text-center" value="${item.qty}" min="1"
                               onchange="setCartQty('${item.id}', this.value)" style="max-width:50px">
                        <button class="btn btn-outline-secondary" onclick="updateCartQty('${item.id}', 1)">+</button>
                    </div>
                    <span class="text-success fw-semibold">${formatVND(subtotal)}</span>
                </div>
                <small class="text-muted">${formatVND(item.price)} each</small>
            </div>`;
        })
        .join("");

    const discountPct = parseFloat(document.getElementById("discountInput").value) || 0;
    const discountAmt = subtotalSum * (discountPct / 100);
    const finalTotal = subtotalSum - discountAmt;
    const profit = finalTotal - costSum;
    const margin = finalTotal > 0 ? (profit / finalTotal) * 100 : 0;

    document.getElementById("cartItemCount").textContent = totalItems;
    document.getElementById("cartSubtotal").textContent = formatVND(subtotalSum);

    const discountRow = document.getElementById("discountRow");
    if (discountPct > 0) {
        discountRow.style.display = "flex";
        discountRow.style.setProperty("display", "flex", "important");
        document.getElementById("cartDiscount").textContent = `-${formatVND(discountAmt)}`;
    } else {
        discountRow.style.setProperty("display", "none", "important");
    }

    document.getElementById("cartTotal").textContent = formatVND(finalTotal);
    document.getElementById("cartProfit").textContent = formatVND(profit);
    document.getElementById("cartProfit").className = `fw-bold ${profit >= 0 ? "text-success" : "text-danger"}`;
    document.getElementById("cartMargin").textContent = `${margin.toFixed(1)}%`;
    document.getElementById("cartMargin").className = `fw-semibold small ${profit >= 0 ? "text-success" : "text-danger"}`;
}
