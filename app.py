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
