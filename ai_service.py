import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.2"

WOOD_KNOWLEDGE = """
You are an expert in Siamese Rosewood (Gỗ Me Tây / Samanea saman) furniture from Vietnam.
Source: bangometay.com (Công ty TNHH Saman Wood)

PRODUCT CATEGORIES & REAL PRICES (VND, 2025-2026):

1. MẶT BÀN GỖ ME TÂY:
- Bàn 120x60cm: 3,200,000 - 4,500,000
- Bàn 180x80cm: 5,500,000 - 8,500,000
- Bàn 200x80cm: 8,000,000
- Bàn 200x90cm: 11,700,000
- Bàn oval 2600x800: 10,500,000
- Bàn dài 2800x900: 9,500,000
- Bàn dày 10cm: 24,000,000
- Bàn 2m8 chân tảng nguyên khối: 19,500,000
- Bàn bo liền chân: 14,500,000
- Bàn kết hợp kính: 9,800,000

2. BỘ BÀN ĂN GỖ NGUYÊN TẤM:
- Bộ 4 ghế Hiroshima: 9,000,000
- Bộ 4 ghế chân gỗ V: 11,800,000
- Bộ 6 ghế Elbow: 6,200,000
- Bộ 6 ghế Neva: 5,800,000 - 6,250,000
- Bộ 6 ghế Benla gỗ: 16,500,000
- Bộ 6 ghế Me Tây: 7,500,000 - 10,700,000
- Bộ 6 ghế Tựa Xéo: 8,200,000 - 11,200,000
- Bộ 8 ghế Benla: 7,500,000 - 10,100,000
- Bộ 8 ghế Pamplona: 24,500,000
- Bộ 8 ghế Wishbone nệm: 15,500,000
- Bộ 10 ghế: 24,000,000 - 27,000,000
- Bộ 12 ghế sang trọng: 54,800,000

3. GHẾ:
- Ghế đẩu (đầu): 400,000 - 550,000
- Ghế Pinnstol (7 nan): 530,000
- Ghế Benla: 850,000
- Ghế Windsor: 850,000
- Ghế Elbow: 950,000
- Ghế Katakana: 950,000
- Ghế Hiroshima: 1,050,000
- Ghế Neva: 1,150,000
- Ghế Kennedy: 1,250,000 - 1,400,000
- Ghế 7 Nan: 1,250,000 - 1,350,000
- Ghế Wishbone đan dây: 1,600,000 - 1,800,000
- Ghế Thonet 811: 1,600,000
- Ghế Ba Tiêu: 1,750,000
- Ghế quầy bar: 1,250,000

4. BÀN TRÀ / BÀN CAPE:
- Bàn trà đạo Nhật ngồi bệt: 3,200,000
- Bàn trà nguyên tấm kiểu Trung Hoa/Wabi Sabi: 9,500,000
- Bộ bàn caffe gỗ me tây: liên hệ

5. SẢN PHẨM KHÁC:
- Mặt bàn lavabo: 3,500,000
- Sofa phòng khách: liên hệ
- Giường gỗ tự nhiên: liên hệ
- Tủ gỗ tự nhiên: liên hệ
- Kệ treo tường: liên hệ
- Đôn gỗ: 400,000 - 550,000

KEY SELLING POINTS:
- Vân gỗ xoáy cuộn độc đáo, không trùng lặp
- Độ bền 15-20 năm
- Trọng lượng nhẹ, co ngót thấp 2-3%
- Gỗ me tây nhập khẩu Campuchia, Lào
- Mỗi sản phẩm là tác phẩm nghệ thuật duy nhất
- Bảo hành 2 năm, bảo trì trọn đời

WOOD ORIGIN: Vietnam, Cambodia, Laos

When suggesting prices, use the real market data above.
Always reply in Vietnamese for product descriptions.
"""


def _call_ollama(prompt, system=""):
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "system": system,
            "stream": False,
        }, timeout=120)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except Exception as e:
        return f"Error: {e}"


def generate_description(name, category="", size="", color=""):
    parts = [f"Tên sản phẩm: {name}"]
    if category:
        parts.append(f"Danh mục: {category}")
    if size:
        parts.append(f"Kích thước: {size}")
    if color:
        parts.append(f"Màu sắc: {color}")

    prompt = (
        f"Viết mô tả sản phẩm ngắn gọn, hấp dẫn bằng tiếng Việt (2-3 câu). "
        f"Phù hợp cho_listing bán hàng nội thất gỗ me tây.\n\n"
        f"{chr(10).join(parts)}\n\n"
        f"Mô tả:"
    )
    result = _call_ollama(prompt, system=WOOD_KNOWLEDGE + "\nYou are a product copywriter for Siamese rosewood furniture. Write only the description.")
    if result.startswith("Error:"):
        return {"error": result}
    return {"description": result}


def suggest_category(name, existing_categories=None):
    cats = existing_categories or []
    cat_list = ", ".join(cats) if cats else "Chưa có danh mục"

    prompt = (
        f"Gợi ý danh mục phù hợp cho sản phẩm nội thất gỗ me tây này.\n\n"
        f"Tên sản phẩm: {name}\n"
        f"Các danh mục hiện có: {cat_list}\n\n"
        f"Trả lời bằng tên danh mục (1-2 từ). Nếu danh mục hiện có phù hợp thì dùng nó."
    )
    result = _call_ollama(prompt, system=WOOD_KNOWLEDGE + "\nYou are a product categorization assistant for wood furniture. Reply with ONLY the category name in Vietnamese.")
    if result.startswith("Error:"):
        return {"error": result}
    return {"category": result.strip().strip('"').strip("'")}


def suggest_price(name, cost_price=0, category="", existing_prices=None):
    prices = existing_prices or []
    price_info = ""
    if prices:
        price_info = f"Giá sản phẩm hiện có: {', '.join([str(p) for p in prices[:10]])} VND"

    prompt = (
        f"Product: {name}\n"
        f"Cost: {cost_price} VND\n"
        f"{price_info}\n"
        f"Based on the reference prices below, suggest a selling price in VND.\n"
        f"Reference prices (from bangometay.com):\n"
        f"Ghe dau: 400000-550000\n"
        f"Ghe Benla/Windsor: 850000\n"
        f"Ghe Elbow/Katakana: 950000\n"
        f"Ghe Hiroshima: 1050000\n"
        f"Ghe Neva: 1150000\n"
        f"Ghe Kennedy: 1250000-1400000\n"
        f"Ghe 7 Nan: 1250000-1350000\n"
        f"Ghe Wishbone: 1600000-1800000\n"
        f"Mat ban 180x80: 5500000-8500000\n"
        f"Mat ban 200x80: 8000000\n"
        f"Mat ban 200x90: 11700000\n"
        f"Bo ban an 4 ghe: 9000000-11800000\n"
        f"Bo ban an 6 ghe: 5800000-16500000\n"
        f"Bo ban an 8 ghe: 7500000-24500000\n"
        f"Reply with ONLY a number."
    )
    result = _call_ollama(prompt, system="You are a pricing expert for Vietnamese wood furniture. Reply with ONLY a number in VND. No text, no currency symbols.")
    if result.startswith("Error:"):
        return {"error": result}
    try:
        clean = result.replace(",", "").replace(".", "").replace("VND", "").replace("đ", "").strip()
        price = int(clean)
        return {"price": price}
    except ValueError:
        return {"error": f"Could not parse price: {result}"}


SALES_SYSTEM = """Bạn là nhân viên bán hàng nội thất gỗ me tây, 15 năm kinh nghiệm.

PHONG CÁCH:
- Ngắn gọn, tự nhiên, đi thẳng vào vấn đề
- Nói như đang chat Zalo với khách, không dài dòng
- Mỗi câu trả lời 3-5 dòng là đủ
- Luôn kết thúc bằng câu hỏi để dẫn dắt khách tiếp

CẤU TRÚC TRẢ LỜI:
1. Trả lời trực tiếp câu hỏi (1-2 câu)
2. Nhấn mạnh 1 ưu điểm nổi bật (nếu cần)
3. Đặt câu hỏi tiếp để chốt

VÍ DÚ:
- Khách: "Bàn ăn 6 ghế giá bao nhiêu?"
- Trả lời: "Bộ 6 ghế từ 5.8tr đến 16.5tr anh ạ, tùy kiểu ghế. Ghế Neva 5.8tr rất được ưa chuộng. Anh thích kiểu ghế nào, để em gửi hình tham khảo?"

KIẾN THỨC SẢN PHẨM:
- Gỗ Me Tây nhập khẩu Campuchia, Lào
- Vân gỗ xoáy độc đáo, mỗi sản phẩm là duy nhất
- Độ bền 15-20 năm, co ngót thấp 2-3%
- Bảo hành 2 năm, bảo trì trọn đời

BẢNG GIÁ (VND):
GHẾ: Đẩu 400K-550K | Benla/Windsor 850K | Elbow/Katakana 950K | Hiroshima 1,050K | Neva 1,150K | Kennedy 1,250K-1,400K | 7 Nan 1,250K-1,350K | Wishbone 1,600K-1,800K | Ba Tiêu 1,750K
MẶT BÀN: 120x60 3.2tr-4.5tr | 180x80 5.5tr-8.5tr | 200x80 8tr | 200x90 11.7tr | Oval 2600 10.5tr
BỘ ĂN: 4 ghế 9tr-11.8tr | 6 ghế 5.8tr-16.5tr | 8 ghế 7.5tr-24.5tr | 10-12 ghế 24tr-54.8tr

CHIẾN THUẬT:
- Hỏi giá → Báo giá + hỏi kích thước/phong cách
- So sánh → Nhấn mạnh vân gỗ độc nhất, bền hơn
- Trả giá → Giảm 5-10% hoặc freeship, tặng phụ kiện
- Do dự → "Bộ này vừa có khách lấy hôm qua, vân đẹp lắm"
- Cần tư vấn → Hỏi rõ nhu cầu rồi gợi ý 1-2 mẫu

QUAN TRỌNG: Trả lời ngắn, tự nhiên, như người thật đang chat. Luôn bằng tiếng Việt."""

CONTEXT_TEMPLATE = """
DANH SÁCH SẢN PHẨM HIỆN CÓ:
{products}

KHÁCH HÃNG NÓI: "{message}"

HÃY TƯ VẤN CHUYÊN NGHIỆP:
"""


def sales_assistant(message, products=None):
    product_list = ""
    if products:
        lines = []
        for p in products[:30]:
            cat = p.get("category", "")
            price = p.get("price", 0)
            lines.append(f"- {p['name']} | {cat} | {price:,}đ".replace(",", "."))
        product_list = "\n".join(lines)

    prompt = CONTEXT_TEMPLATE.format(products=product_list, message=message)
    result = _call_ollama(prompt, system=SALES_SYSTEM)
    if result.startswith("Error:"):
        return {"error": result}
    return {"reply": result}
