# Product CRUD App

A simple Flutter mobile app for managing products with full CRUD (Create, Read, Update, Delete) functionality.

## Features

- **Create** products with name, price, description, and image
- **Read** product list and detailed product view
- **Update** existing product information
- **Delete** products with confirmation dialog
- Image picking from camera or gallery
- Local SQLite database for persistent storage
- Material 3 design with pull-to-refresh

## Tech Stack

- **Flutter** 3.44+ / Dart 3.12+
- **sqflite** — SQLite database for local persistence
- **image_picker** — Camera and gallery image selection
- **uuid** — Unique ID generation for products
- **intl** — Number/currency formatting

## Project Structure

```
lib/
├── main.dart                     # App entry point and theme
├── models/
│   └── product.dart              # Product data model
├── helpers/
│   └── database_helper.dart      # SQLite database operations
└── screens/
    ├── product_list_screen.dart   # Product listing with search
    ├── product_detail_screen.dart # Product detail view
    └── product_form_screen.dart   # Add/Edit product form
```

## Getting Started

### Prerequisites

- Flutter SDK 3.44+
- Android Studio / Xcode (for emulators)

### Run the app

```bash
flutter pub get
flutter run
```

### Run tests

```bash
flutter test
```

### Analyze

```bash
flutter analyze
```
