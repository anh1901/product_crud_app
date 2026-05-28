import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:product_crud_app/main.dart';

void main() {
  testWidgets('App shows product list screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ProductCrudApp());

    expect(find.text('Products'), findsOneWidget);
    expect(find.text('No products yet'), findsOneWidget);
    expect(find.byIcon(Icons.add), findsOneWidget);
  });
}
