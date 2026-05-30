import csv
import io
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DATABASE = "products.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()

    # --- customers table (NEW) ---
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            address TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """
    )

    # --- products table (extended) ---
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            cost_price REAL DEFAULT 0,
            description TEXT DEFAULT '',
            category TEXT DEFAULT '',
            size TEXT DEFAULT '',
            color TEXT DEFAULT '',
            image_url TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """
    )

    # Migrate: add columns if missing
    product_cols = [row[1] for row in conn.execute("PRAGMA table_info(products)").fetchall()]
    for col, default in [("cost_price", 0), ("size", ""), ("color", ""), ("image_url", "")]:
        if col not in product_cols:
            conn.execute(f"ALTER TABLE products ADD COLUMN {col} TEXT DEFAULT '{default}'" if isinstance(default, str) else f"ALTER TABLE products ADD COLUMN {col} REAL DEFAULT {default}")

    # --- deals table ---
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS deals (
            id TEXT PRIMARY KEY,
            customer_id TEXT DEFAULT '',
            customer_name TEXT DEFAULT '',
            customer_phone TEXT DEFAULT '',
            customer_address TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            subtotal REAL NOT NULL,
            discount_pct REAL DEFAULT 0,
            discount_amt REAL DEFAULT 0,
            shipping_fee REAL DEFAULT 0,
            total REAL NOT NULL,
            cost_total REAL DEFAULT 0,
            profit REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """
    )

    # Migrate: add customer_id column if missing
    deal_cols = [row[1] for row in conn.execute("PRAGMA table_info(deals)").fetchall()]
    if "customer_id" not in deal_cols:
        conn.execute("ALTER TABLE deals ADD COLUMN customer_id TEXT DEFAULT ''")
    if "shipping_fee" not in deal_cols:
        conn.execute("ALTER TABLE deals ADD COLUMN shipping_fee REAL DEFAULT 0")

    # --- deal_items table ---
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS deal_items (
            id TEXT PRIMARY KEY,
            deal_id TEXT NOT NULL,
            product_id TEXT DEFAULT '',
            product_name TEXT NOT NULL,
            unit_price REAL NOT NULL,
            cost_price REAL DEFAULT 0,
            qty INTEGER NOT NULL,
            line_total REAL NOT NULL,
            FOREIGN KEY (deal_id) REFERENCES deals(id)
        )
    """
    )

    deal_item_cols = [row[1] for row in conn.execute("PRAGMA table_info(deal_items)").fetchall()]
    if "product_id" not in deal_item_cols:
        conn.execute("ALTER TABLE deal_items ADD COLUMN product_id TEXT DEFAULT ''")
    if "details" not in deal_item_cols:
        conn.execute("ALTER TABLE deal_items ADD COLUMN details TEXT DEFAULT ''")

    # --- order_status_history table (NEW) ---
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS order_status_history (
            id TEXT PRIMARY KEY,
            deal_id TEXT NOT NULL,
            old_status TEXT DEFAULT '',
            new_status TEXT NOT NULL,
            changed_at TEXT NOT NULL,
            note TEXT DEFAULT '',
            FOREIGN KEY (deal_id) REFERENCES deals(id)
        )
    """
    )

    # --- combos table ---
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS combos (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            combo_price REAL NOT NULL,
            cost_total REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """
    )

    # --- combo_items table ---
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS combo_items (
            id TEXT PRIMARY KEY,
            combo_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            unit_price REAL NOT NULL,
            cost_price REAL DEFAULT 0,
            qty INTEGER NOT NULL,
            FOREIGN KEY (combo_id) REFERENCES combos(id)
        )
    """
    )

    # --- categories table ---
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """
    )

    # Migrate existing deals: link customer_id from customers table
    _migrate_customer_ids(conn)

    conn.commit()
    conn.close()


def _migrate_customer_ids(conn):
    """Auto-link deals to customers by name for existing data."""
    customers = conn.execute("SELECT id, name FROM customers").fetchall()
    if not customers:
        # No customers table yet populated — create from deals
        existing_deals = conn.execute(
            "SELECT DISTINCT customer_name, customer_phone, customer_address FROM deals WHERE customer_name != ''"
        ).fetchall()
        for d in existing_deals:
            cid = str(uuid.uuid4())
            ts = datetime.now(timezone.utc).isoformat()
            try:
                conn.execute(
                    "INSERT INTO customers (id, name, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (cid, d["customer_name"], d["customer_phone"] or "", d["customer_address"] or "", ts, ts),
                )
                conn.execute(
                    "UPDATE deals SET customer_id = ? WHERE LOWER(customer_name) = LOWER(?)",
                    (cid, d["customer_name"]),
                )
            except Exception:
                pass
    else:
        # Link unlinked deals
        for c in customers:
            conn.execute(
                "UPDATE deals SET customer_id = ? WHERE LOWER(customer_name) = LOWER(?) AND (customer_id = '' OR customer_id IS NULL)",
                (c["id"], c["name"]),
            )


def row_to_dict(row):
    return dict(row) if row else None


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ============================================================
#  PAGES
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


# ============================================================
#  PRODUCTS API
# ============================================================

@app.route("/api/products", methods=["GET"])
def list_products():
    search = request.args.get("search", "").strip()
    conn = get_db()
    if search:
        params = [f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"]
        query = (
            "SELECT * FROM products WHERE name LIKE ? OR category LIKE ? OR size LIKE ? OR color LIKE ?"
        )
        try:
            price_val = float(search)
            margin = price_val * 0.1 if price_val > 0 else 1000
            query += " OR (price BETWEEN ? AND ?)"
            params.extend([price_val - margin, price_val + margin])
        except ValueError:
            pass
        query += " ORDER BY created_at DESC"
        rows = conn.execute(query, params).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM products ORDER BY created_at DESC"
        ).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/products/<product_id>", methods=["GET"])
def get_product(product_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(row_to_dict(row))


@app.route("/api/products", methods=["POST"])
def create_product():
    data = request.get_json()
    if not data or not data.get("name") or data.get("price") is None:
        return jsonify({"error": "Name and price are required"}), 400

    try:
        price = float(data["price"])
    except (ValueError, TypeError):
        return jsonify({"error": "Price must be a number"}), 400
    if price < 0:
        return jsonify({"error": "Price must be non-negative"}), 400

    try:
        cost_price = float(data.get("cost_price", 0))
    except (ValueError, TypeError):
        cost_price = 0

    product = {
        "id": str(uuid.uuid4()),
        "name": data["name"].strip(),
        "price": price,
        "cost_price": max(cost_price, 0),
        "description": data.get("description", "").strip(),
        "category": data.get("category", "").strip(),
        "size": data.get("size", "").strip(),
        "color": data.get("color", "").strip(),
        "image_url": data.get("image_url", "").strip(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    conn = get_db()
    conn.execute(
        """INSERT INTO products (id, name, price, cost_price, description, category,
           size, color, image_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (product["id"], product["name"], product["price"], product["cost_price"],
         product["description"], product["category"], product["size"], product["color"],
         product["image_url"], product["created_at"], product["updated_at"]),
    )
    conn.commit()
    conn.close()
    return jsonify(product), 201


@app.route("/api/products/<product_id>", methods=["PUT"])
def update_product(product_id):
    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM products WHERE id = ?", (product_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    data = request.get_json()
    if not data:
        conn.close()
        return jsonify({"error": "No data provided"}), 400

    name = data.get("name", existing["name"]).strip()
    description = data.get("description", existing["description"]).strip()
    category = data.get("category", existing["category"]).strip()
    size = data.get("size", existing["size"]).strip()
    color = data.get("color", existing["color"]).strip()
    image_url = data.get("image_url", existing["image_url"]).strip()

    try:
        price = float(data.get("price", existing["price"]))
    except (ValueError, TypeError):
        conn.close()
        return jsonify({"error": "Price must be a number"}), 400
    if price < 0:
        conn.close()
        return jsonify({"error": "Price must be non-negative"}), 400

    try:
        cost_price = float(data.get("cost_price", existing["cost_price"]))
    except (ValueError, TypeError):
        cost_price = 0
    cost_price = max(cost_price, 0)

    if not name:
        conn.close()
        return jsonify({"error": "Name is required"}), 400

    updated_at = now_iso()
    conn.execute(
        """UPDATE products SET name = ?, price = ?, cost_price = ?, description = ?,
           category = ?, size = ?, color = ?, image_url = ?, updated_at = ? WHERE id = ?""",
        (name, price, cost_price, description, category, size, color, image_url, updated_at, product_id),
    )
    conn.commit()

    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row))


@app.route("/api/products/<product_id>", methods=["DELETE"])
def delete_product(product_id):
    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM products WHERE id = ?", (product_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Product not found"}), 404
    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Product deleted"})


@app.route("/api/products/import", methods=["POST"])
def import_products():
    imported = []
    errors = []

    if request.content_type and "multipart/form-data" in request.content_type:
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"error": "No file provided"}), 400
        filename = file.filename.lower()
        content = file.read().decode("utf-8")
        if filename.endswith(".json"):
            try:
                items = json.loads(content)
                if not isinstance(items, list):
                    return jsonify({"error": "JSON must be an array of products"}), 400
            except json.JSONDecodeError as e:
                return jsonify({"error": f"Invalid JSON: {e}"}), 400
        elif filename.endswith(".csv"):
            items = _parse_csv(content)
        else:
            return jsonify({"error": "Unsupported file type. Use .json or .csv"}), 400
    else:
        data = request.get_json()
        if not data or not isinstance(data, list):
            return jsonify({"error": "Request body must be a JSON array of products"}), 400
        items = data

    conn = get_db()
    for i, item in enumerate(items):
        name = str(item.get("name", "")).strip() if item.get("name") else ""
        if not name:
            errors.append({"row": i + 1, "error": "Name is required"})
            continue
        try:
            price = float(item.get("price", 0))
        except (ValueError, TypeError):
            errors.append({"row": i + 1, "error": "Invalid price"})
            continue
        if price < 0:
            errors.append({"row": i + 1, "error": "Price must be non-negative"})
            continue
        try:
            cost_price = max(float(item.get("cost_price", 0)), 0)
        except (ValueError, TypeError):
            cost_price = 0

        product = {
            "id": str(uuid.uuid4()),
            "name": name,
            "price": price,
            "cost_price": cost_price,
            "description": str(item.get("description", "")).strip(),
            "category": str(item.get("category", "")).strip(),
            "size": str(item.get("size", "")).strip(),
            "color": str(item.get("color", "")).strip(),
            "image_url": str(item.get("image_url", "")).strip(),
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        conn.execute(
            """INSERT INTO products (id, name, price, cost_price, description, category,
               size, color, image_url, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (product["id"], product["name"], product["price"], product["cost_price"],
             product["description"], product["category"], product["size"], product["color"],
             product["image_url"], product["created_at"], product["updated_at"]),
        )
        imported.append(product)

    conn.commit()
    conn.close()
    return jsonify({
        "imported": len(imported),
        "errors": errors,
        "products": imported,
    }), 201 if imported else 400


def _parse_csv(content):
    reader = csv.DictReader(io.StringIO(content))
    items = []
    for row in reader:
        items.append({
            "name": row.get("name", ""),
            "price": row.get("price", "0"),
            "cost_price": row.get("cost_price", "0"),
            "description": row.get("description", ""),
            "category": row.get("category", ""),
            "size": row.get("size", ""),
            "color": row.get("color", ""),
            "image_url": row.get("image_url", ""),
        })
    return items


# ============================================================
#  CUSTOMERS API
# ============================================================

@app.route("/api/customers", methods=["GET"])
def list_customers():
    conn = get_db()
    rows = conn.execute(
        """SELECT
            c.id, c.name, c.phone, c.address, c.notes,
            c.created_at, c.updated_at,
            COUNT(d.id) as total_orders,
            COALESCE(SUM(d.total), 0) as total_spent,
            SUM(CASE WHEN d.status IN ('pending','confirmed','processing','shipping') THEN 1 ELSE 0 END) as active_orders,
            MAX(d.created_at) as last_order_date
           FROM customers c
           LEFT JOIN deals d ON d.customer_id = c.id
           GROUP BY c.id
           ORDER BY c.updated_at DESC"""
    ).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/customers/search", methods=["GET"])
def search_customers():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name LIMIT 20",
        (f"%{q}%", f"%{q}%"),
    ).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/customers/<customer_id>", methods=["GET"])
def get_customer(customer_id):
    conn = get_db()
    cust = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not cust:
        conn.close()
        return jsonify({"error": "Customer not found"}), 404
    result = row_to_dict(cust)
    deals = conn.execute(
        "SELECT * FROM deals WHERE customer_id = ? ORDER BY created_at DESC",
        (customer_id,),
    ).fetchall()
    result["deals"] = [row_to_dict(d) for d in deals]
    for d in result["deals"]:
        items = conn.execute(
            "SELECT * FROM deal_items WHERE deal_id = ?", (d["id"],)
        ).fetchall()
        d["items"] = [row_to_dict(i) for i in items]
    conn.close()
    return jsonify(result)


@app.route("/api/customers", methods=["POST"])
def create_customer():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Customer name is required"}), 400

    cid = str(uuid.uuid4())
    ts = now_iso()
    conn = get_db()
    conn.execute(
        """INSERT INTO customers (id, name, phone, address, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (cid, data["name"].strip(), data.get("phone", "").strip(),
         data.get("address", "").strip(), data.get("notes", "").strip(), ts, ts),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM customers WHERE id = ?", (cid,)).fetchone())
    conn.close()
    return jsonify(row), 201


@app.route("/api/customers/<customer_id>", methods=["PUT"])
def update_customer(customer_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Customer not found"}), 404

    data = request.get_json()
    if not data:
        conn.close()
        return jsonify({"error": "No data provided"}), 400

    name = data.get("name", existing["name"]).strip()
    if not name:
        conn.close()
        return jsonify({"error": "Name is required"}), 400

    phone = data.get("phone", existing["phone"]).strip()
    address = data.get("address", existing["address"]).strip()
    notes = data.get("notes", existing["notes"]).strip()
    ts = now_iso()

    conn.execute(
        """UPDATE customers SET name = ?, phone = ?, address = ?, notes = ?, updated_at = ?
           WHERE id = ?""",
        (name, phone, address, notes, ts, customer_id),
    )
    # Also update linked deals
    conn.execute(
        """UPDATE deals SET customer_name = ?, customer_phone = ?, customer_address = ?
           WHERE customer_id = ?""",
        (name, phone, address, customer_id),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone())
    conn.close()
    return jsonify(row)


@app.route("/api/customers/<customer_id>", methods=["DELETE"])
def delete_customer(customer_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Customer not found"}), 404

    deal_ids = [r["id"] for r in conn.execute(
        "SELECT id FROM deals WHERE customer_id = ?", (customer_id,)
    ).fetchall()]

    for did in deal_ids:
        conn.execute("DELETE FROM order_status_history WHERE deal_id = ?", (did,))
        conn.execute("DELETE FROM deal_items WHERE deal_id = ?", (did,))
    conn.execute("DELETE FROM deals WHERE customer_id = ?", (customer_id,))
    conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": f"Customer and {len(deal_ids)} deal(s) deleted"})


# ============================================================
#  DEALS / ORDERS API
# ============================================================

@app.route("/api/deals", methods=["GET"])
def list_deals():
    status = request.args.get("status", "").strip()
    conn = get_db()
    if status:
        deals = conn.execute(
            "SELECT * FROM deals WHERE status = ? ORDER BY created_at DESC", (status,)
        ).fetchall()
    else:
        deals = conn.execute(
            "SELECT * FROM deals ORDER BY created_at DESC"
        ).fetchall()
    result = []
    for deal in deals:
        d = row_to_dict(deal)
        items = conn.execute(
            "SELECT * FROM deal_items WHERE deal_id = ?", (d["id"],)
        ).fetchall()
        d["items"] = [row_to_dict(i) for i in items]
        result.append(d)
    conn.close()
    return jsonify(result)


@app.route("/api/deals/stats", methods=["GET"])
def deal_stats():
    conn = get_db()
    row = conn.execute(
        """SELECT
            COUNT(*) as total_deals,
            COALESCE(SUM(total), 0) as total_revenue,
            COALESCE(SUM(profit), 0) as total_profit,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
            SUM(CASE WHEN status = 'shipping' THEN 1 ELSE 0 END) as shipping,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'returning' THEN 1 ELSE 0 END) as "returning",
            SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded
           FROM deals"""
    ).fetchone()
    conn.close()
    return jsonify(row_to_dict(row))


@app.route("/api/deals", methods=["POST"])
def create_deal():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    customer_id = data.get("customer_id", "").strip()
    customer_name = data.get("customer_name", "").strip()
    customer_phone = data.get("customer_phone", "").strip()
    customer_address = data.get("customer_address", "").strip()

    if not customer_id and not customer_name:
        return jsonify({"error": "Customer name or ID is required"}), 400

    items = data.get("items", [])
    if not items:
        return jsonify({"error": "At least one item is required"}), 400

    subtotal = sum(item["unit_price"] * item["qty"] for item in items)
    discount_pct = float(data.get("discount_pct", 0))
    discount_amt = subtotal * (discount_pct / 100)
    shipping_fee = max(float(data.get("shipping_fee", 0)), 0)
    total = subtotal - discount_amt + shipping_fee
    cost_total = sum((item.get("cost_price", 0) or 0) * item["qty"] for item in items)
    profit = total - cost_total

    deal_id = str(uuid.uuid4())
    ts = now_iso()
    notes = data.get("notes", "").strip()

    conn = get_db()

    # Auto-create customer if not provided
    if not customer_id and customer_name:
        cid = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO customers (id, name, phone, address, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (cid, customer_name, customer_phone, customer_address, ts, ts),
        )
        customer_id = cid
    elif customer_id:
        # Verify customer exists
        cust = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if cust:
            customer_name = cust["name"]
            customer_phone = cust["phone"]
            customer_address = cust["address"]
        else:
            conn.close()
            return jsonify({"error": "Customer not found"}), 404

    conn.execute(
        """INSERT INTO deals (id, customer_id, customer_name, customer_phone, customer_address,
           notes, subtotal, discount_pct, discount_amt, shipping_fee, total, cost_total, profit,
           status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
        (deal_id, customer_id, customer_name, customer_phone, customer_address,
         notes, subtotal, discount_pct, discount_amt, shipping_fee, total, cost_total, profit, ts, ts),
    )

    for item in items:
        line_total = item["unit_price"] * item["qty"]
        details = item.get("details", "")
        conn.execute(
            """INSERT INTO deal_items (id, deal_id, product_id, product_name, unit_price, cost_price, qty, line_total, details)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), deal_id, item.get("product_id", ""), item["name"],
             item["unit_price"], item.get("cost_price", 0) or 0, item["qty"], line_total, details),
        )

    # Record initial status
    conn.execute(
        """INSERT INTO order_status_history (id, deal_id, old_status, new_status, changed_at, note)
           VALUES (?, ?, '', 'pending', ?, 'Deal created')""",
        (str(uuid.uuid4()), deal_id, ts),
    )

    conn.commit()

    deal = row_to_dict(conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone())
    deal["items"] = [row_to_dict(i) for i in conn.execute(
        "SELECT * FROM deal_items WHERE deal_id = ?", (deal_id,)
    ).fetchall()]
    conn.close()
    return jsonify(deal), 201


@app.route("/api/deals/<deal_id>", methods=["GET"])
def get_deal(deal_id):
    conn = get_db()
    deal = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
    if not deal:
        conn.close()
        return jsonify({"error": "Deal not found"}), 404
    d = row_to_dict(deal)
    d["items"] = [row_to_dict(i) for i in conn.execute(
        "SELECT * FROM deal_items WHERE deal_id = ?", (deal_id,)
    ).fetchall()]
    d["history"] = [row_to_dict(h) for h in conn.execute(
        "SELECT * FROM order_status_history WHERE deal_id = ? ORDER BY changed_at ASC",
        (deal_id,),
    ).fetchall()]
    conn.close()
    return jsonify(d)


@app.route("/api/deals/<deal_id>/status", methods=["PUT"])
def update_deal_status(deal_id):
    VALID_STATUSES = ("pending", "confirmed", "processing", "shipping",
                      "delivered", "completed", "cancelled", "returning", "refunded")
    data = request.get_json()
    new_status = data.get("status", "").strip().lower() if data else ""
    note = data.get("note", "").strip() if data else ""

    if new_status not in VALID_STATUSES:
        return jsonify({"error": f"Status must be one of: {', '.join(VALID_STATUSES)}"}), 400

    conn = get_db()
    existing = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Deal not found"}), 404

    old_status = existing["status"]
    ts = now_iso()

    conn.execute(
        "UPDATE deals SET status = ?, updated_at = ? WHERE id = ?",
        (new_status, ts, deal_id),
    )
    conn.execute(
        """INSERT INTO order_status_history (id, deal_id, old_status, new_status, changed_at, note)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (str(uuid.uuid4()), deal_id, old_status, new_status, ts, note),
    )
    conn.commit()

    deal = row_to_dict(conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone())
    deal["items"] = [row_to_dict(i) for i in conn.execute(
        "SELECT * FROM deal_items WHERE deal_id = ?", (deal_id,)
    ).fetchall()]
    deal["history"] = [row_to_dict(h) for h in conn.execute(
        "SELECT * FROM order_status_history WHERE deal_id = ? ORDER BY changed_at ASC",
        (deal_id,),
    ).fetchall()]
    conn.close()
    return jsonify(deal)


@app.route("/api/deals/<deal_id>/history", methods=["GET"])
def deal_history(deal_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM order_status_history WHERE deal_id = ? ORDER BY changed_at ASC",
        (deal_id,),
    ).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/deals/<deal_id>", methods=["DELETE"])
def delete_deal(deal_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Deal not found"}), 404
    conn.execute("DELETE FROM order_status_history WHERE deal_id = ?", (deal_id,))
    conn.execute("DELETE FROM deal_items WHERE deal_id = ?", (deal_id,))
    conn.execute("DELETE FROM deals WHERE id = ?", (deal_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deal deleted"})


# ============================================================
#  CATEGORIES
# ============================================================

@app.route("/api/categories", methods=["GET"])
def list_categories():
    conn = get_db()
    rows = conn.execute("SELECT * FROM categories ORDER BY sort_order, name").fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/categories", methods=["POST"])
def create_category():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Tên danh mục là bắt buộc"}), 400
    cid = str(uuid.uuid4())
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO categories (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)",
            (cid, data["name"].strip(), int(data.get("sort_order", 0)), now_iso()),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Danh mục đã tồn tại"}), 400
    row = row_to_dict(conn.execute("SELECT * FROM categories WHERE id = ?", (cid,)).fetchone())
    conn.close()
    return jsonify(row), 201


@app.route("/api/categories/<cid>", methods=["PUT"])
def update_category(cid):
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Tên danh mục là bắt buộc"}), 400
    conn = get_db()
    try:
        conn.execute(
            "UPDATE categories SET name = ?, sort_order = ? WHERE id = ?",
            (data["name"].strip(), int(data.get("sort_order", 0)), cid),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Danh mục đã tồn tại"}), 400
    row = row_to_dict(conn.execute("SELECT * FROM categories WHERE id = ?", (cid,)).fetchone())
    conn.close()
    return jsonify(row)


@app.route("/api/categories/<cid>", methods=["DELETE"])
def delete_category(cid):
    conn = get_db()
    conn.execute("DELETE FROM categories WHERE id = ?", (cid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Đã xoá danh mục"})



# ============================================================
#  COMBOS
# ============================================================

@app.route("/api/combos", methods=["GET"])
def list_combos():
    conn = get_db()
    combos = conn.execute("SELECT * FROM combos ORDER BY created_at DESC").fetchall()
    result = []
    for combo in combos:
        c = row_to_dict(combo)
        items = conn.execute("SELECT * FROM combo_items WHERE combo_id = ?", (c["id"],)).fetchall()
        c["items"] = [row_to_dict(i) for i in items]
        original_price = sum(i["unit_price"] * i["qty"] for i in c["items"])
        c["original_price"] = original_price
        result.append(c)
    conn.close()
    return jsonify(result)


@app.route("/api/combos", methods=["POST"])
def create_combo():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Combo name is required"}), 400
    items = data.get("items", [])
    if len(items) < 1:
        return jsonify({"error": "A combo needs at least 1 product"}), 400
    combo_price = float(data.get("combo_price", 0))
    if combo_price <= 0:
        return jsonify({"error": "Combo price must be greater than 0"}), 400

    cost_total = sum((item.get("cost_price", 0) or 0) * item.get("qty", 1) for item in items)
    combo_id = str(uuid.uuid4())
    ts = now_iso()

    conn = get_db()
    conn.execute(
        """INSERT INTO combos (id, name, description, combo_price, cost_total, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (combo_id, data["name"].strip(), data.get("description", "").strip(),
         combo_price, cost_total, ts, ts),
    )
    for item in items:
        conn.execute(
            """INSERT INTO combo_items (id, combo_id, product_id, product_name, unit_price, cost_price, qty)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), combo_id, item["product_id"], item["product_name"],
             item["unit_price"], item.get("cost_price", 0) or 0, item.get("qty", 1)),
        )
    conn.commit()
    combo = row_to_dict(conn.execute("SELECT * FROM combos WHERE id = ?", (combo_id,)).fetchone())
    combo["items"] = [row_to_dict(i) for i in conn.execute("SELECT * FROM combo_items WHERE combo_id = ?", (combo_id,)).fetchall()]
    combo["original_price"] = sum(i["unit_price"] * i["qty"] for i in combo["items"])
    conn.close()
    return jsonify(combo), 201


@app.route("/api/combos/<combo_id>", methods=["PUT"])
def update_combo(combo_id):
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Combo name is required"}), 400
    items = data.get("items", [])
    if len(items) < 1:
        return jsonify({"error": "A combo needs at least 1 product"}), 400
    combo_price = float(data.get("combo_price", 0))
    if combo_price <= 0:
        return jsonify({"error": "Combo price must be greater than 0"}), 400

    cost_total = sum((item.get("cost_price", 0) or 0) * item.get("qty", 1) for item in items)
    ts = now_iso()

    conn = get_db()
    conn.execute(
        """UPDATE combos SET name = ?, description = ?, combo_price = ?, cost_total = ?, updated_at = ?
           WHERE id = ?""",
        (data["name"].strip(), data.get("description", "").strip(), combo_price, cost_total, ts, combo_id),
    )
    conn.execute("DELETE FROM combo_items WHERE combo_id = ?", (combo_id,))
    for item in items:
        conn.execute(
            """INSERT INTO combo_items (id, combo_id, product_id, product_name, unit_price, cost_price, qty)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), combo_id, item["product_id"], item["product_name"],
             item["unit_price"], item.get("cost_price", 0) or 0, item.get("qty", 1)),
        )
    conn.commit()
    combo = row_to_dict(conn.execute("SELECT * FROM combos WHERE id = ?", (combo_id,)).fetchone())
    combo["items"] = [row_to_dict(i) for i in conn.execute("SELECT * FROM combo_items WHERE combo_id = ?", (combo_id,)).fetchall()]
    combo["original_price"] = sum(i["unit_price"] * i["qty"] for i in combo["items"])
    conn.close()
    return jsonify(combo)


@app.route("/api/combos/<combo_id>", methods=["DELETE"])
def delete_combo(combo_id):
    conn = get_db()
    conn.execute("DELETE FROM combo_items WHERE combo_id = ?", (combo_id,))
    conn.execute("DELETE FROM combos WHERE id = ?", (combo_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Combo deleted"})


# Initialize DB on import (needed for Render/gunicorn)
with app.app_context():
    init_db()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
