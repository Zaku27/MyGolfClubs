import 'package:flutter/material.dart';
import 'dart:math' as math;

// ---------------------------------------------------------------------------
// Club category enum with display label and chart color
// ---------------------------------------------------------------------------
enum ClubCategory { driver, wood, hybrid, iron, wedge, putter }

extension ClubCategoryExtension on ClubCategory {
  String get label {
    switch (this) {
      case ClubCategory.driver:
        return 'Driver';
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
      case ClubCategory.driver:
        return const Color(0xFF1976D2); // Blue
      case ClubCategory.wood:
        return const Color(0xFF1565C0); // Blue
      case ClubCategory.hybrid:
        return const Color(0xFF00695C); // Teal
      case ClubCategory.iron:
        return const Color(0xFF2E7D32); // Green
      case ClubCategory.wedge:
        return const Color(0xFF9ACD32); // YellowGreen
      case ClubCategory.putter:
        return const Color(0xFF757575); // Grey
    }
  }
}

// ---------------------------------------------------------------------------
// GolfClub model - Updated structure with separate name and number
// ---------------------------------------------------------------------------
class GolfClub {
  final int id;
  final String clubType; // "Driver", "Wood", "Hybrid", "Iron", "Wedge", "Putter"
  final String name; // Manufacturer + Model only, e.g. "Ping G430", "Titleist T150"
  final String number; // Club number / loft designation, e.g. "7", "PW", "W", "3W", "4H", "SW"
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
    required this.number,
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
      ClubCategory.driver => 270.0 - 5.0 * loftAngle,
      ClubCategory.wood => 300.0 - 8.2222 * loftAngle + 0.1481 * loftAngle * loftAngle,
      ClubCategory.hybrid => 263.3333 - 3.3333 * loftAngle,
      ClubCategory.iron => 177.88 + 1.2559 * loftAngle - 0.0581 * loftAngle * loftAngle,
      ClubCategory.wedge => 235.0 - 2.5 * loftAngle,
      ClubCategory.putter => 10.0,
    };
    final speedPower = switch (category) {
      ClubCategory.driver => 1.15,
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
    return switch (clubType) {
      'Driver' => ClubCategory.driver,
      'Wood' => ClubCategory.wood,
      'Hybrid' => ClubCategory.hybrid,
      'Iron' => ClubCategory.iron,
      'Wedge' => ClubCategory.wedge,
      'Putter' => ClubCategory.putter,
      _ => ClubCategory.iron, // fallback
    };
  }

  GolfClub copyWith({
    int? id,
    String? clubType,
    String? name,
    String? number,
    double? loftAngle,
    double? length,
    double? weight,
    String? swingWeight,
    double? lieAngle,
    String? shaftType,
    double? torque,
    String? flex,
    double? distance,
    String? notes,
  }) =>
      GolfClub(
        id: id ?? this.id,
        clubType: clubType ?? this.clubType,
        name: name ?? this.name,
        number: number ?? this.number,
        loftAngle: loftAngle ?? this.loftAngle,
        length: length ?? this.length,
        weight: weight ?? this.weight,
        swingWeight: swingWeight ?? this.swingWeight,
        lieAngle: lieAngle ?? this.lieAngle,
        shaftType: shaftType ?? this.shaftType,
        torque: torque ?? this.torque,
        flex: flex ?? this.flex,
        distance: distance ?? this.distance,
        notes: notes ?? this.notes,
      );

  @override
  String toString() => 'GolfClub($name #$number, $clubType, loft: $loftAngle°, dist: ${distance}y)';
}
