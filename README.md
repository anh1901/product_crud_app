# Custom Table Deals

A web app for calculating custom table prices and managing customer deals.

## Features

- **Price Calculator**: Configure table dimensions, wood type, legs, chairs, extra fees, and shipping to get an instant price breakdown
- **Deal Management**: Save deals with customer info, track status (pending, on delivery, success, returning, fail)
- **Component CRUD**: Manage wood types, leg types, and chair types with prices
- **Customer View**: See all customers derived from deals with total spending stats
- **Dashboard Stats**: Overview of deal counts by status and total revenue
- **Responsive**: Works on desktop and mobile

## Tech Stack

- **Flask** (Python) — Backend API + server-rendered template
- **SQLite** — Local database
- **Vanilla JS** — Single-page app frontend
- **CSS** — Custom responsive design

## Getting Started

### Prerequisites

- Python 3.10+

### Install & Run

```bash
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000 in your browser.

## API Endpoints

### Components
- `GET/POST /api/wood-types` — List / create wood types
- `PUT/DELETE /api/wood-types/<id>` — Update / delete wood type
- `GET/POST /api/leg-types` — List / create leg types
- `PUT/DELETE /api/leg-types/<id>` — Update / delete leg type
- `GET/POST /api/chair-types` — List / create chair types
- `PUT/DELETE /api/chair-types/<id>` — Update / delete chair type

### Deals
- `GET/POST /api/deals` — List (filter by `?status=`) / create deal
- `GET/PUT/DELETE /api/deals/<id>` — Get / update / delete deal
- `PUT /api/deals/<id>/status` — Update deal status

### Other
- `GET /api/stats` — Dashboard statistics
- `GET /api/customers` — Customer list (derived from deals)
