import 'package:fixture_flutter/main.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

// runs on a device: the Android emulator and the iOS Simulator in CI
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the app shows the greeting on a device', (tester) async {
    await tester.pumpWidget(const FixtureApp());
    await tester.pumpAndSettle();
    expect(find.text('Hello, Groundwork from Flutter'), findsOneWidget);
  });
}
