# Product CRUD App

A web application for managing products with full CRUD (Create, Read, Update, Delete) functionality and bulk import via JSON/CSV.

## Features

- **Create** products with name, price, description, and category
- **Read** product list with search and statistics dashboard
- **Update** existing product information
- **Delete** products with confirmation dialog
- **Bulk Import** products from JSON or CSV files
- **Paste JSON** directly to import multiple products
- SQLite database for persistent storage
- Responsive Bootstrap 5 UI

## Tech Stack

- **Python** 3.10+ / **Flask** 3.x
- **SQLite** — Database for persistence
- **Bootstrap 5** — Responsive UI framework
- **Bootstrap Icons** — Icon set

## Project Structure

```
├── app.py                        # Flask app with API endpoints
├── requirements.txt              # Python dependencies
├── templates/
│   └── index.html                # Main page template
└── static/
    ├── css/
    │   └── style.css             # Custom styles
    └── js/
        └── app.js                # Frontend JavaScript
```

## Getting Started

### Prerequisites

- Python 3.10+

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run the app

```bash
python app.py
```

The app will be available at [http://localhost:5000](http://localhost:5000).

## API Endpoints

| Method | Endpoint               | Description            |
| ------ | ---------------------- | ---------------------- |
| GET    | `/api/products`        | List all products      |
| GET    | `/api/products/<id>`   | Get a single product   |
| POST   | `/api/products`        | Create a product       |
| PUT    | `/api/products/<id>`   | Update a product       |
| DELETE | `/api/products/<id>`   | Delete a product       |
| POST   | `/api/products/import` | Bulk import (JSON/CSV) |

### Bulk Import Formats

**JSON** (POST body or file upload):
```json
[
  {"name": "Laptop", "price": 999.99, "description": "High-performance", "category": "Electronics"},
  {"name": "Headphones", "price": 49.99, "category": "Electronics"}
]
```

**CSV** (file upload):
```csv
name,price,description,category
Laptop,999.99,High-performance,Electronics
Headphones,49.99,,Electronics
```
