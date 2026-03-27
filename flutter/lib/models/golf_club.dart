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

  // TrackMan-like loft-only approximation with a 42 m/s baseline.
  // Anchors: Driver 10.5° ≈ 230y, 7I 31° ≈ 160y, PW 44° ≈ 120y.
  double estimatedDistanceFor(double headSpeedMps) {
    final baseline = 269.13 - 3.832 * loftAngle + 0.0101 * loftAngle * loftAngle;
    final speedRatio = (headSpeedMps / 42.0).clamp(0.7, 1.35);
    final speedFactor = math.pow(speedRatio, 1.12).toDouble();
    return (baseline * speedFactor).clamp(0.0, 280.0);
  }

  double get estimatedDistance => estimatedDistanceFor(42.0);

  ClubCategory get category {
    if (clubType == 'D' || clubType.endsWith('W')) return ClubCategory.wood;
    if (clubType.endsWith('H')) return ClubCategory.hybrid;
    if (clubType == 'PW' || clubType.endsWith('I')) return ClubCategory.iron;
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
