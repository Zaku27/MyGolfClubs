import 'package:flutter/material.dart';
import 'dart:math' as math;

// ---------------------------------------------------------------------------
// Club category enum with display label and chart color
// ---------------------------------------------------------------------------
enum ClubCategory { wood, hybrid, iron, wedge, putter }

extension ClubCategoryExtension on ClubCategory {
  String get label {
    switch (this) {
      case ClubCategory.wood:
        return 'Wood';
      case ClubCategory.hybrid:
        return 'Hybrid';
      case ClubCategory.iron:
        return 'Iron';
      case ClubCategory.wedge:
        return 'Wedge';
      case ClubCategory.putter:
        return 'Putter';
    }
  }

  Color get color {
    switch (this) {
      case ClubCategory.wood:
        return const Color(0xFF1565C0); // Blue
      case ClubCategory.hybrid:
        return const Color(0xFF00695C); // Teal
      case ClubCategory.iron:
        return const Color(0xFF2E7D32); // Green
      case ClubCategory.wedge:
        return const Color(0xFFC62828); // Red
      case ClubCategory.putter:
        return const Color(0xFF757575); // Grey
    }
  }
}

// ---------------------------------------------------------------------------
// GolfClub model
// ---------------------------------------------------------------------------
class GolfClub {
  final int id;
  final String clubType; // 'D', '3W', '5W', '4H', '6I', 'PW', '50', 'P', …
  final String name;
  final double loftAngle; // degrees
  final double length; // inches
  final double weight; // grams
  final String swingWeight;
  final double lieAngle; // degrees
  final String shaftType;
  final double torque;
  final String flex; // 'S', 'SR', 'R', 'A', 'L'
  final double distance; // stored actual carry distance (yards), 0 = not set
  final String notes;

  const GolfClub({
    required this.id,
    required this.clubType,
    required this.name,
    required this.loftAngle,
    this.length = 0,
    this.weight = 0,
    this.swingWeight = '',
    this.lieAngle = 0,
    this.shaftType = '',
    this.torque = 0,
    this.flex = 'R',
    this.distance = 0,
    this.notes = '',
  });

  // Club-category specific curve with a 42 m/s baseline.
  // Each category has a separate loft-distance curve plus speed scaling.
  double estimatedDistanceFor(double headSpeedMps) {
    final categoryBaseline = switch (category) {
      ClubCategory.wood => 300.0 - 8.2222 * loftAngle + 0.1481 * loftAngle * loftAngle,
      ClubCategory.hybrid => 263.3333 - 3.3333 * loftAngle,
      ClubCategory.iron => 177.88 + 1.2559 * loftAngle - 0.0581 * loftAngle * loftAngle,
      ClubCategory.wedge => 235.0 - 2.5 * loftAngle,
      ClubCategory.putter => 10.0,
    };
    final speedPower = switch (category) {
      ClubCategory.wood => 1.14,
      ClubCategory.hybrid => 1.12,
      ClubCategory.iron => 1.08,
      ClubCategory.wedge => 1.03,
      ClubCategory.putter => 1.00,
    };
    final speedRatio = (headSpeedMps / 42.0).clamp(0.7, 1.35);
    final speedFactor = math.pow(speedRatio, speedPower).toDouble();
    return (categoryBaseline * speedFactor).clamp(0.0, 290.0);
  }

  double get estimatedDistance => estimatedDistanceFor(42.0);

  ClubCategory get category {
    if (clubType == 'PW') return ClubCategory.iron;
    if (clubType == 'D' || clubType.endsWith('W')) return ClubCategory.wood;
    if (clubType.endsWith('H')) return ClubCategory.hybrid;
    if (clubType.endsWith('I')) return ClubCategory.iron;
    if (clubType == 'P') return ClubCategory.putter;
    // Numeric types like '50', '54', '58' are wedges
    if (double.tryParse(clubType) != null) return ClubCategory.wedge;
    return ClubCategory.iron;
  }

  GolfClub copyWith({double? distance}) => GolfClub(
        id: id,
        clubType: clubType,
        name: name,
        loftAngle: loftAngle,
        length: length,
        weight: weight,
        swingWeight: swingWeight,
        lieAngle: lieAngle,
        shaftType: shaftType,
        torque: torque,
        flex: flex,
        distance: distance ?? this.distance,
        notes: notes,
      );

  @override
  String toString() => 'GolfClub($clubType, loft: $loftAngle°, dist: ${distance}y)';
}
