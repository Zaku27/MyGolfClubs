import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/analysis_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    // ProviderScope は Riverpod の必須ラッパー
    const ProviderScope(
      child: MyGolfBagApp(),
    ),
  );
}

class MyGolfBagApp extends StatelessWidget {
  const MyGolfBagApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My Golf Bag',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2E7D32), // golf green
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF2E7D32),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        tabBarTheme: const TabBarThemeData(
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
        ),
      ),
      home: const AnalysisScreen(),
    );
  }
}
