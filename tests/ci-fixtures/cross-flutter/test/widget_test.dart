import 'package:fixture_flutter/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('greet names the user', () => expect(greet('CI'), 'Hello, CI from Flutter'));

  testWidgets('the app shows the greeting', (tester) async {
    await tester.pumpWidget(const FixtureApp());
    expect(find.text('Hello, Groundwork from Flutter'), findsOneWidget);
  });
}
