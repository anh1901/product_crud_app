import sqlite3
import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DATABASE = "deals.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS wood_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price_per_m2 REAL NOT NULL DEFAULT 0,
            cost_per_m2 REAL NOT NULL DEFAULT 0,
            description TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS leg_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0,
            cost_price REAL NOT NULL DEFAULT 0,
            description TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS chair_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0,
            cost_price REAL NOT NULL DEFAULT 0,
            description TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS deals (
            id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL DEFAULT '',
            customer_phone TEXT DEFAULT '',
            customer_address TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            table_width_cm REAL NOT NULL DEFAULT 0,
            table_length_cm REAL NOT NULL DEFAULT 0,
            table_area_m2 REAL NOT NULL DEFAULT 0,
            wood_type_id TEXT DEFAULT '',
            wood_type_name TEXT DEFAULT '',
            wood_price_per_m2 REAL DEFAULT 0,
            wood_total REAL DEFAULT 0,
            leg_type_id TEXT DEFAULT '',
            leg_type_name TEXT DEFAULT '',
            leg_price_each REAL DEFAULT 0,
            leg_qty INTEGER DEFAULT 0,
            leg_total REAL DEFAULT 0,
            chair_type_id TEXT DEFAULT '',
            chair_type_name TEXT DEFAULT '',
            chair_price_each REAL DEFAULT 0,
            chair_qty INTEGER DEFAULT 0,
            chair_total REAL DEFAULT 0,
            extra_fee REAL DEFAULT 0,
            extra_fee_note TEXT DEFAULT '',
            shipping_fee REAL DEFAULT 0,
            subtotal REAL DEFAULT 0,
            discount_percent REAL DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def row_to_dict(row):
    return dict(row) if row else None


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ── Pages ──

@app.route("/")
def index():
    return render_template("index.html")


# ── Wood Types CRUD ──

@app.route("/api/wood-types", methods=["GET"])
def list_wood_types():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM wood_types ORDER BY name"
    ).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/wood-types", methods=["POST"])
def create_wood_type():
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400
    try:
        price_per_m2 = max(float(data.get("price_per_m2", 0)), 0)
        cost_per_m2 = max(float(data.get("cost_per_m2", 0)), 0)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid price values"}), 400

    wid = str(uuid.uuid4())
    ts = now_iso()
    conn = get_db()
    conn.execute(
        "INSERT INTO wood_types (id, name, price_per_m2, cost_per_m2, description, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (wid, data["name"].strip(), price_per_m2, cost_per_m2,
         data.get("description", "").strip(), ts, ts),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM wood_types WHERE id = ?", (wid,)).fetchone())
    conn.close()
    return jsonify(row), 201


@app.route("/api/wood-types/<wid>", methods=["PUT"])
def update_wood_type(wid):
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400
    conn = get_db()
    existing = conn.execute("SELECT * FROM wood_types WHERE id = ?", (wid,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Wood type not found"}), 404
    try:
        price_per_m2 = max(float(data.get("price_per_m2", 0)), 0)
        cost_per_m2 = max(float(data.get("cost_per_m2", 0)), 0)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({"error": "Invalid price values"}), 400

    conn.execute(
        "UPDATE wood_types SET name = ?, price_per_m2 = ?, cost_per_m2 = ?, description = ?, updated_at = ? WHERE id = ?",
        (data["name"].strip(), price_per_m2, cost_per_m2,
         data.get("description", "").strip(), now_iso(), wid),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM wood_types WHERE id = ?", (wid,)).fetchone())
    conn.close()
    return jsonify(row)


@app.route("/api/wood-types/<wid>", methods=["DELETE"])
def delete_wood_type(wid):
    conn = get_db()
    existing = conn.execute("SELECT * FROM wood_types WHERE id = ?", (wid,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Wood type not found"}), 404
    conn.execute("DELETE FROM wood_types WHERE id = ?", (wid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Wood type deleted"})


# ── Leg Types CRUD ──

@app.route("/api/leg-types", methods=["GET"])
def list_leg_types():
    conn = get_db()
    rows = conn.execute("SELECT * FROM leg_types ORDER BY name").fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/leg-types", methods=["POST"])
def create_leg_type():
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400
    try:
        price = max(float(data.get("price", 0)), 0)
        cost_price = max(float(data.get("cost_price", 0)), 0)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid price values"}), 400

    lid = str(uuid.uuid4())
    ts = now_iso()
    conn = get_db()
    conn.execute(
        "INSERT INTO leg_types (id, name, price, cost_price, description, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (lid, data["name"].strip(), price, cost_price,
         data.get("description", "").strip(), ts, ts),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM leg_types WHERE id = ?", (lid,)).fetchone())
    conn.close()
    return jsonify(row), 201


@app.route("/api/leg-types/<lid>", methods=["PUT"])
def update_leg_type(lid):
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400
    conn = get_db()
    existing = conn.execute("SELECT * FROM leg_types WHERE id = ?", (lid,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Leg type not found"}), 404
    try:
        price = max(float(data.get("price", 0)), 0)
        cost_price = max(float(data.get("cost_price", 0)), 0)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({"error": "Invalid price values"}), 400

    conn.execute(
        "UPDATE leg_types SET name = ?, price = ?, cost_price = ?, description = ?, updated_at = ? WHERE id = ?",
        (data["name"].strip(), price, cost_price,
         data.get("description", "").strip(), now_iso(), lid),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM leg_types WHERE id = ?", (lid,)).fetchone())
    conn.close()
    return jsonify(row)


@app.route("/api/leg-types/<lid>", methods=["DELETE"])
def delete_leg_type(lid):
    conn = get_db()
    existing = conn.execute("SELECT * FROM leg_types WHERE id = ?", (lid,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Leg type not found"}), 404
    conn.execute("DELETE FROM leg_types WHERE id = ?", (lid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Leg type deleted"})


# ── Chair Types CRUD ──

@app.route("/api/chair-types", methods=["GET"])
def list_chair_types():
    conn = get_db()
    rows = conn.execute("SELECT * FROM chair_types ORDER BY name").fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/chair-types", methods=["POST"])
def create_chair_type():
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400
    try:
        price = max(float(data.get("price", 0)), 0)
        cost_price = max(float(data.get("cost_price", 0)), 0)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid price values"}), 400

    cid = str(uuid.uuid4())
    ts = now_iso()
    conn = get_db()
    conn.execute(
        "INSERT INTO chair_types (id, name, price, cost_price, description, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (cid, data["name"].strip(), price, cost_price,
         data.get("description", "").strip(), ts, ts),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM chair_types WHERE id = ?", (cid,)).fetchone())
    conn.close()
    return jsonify(row), 201


@app.route("/api/chair-types/<cid>", methods=["PUT"])
def update_chair_type(cid):
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "Name is required"}), 400
    conn = get_db()
    existing = conn.execute("SELECT * FROM chair_types WHERE id = ?", (cid,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Chair type not found"}), 404
    try:
        price = max(float(data.get("price", 0)), 0)
        cost_price = max(float(data.get("cost_price", 0)), 0)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({"error": "Invalid price values"}), 400

    conn.execute(
        "UPDATE chair_types SET name = ?, price = ?, cost_price = ?, description = ?, updated_at = ? WHERE id = ?",
        (data["name"].strip(), price, cost_price,
         data.get("description", "").strip(), now_iso(), cid),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM chair_types WHERE id = ?", (cid,)).fetchone())
    conn.close()
    return jsonify(row)


@app.route("/api/chair-types/<cid>", methods=["DELETE"])
def delete_chair_type(cid):
    conn = get_db()
    existing = conn.execute("SELECT * FROM chair_types WHERE id = ?", (cid,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Chair type not found"}), 404
    conn.execute("DELETE FROM chair_types WHERE id = ?", (cid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Chair type deleted"})


# ── Deals CRUD ──

@app.route("/api/deals", methods=["GET"])
def list_deals():
    status = request.args.get("status", "").strip()
    search = request.args.get("search", "").strip()
    conn = get_db()

    query = "SELECT * FROM deals"
    conditions = []
    params = []

    if status:
        conditions.append("status = ?")
        params.append(status)
    if search:
        conditions.append(
            "(customer_name LIKE ? OR customer_phone LIKE ? OR customer_address LIKE ?)"
        )
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC"

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/deals/<deal_id>", methods=["GET"])
def get_deal(deal_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Deal not found"}), 404
    return jsonify(row_to_dict(row))


@app.route("/api/deals", methods=["POST"])
def create_deal():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        width = max(float(data.get("table_width_cm", 0)), 0)
        length = max(float(data.get("table_length_cm", 0)), 0)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid table dimensions"}), 400

    area_m2 = (width * length) / 10000

    try:
        wood_price_per_m2 = max(float(data.get("wood_price_per_m2", 0)), 0)
        leg_price_each = max(float(data.get("leg_price_each", 0)), 0)
        leg_qty = max(int(data.get("leg_qty", 0)), 0)
        chair_price_each = max(float(data.get("chair_price_each", 0)), 0)
        chair_qty = max(int(data.get("chair_qty", 0)), 0)
        extra_fee = max(float(data.get("extra_fee", 0)), 0)
        shipping_fee = max(float(data.get("shipping_fee", 0)), 0)
        discount_percent = min(max(float(data.get("discount_percent", 0)), 0), 100)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numeric values"}), 400

    wood_total = area_m2 * wood_price_per_m2
    leg_total = leg_price_each * leg_qty
    chair_total = chair_price_each * chair_qty
    subtotal = wood_total + leg_total + chair_total + extra_fee
    discount_amount = subtotal * (discount_percent / 100)
    total = subtotal - discount_amount + shipping_fee

    deal_id = str(uuid.uuid4())
    ts = now_iso()

    conn = get_db()
    conn.execute(
        """INSERT INTO deals (
            id, customer_name, customer_phone, customer_address, notes,
            table_width_cm, table_length_cm, table_area_m2,
            wood_type_id, wood_type_name, wood_price_per_m2, wood_total,
            leg_type_id, leg_type_name, leg_price_each, leg_qty, leg_total,
            chair_type_id, chair_type_name, chair_price_each, chair_qty, chair_total,
            extra_fee, extra_fee_note, shipping_fee,
            subtotal, discount_percent, discount_amount, total,
            status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            deal_id,
            data.get("customer_name", "").strip(),
            data.get("customer_phone", "").strip(),
            data.get("customer_address", "").strip(),
            data.get("notes", "").strip(),
            width, length, area_m2,
            data.get("wood_type_id", ""),
            data.get("wood_type_name", ""),
            wood_price_per_m2, wood_total,
            data.get("leg_type_id", ""),
            data.get("leg_type_name", ""),
            leg_price_each, leg_qty, leg_total,
            data.get("chair_type_id", ""),
            data.get("chair_type_name", ""),
            chair_price_each, chair_qty, chair_total,
            extra_fee,
            data.get("extra_fee_note", "").strip(),
            shipping_fee,
            subtotal, discount_percent, discount_amount, total,
            "pending", ts, ts,
        ),
    )
    conn.commit()
    deal = row_to_dict(conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone())
    conn.close()
    return jsonify(deal), 201


@app.route("/api/deals/<deal_id>", methods=["PUT"])
def update_deal(deal_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db()
    existing = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Deal not found"}), 404

    try:
        width = max(float(data.get("table_width_cm", existing["table_width_cm"])), 0)
        length = max(float(data.get("table_length_cm", existing["table_length_cm"])), 0)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({"error": "Invalid table dimensions"}), 400

    area_m2 = (width * length) / 10000

    try:
        wood_price_per_m2 = max(float(data.get("wood_price_per_m2", existing["wood_price_per_m2"])), 0)
        leg_price_each = max(float(data.get("leg_price_each", existing["leg_price_each"])), 0)
        leg_qty = max(int(data.get("leg_qty", existing["leg_qty"])), 0)
        chair_price_each = max(float(data.get("chair_price_each", existing["chair_price_each"])), 0)
        chair_qty = max(int(data.get("chair_qty", existing["chair_qty"])), 0)
        extra_fee = max(float(data.get("extra_fee", existing["extra_fee"])), 0)
        shipping_fee = max(float(data.get("shipping_fee", existing["shipping_fee"])), 0)
        discount_percent = min(max(float(data.get("discount_percent", existing["discount_percent"])), 0), 100)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({"error": "Invalid numeric values"}), 400

    wood_total = area_m2 * wood_price_per_m2
    leg_total = leg_price_each * leg_qty
    chair_total = chair_price_each * chair_qty
    subtotal = wood_total + leg_total + chair_total + extra_fee
    discount_amount = subtotal * (discount_percent / 100)
    total = subtotal - discount_amount + shipping_fee

    conn.execute(
        """UPDATE deals SET
            customer_name = ?, customer_phone = ?, customer_address = ?, notes = ?,
            table_width_cm = ?, table_length_cm = ?, table_area_m2 = ?,
            wood_type_id = ?, wood_type_name = ?, wood_price_per_m2 = ?, wood_total = ?,
            leg_type_id = ?, leg_type_name = ?, leg_price_each = ?, leg_qty = ?, leg_total = ?,
            chair_type_id = ?, chair_type_name = ?, chair_price_each = ?, chair_qty = ?, chair_total = ?,
            extra_fee = ?, extra_fee_note = ?, shipping_fee = ?,
            subtotal = ?, discount_percent = ?, discount_amount = ?, total = ?,
            updated_at = ?
        WHERE id = ?""",
        (
            data.get("customer_name", existing["customer_name"]).strip(),
            data.get("customer_phone", existing["customer_phone"]).strip(),
            data.get("customer_address", existing["customer_address"]).strip(),
            data.get("notes", existing["notes"]).strip(),
            width, length, area_m2,
            data.get("wood_type_id", existing["wood_type_id"]),
            data.get("wood_type_name", existing["wood_type_name"]),
            wood_price_per_m2, wood_total,
            data.get("leg_type_id", existing["leg_type_id"]),
            data.get("leg_type_name", existing["leg_type_name"]),
            leg_price_each, leg_qty, leg_total,
            data.get("chair_type_id", existing["chair_type_id"]),
            data.get("chair_type_name", existing["chair_type_name"]),
            chair_price_each, chair_qty, chair_total,
            extra_fee,
            data.get("extra_fee_note", existing["extra_fee_note"]).strip(),
            shipping_fee,
            subtotal, discount_percent, discount_amount, total,
            now_iso(), deal_id,
        ),
    )
    conn.commit()
    deal = row_to_dict(conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone())
    conn.close()
    return jsonify(deal)


@app.route("/api/deals/<deal_id>/status", methods=["PUT"])
def update_deal_status(deal_id):
    data = request.get_json()
    new_status = data.get("status", "").strip().lower() if data else ""
    valid_statuses = ("pending", "on_delivery", "success", "returning", "fail")
    if new_status not in valid_statuses:
        return jsonify({"error": f"Status must be one of: {', '.join(valid_statuses)}"}), 400

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
    conn.close()
    return jsonify(deal)


@app.route("/api/deals/<deal_id>", methods=["DELETE"])
def delete_deal(deal_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM deals WHERE id = ?", (deal_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Deal not found"}), 404
    conn.execute("DELETE FROM deals WHERE id = ?", (deal_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deal deleted"})


# ── Dashboard Stats ──

@app.route("/api/stats", methods=["GET"])
def get_stats():
    conn = get_db()
    total_deals = conn.execute("SELECT COUNT(*) as c FROM deals").fetchone()["c"]
    pending = conn.execute("SELECT COUNT(*) as c FROM deals WHERE status = 'pending'").fetchone()["c"]
    on_delivery = conn.execute("SELECT COUNT(*) as c FROM deals WHERE status = 'on_delivery'").fetchone()["c"]
    success = conn.execute("SELECT COUNT(*) as c FROM deals WHERE status = 'success'").fetchone()["c"]
    returning = conn.execute("SELECT COUNT(*) as c FROM deals WHERE status = 'returning'").fetchone()["c"]
    fail = conn.execute("SELECT COUNT(*) as c FROM deals WHERE status = 'fail'").fetchone()["c"]
    total_revenue = conn.execute("SELECT COALESCE(SUM(total), 0) as s FROM deals WHERE status = 'success'").fetchone()["s"]
    conn.close()
    return jsonify({
        "total_deals": total_deals,
        "pending": pending,
        "on_delivery": on_delivery,
        "success": success,
        "returning": returning,
        "fail": fail,
        "total_revenue": total_revenue,
    })


# ── Customers (derived from deals) ──

@app.route("/api/customers", methods=["GET"])
def list_customers():
    conn = get_db()
    rows = conn.execute("""
        SELECT customer_name, customer_phone, customer_address,
            COUNT(*) as deal_count,
            COALESCE(SUM(total), 0) as total_spent,
            SUM(CASE WHEN status IN ('pending', 'on_delivery', 'returning') THEN 1 ELSE 0 END) as active_deals,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as completed_deals,
            MAX(created_at) as last_deal_date
        FROM deals
        WHERE customer_name != ''
        GROUP BY LOWER(customer_name)
        ORDER BY last_deal_date DESC
    """).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
