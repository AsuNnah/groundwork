import 'package:fixture/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows hello', (tester) async {
    await tester.pumpWidget(const App());
    expect(find.text('hello'), findsOneWidget);
  });
}
