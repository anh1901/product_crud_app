const API = "/api/products";
let allProducts = [];
let searchTimeout = null;
let cart = [];

document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    document.getElementById("searchInput").addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadProducts(e.target.value), 300);
    });
});

async function loadProducts(search = "") {
    const url = search ? `${API}?search=${encodeURIComponent(search)}` : API;
    const res = await fetch(url);
    allProducts = await res.json();
    renderProducts(allProducts);
    updateStats(allProducts);
}

function renderProducts(products) {
    const tbody = document.getElementById("productTableBody");
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                    No products found.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = products
        .map(
            (p) => `
        <tr>
            <td class="fw-semibold">${escapeHtml(p.name)}</td>
            <td>${p.category ? `<span class="badge bg-secondary">${escapeHtml(p.category)}</span>` : '<span class="text-muted">—</span>'}</td>
            <td class="fw-semibold text-success">$${Number(p.price).toFixed(2)}</td>
            <td class="product-description text-muted">${escapeHtml(p.description || "—")}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary btn-action me-1" onclick="showEditModal('${p.id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-action" onclick="showDeleteModal('${p.id}', '${escapeHtml(p.name)}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="addToCart('${p.id}')" title="Add to cart">
                    <i class="bi bi-cart-plus"></i>
                </button>
            </td>
        </tr>`
        )
        .join("");
}

function updateStats(products) {
    document.getElementById("statTotal").textContent = products.length;
    const categories = new Set(products.map((p) => p.category).filter(Boolean));
    document.getElementById("statCategories").textContent = categories.size;
    const avg =
        products.length > 0
            ? products.reduce((sum, p) => sum + p.price, 0) / products.length
            : 0;
    document.getElementById("statAvgPrice").textContent = `$${avg.toFixed(2)}`;
}

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

    const body = { name, price: parseFloat(price), category, description };
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
    loadProducts(document.getElementById("searchInput").value);
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
            loadProducts(document.getElementById("searchInput").value);
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
        loadProducts(document.getElementById("searchInput").value);
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
        cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
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
    renderCart();
    showToast("Cart cleared", "success");
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
    let total = 0;
    body.innerHTML = cart
        .map((item) => {
            const subtotal = item.price * item.qty;
            total += subtotal;
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
                    <span class="text-success fw-semibold">$${subtotal.toFixed(2)}</span>
                </div>
                <small class="text-muted">$${Number(item.price).toFixed(2)} each</small>
            </div>`;
        })
        .join("");

    document.getElementById("cartItemCount").textContent = totalItems;
    document.getElementById("cartTotal").textContent = `$${total.toFixed(2)}`;
}
