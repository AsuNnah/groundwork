import 'package:flutter/material.dart';

String greet(String name) => 'Hello, $name from Flutter';

void main() => runApp(const FixtureApp());

class FixtureApp extends StatelessWidget {
  const FixtureApp({super.key});

  @override
  Widget build(BuildContext context) =>
      MaterialApp(home: Scaffold(body: Center(child: Text(greet('Groundwork')))));
}
