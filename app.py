import csv
import io
import json
import sqlite3
import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DATABASE = "products.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            cost_price REAL DEFAULT 0,
            description TEXT DEFAULT '',
            category TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """
    )
    # Migrate: add cost_price column if missing
    cols = [row[1] for row in conn.execute("PRAGMA table_info(products)").fetchall()]
    if "cost_price" not in cols:
        conn.execute("ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS deals (
            id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            customer_phone TEXT DEFAULT '',
            customer_address TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            subtotal REAL NOT NULL,
            discount_pct REAL DEFAULT 0,
            discount_amt REAL DEFAULT 0,
            total REAL NOT NULL,
            cost_total REAL DEFAULT 0,
            profit REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS deal_items (
            id TEXT PRIMARY KEY,
            deal_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            unit_price REAL NOT NULL,
            cost_price REAL DEFAULT 0,
            qty INTEGER NOT NULL,
            line_total REAL NOT NULL,
            FOREIGN KEY (deal_id) REFERENCES deals(id)
        )
    """
    )
    conn.commit()
    conn.close()


def row_to_dict(row):
    return dict(row) if row else None


def now_iso():
    return datetime.now(timezone.utc).isoformat()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/products", methods=["GET"])
def list_products():
    search = request.args.get("search", "").strip()
    conn = get_db()
    if search:
        params = [f"%{search}%", f"%{search}%"]
        query = (
            "SELECT * FROM products WHERE name LIKE ? OR category LIKE ?"
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
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    conn = get_db()
    conn.execute(
        "INSERT INTO products (id, name, price, cost_price, description, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            product["id"],
            product["name"],
            product["price"],
            product["cost_price"],
            product["description"],
            product["category"],
            product["created_at"],
            product["updated_at"],
        ),
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
        "UPDATE products SET name = ?, price = ?, cost_price = ?, description = ?, category = ?, updated_at = ? WHERE id = ?",
        (name, price, cost_price, description, category, updated_at, product_id),
    )
    conn.commit()

    row = conn.execute(
        "SELECT * FROM products WHERE id = ?", (product_id,)
    ).fetchone()
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
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }

        conn.execute(
            "INSERT INTO products (id, name, price, cost_price, description, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                product["id"],
                product["name"],
                product["price"],
                product["cost_price"],
                product["description"],
                product["category"],
                product["created_at"],
                product["updated_at"],
            ),
        )
        imported.append(product)

    conn.commit()
    conn.close()

    return jsonify(
        {
            "imported": len(imported),
            "errors": errors,
            "products": imported,
        }
    ), 201 if imported else 400


@app.route("/api/customers", methods=["GET"])
def list_customers():
    conn = get_db()
    rows = conn.execute(
        """SELECT customer_name, customer_phone, customer_address,
           COUNT(*) as deal_count,
           SUM(total) as total_spent,
           SUM(CASE WHEN status IN ('pending','ongoing','returning') THEN 1 ELSE 0 END) as active_deals,
           SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as completed_deals,
           MAX(created_at) as last_deal_date
           FROM deals
           GROUP BY LOWER(customer_name)
           ORDER BY last_deal_date DESC"""
    ).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


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


@app.route("/api/deals", methods=["POST"])
def create_deal():
    data = request.get_json()
    if not data or not data.get("customer_name"):
        return jsonify({"error": "Customer name is required"}), 400
    items = data.get("items", [])
    if not items:
        return jsonify({"error": "At least one item is required"}), 400

    subtotal = sum(item["unit_price"] * item["qty"] for item in items)
    discount_pct = float(data.get("discount_pct", 0))
    discount_amt = subtotal * (discount_pct / 100)
    total = subtotal - discount_amt
    cost_total = sum((item.get("cost_price", 0) or 0) * item["qty"] for item in items)
    profit = total - cost_total

    deal_id = str(uuid.uuid4())
    ts = now_iso()

    conn = get_db()
    conn.execute(
        """INSERT INTO deals (id, customer_name, customer_phone, customer_address, notes,
           subtotal, discount_pct, discount_amt, total, cost_total, profit, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
        (deal_id, data["customer_name"].strip(), data.get("customer_phone", "").strip(),
         data.get("customer_address", "").strip(), data.get("notes", "").strip(),
         subtotal, discount_pct, discount_amt, total, cost_total, profit, ts, ts),
    )
    for item in items:
        line_total = item["unit_price"] * item["qty"]
        conn.execute(
            """INSERT INTO deal_items (id, deal_id, product_name, unit_price, cost_price, qty, line_total)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), deal_id, item["name"], item["unit_price"],
             item.get("cost_price", 0) or 0, item["qty"], line_total),
        )
    conn.commit()

    deal = row_to_dict(conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone())
    deal["items"] = [row_to_dict(i) for i in conn.execute("SELECT * FROM deal_items WHERE deal_id = ?", (deal_id,)).fetchall()]
    conn.close()
    return jsonify(deal), 201


@app.route("/api/deals/<deal_id>/status", methods=["PUT"])
def update_deal_status(deal_id):
    data = request.get_json()
    new_status = data.get("status", "").strip().lower() if data else ""
    if new_status not in ("pending", "ongoing", "returning", "done", "fail"):
        return jsonify({"error": "Status must be one of: pending, ongoing, returning, done, fail"}), 400

    conn = get_db()
    existing = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Deal not found"}), 404

    conn.execute(
        "UPDATE deals SET status = ?, updated_at = ? WHERE id = ?",
        (new_status, now_iso(), deal_id),
    )
    conn.commit()
    deal = row_to_dict(conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone())
    deal["items"] = [row_to_dict(i) for i in conn.execute("SELECT * FROM deal_items WHERE deal_id = ?", (deal_id,)).fetchall()]
    conn.close()
    return jsonify(deal)


@app.route("/api/deals/<deal_id>", methods=["DELETE"])
def delete_deal(deal_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Deal not found"}), 404
    conn.execute("DELETE FROM deal_items WHERE deal_id = ?", (deal_id,))
    conn.execute("DELETE FROM deals WHERE id = ?", (deal_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deal deleted"})


def _parse_csv(content):
    reader = csv.DictReader(io.StringIO(content))
    items = []
    for row in reader:
        items.append(
            {
                "name": row.get("name", ""),
                "price": row.get("price", "0"),
                "cost_price": row.get("cost_price", "0"),
                "description": row.get("description", ""),
                "category": row.get("category", ""),
            }
        )
    return items


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
