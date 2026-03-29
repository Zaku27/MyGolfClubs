import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/golf_club.dart';
import '../models/user_lie_angle_standards.dart';
import '../utils/club_sort.dart';

// ---------------------------------------------------------------------------
// Default club list — Updated with new structure: separate name and number
// ---------------------------------------------------------------------------
const List<GolfClub> _defaultClubs = [
  GolfClub(
      id: 1,
      clubType: 'Driver',
      name: 'Driver',
      number: '1',
      loftAngle: 10.5,
      length: 45.5,
      weight: 310,
      swingWeight: 'D1',
      lieAngle: 58.0,
      shaftType: 'Graphite S',
      torque: 4.5,
      flex: 'S',
      distance: 230),
  GolfClub(
      id: 2,
      clubType: 'Wood',
      name: 'Wood',
      number: '3',
      loftAngle: 15.0,
      length: 43.0,
      weight: 315,
      swingWeight: 'D1',
      lieAngle: 56.0,
      shaftType: 'Graphite S',
      torque: 4.0,
      flex: 'S',
      distance: 210),
  GolfClub(
      id: 3,
      clubType: 'Wood',
      name: 'Wood',
      number: '5',
      loftAngle: 18.0,
      length: 42.5,
      weight: 314,
      swingWeight: 'D1',
      lieAngle: 56.5,
      shaftType: 'Graphite S',
      torque: 4.0,
      flex: 'S',
      distance: 200),
  GolfClub(
      id: 4,
      clubType: 'Hybrid',
      name: 'Hybrid',
      number: '4',
      loftAngle: 22.0,
      length: 39.75,
      weight: 345,
      swingWeight: 'D1',
      lieAngle: 59.0,
      shaftType: 'Steel Regular',
      torque: 3.5,
      flex: 'S',
      distance: 190),
  GolfClub(
      id: 5,
      clubType: 'Hybrid',
      name: 'Hybrid',
      number: '5',
      loftAngle: 25.0,
      length: 39.25,
      weight: 345,
      swingWeight: 'D1',
      lieAngle: 59.5,
      shaftType: 'Steel Regular',
      torque: 3.5,
      flex: 'S',
      distance: 180),
  GolfClub(
      id: 6,
      clubType: 'Iron',
      name: 'Iron',
      number: '6',
      loftAngle: 27.0,
      length: 37.5,
      weight: 418,
      swingWeight: 'D1',
      lieAngle: 62.5,
      shaftType: 'Steel Regular',
      torque: 2.5,
      flex: 'S',
      distance: 170),
  GolfClub(
      id: 7,
      clubType: 'Iron',
      name: 'Iron',
      number: '7',
      loftAngle: 31.0,
      length: 37.0,
      weight: 424,
      swingWeight: 'D1',
      lieAngle: 63.0,
      shaftType: 'Steel Regular',
      torque: 2.5,
      flex: 'S',
      distance: 160),
  GolfClub(
      id: 8,
      clubType: 'Iron',
      name: 'Iron',
      number: '8',
      loftAngle: 35.0,
      length: 36.5,
      weight: 430,
      swingWeight: 'D1',
      lieAngle: 63.5,
      shaftType: 'Steel Regular',
      torque: 2.5,
      flex: 'S',
      distance: 150),
  GolfClub(
      id: 9,
      clubType: 'Iron',
      name: 'Iron',
      number: '9',
      loftAngle: 39.0,
      length: 36.0,
      weight: 436,
      swingWeight: 'D1',
      lieAngle: 64.0,
      shaftType: 'Steel Regular',
      torque: 2.5,
      flex: 'S',
      distance: 140),
  GolfClub(
      id: 10,
      clubType: 'Wedge',
      name: 'Wedge',
      number: 'PW',
      loftAngle: 44.0,
      length: 35.5,
      weight: 442,
      swingWeight: 'D1',
      lieAngle: 64.0,
      shaftType: 'Steel Regular',
      torque: 2.5,
      flex: 'S',
      distance: 120),
  GolfClub(
      id: 11,
      clubType: 'Wedge',
      name: 'Wedge',
      number: 'GW',
      loftAngle: 50.0,
      length: 35.25,
      weight: 424,
      swingWeight: 'D1',
      lieAngle: 64.0,
      shaftType: 'Steel Regular',
      torque: 2.5,
      flex: 'S',
      distance: 110),
  GolfClub(
      id: 12,
      clubType: 'Wedge',
      name: 'Wedge',
      number: 'SW',
      loftAngle: 54.0,
      length: 35.0,
      weight: 424,
      swingWeight: 'D1',
      lieAngle: 64.0,
      shaftType: 'Steel Regular',
      torque: 2.5,
      flex: 'S',
      distance: 100),
  GolfClub(
      id: 13,
      clubType: 'Wedge',
      name: 'Wedge',
      number: 'LW',
      loftAngle: 58.0,
      length: 34.75,
      weight: 424,
      swingWeight: 'D1',
      lieAngle: 64.0,
      shaftType: 'Steel Regular',
      torque: 2.5,
      flex: 'S',
      distance: 90),
  GolfClub(
      id: 14,
      clubType: 'Putter',
      name: 'Putter',
      number: 'P',
      loftAngle: 3.0,
      length: 33.0,
      weight: 350,
      swingWeight: 'D1',
      lieAngle: 70.0,
      shaftType: 'Steel',
      torque: 2.0,
      flex: 'S',
      distance: 0),
];

// ---------------------------------------------------------------------------
// Provider: club list state
// Actual Distance is sourced directly from each club.distance field.
// ---------------------------------------------------------------------------
class ClubsNotifier extends Notifier<List<GolfClub>> {
  @override
  List<GolfClub> build() {
    return _defaultClubs;
  }

  void updateClubDistance(int clubId, double yards) {
    state = [
      for (final club in state)
        if (club.id == clubId) club.copyWith(distance: yards) else club,
    ];
  }
}

final clubsProvider = NotifierProvider<ClubsNotifier, List<GolfClub>>(
  ClubsNotifier.new,
);

final sortedClubsProvider = Provider<List<GolfClub>>((ref) {
  final clubs = ref.watch(clubsProvider);
  return sortClubsForDisplay(clubs);
});

class HeadSpeedNotifier extends Notifier<double> {
  @override
  double build() => 42.0;

  void setHeadSpeed(double value) {
    state = value;
  }
}

final headSpeedProvider = NotifierProvider<HeadSpeedNotifier, double>(
  HeadSpeedNotifier.new,
);

class SwingWeightTargetNotifier extends Notifier<double> {
  static const double defaultTarget = 2.0;
  static const String _storageKey = 'golfbag-swing-weight-target';

  @override
  double build() {
    _loadSavedTarget();
    return defaultTarget;
  }

  Future<void> _loadSavedTarget() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getDouble(_storageKey);
    if (saved == null) return;
    state = _normalize(saved);
  }

  Future<void> setTarget(double value) async {
    final normalized = _normalize(value);
    state = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_storageKey, normalized);
  }

  Future<void> reset() async {
    state = defaultTarget;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_storageKey, defaultTarget);
  }

  double _normalize(double value) {
    final rounded = (value * 10).roundToDouble() / 10;
    return rounded.clamp(-30.0, 30.0);
  }
}

final swingWeightTargetProvider =
    NotifierProvider<SwingWeightTargetNotifier, double>(
  SwingWeightTargetNotifier.new,
);

class UserLieAngleStandardsNotifier extends Notifier<UserLieAngleStandards> {
  @override
  UserLieAngleStandards build() => const UserLieAngleStandards();

  void setClubTypeStandard(String clubType, double value) {
    state = state.setClubTypeStandard(clubType, value);
  }

  void setClubNameStandard(String clubName, double value) {
    state = state.setClubNameStandard(clubName, value);
  }

  void clearClubTypeStandard(String clubType) {
    state = state.clearClubTypeStandard(clubType);
  }

  void clearClubNameStandard(String clubName) {
    state = state.clearClubNameStandard(clubName);
  }

  void resetAll() {
    state = const UserLieAngleStandards();
  }
}

final userLieAngleStandardsProvider =
    NotifierProvider<UserLieAngleStandardsNotifier, UserLieAngleStandards>(
  UserLieAngleStandardsNotifier.new,
);

// ---------------------------------------------------------------------------
// Derived provider: chart-ready clubs (loft 5–60°, putter excluded)
// Sorted by ascending loft angle.
// ---------------------------------------------------------------------------
final chartClubsProvider = Provider<List<GolfClub>>((ref) {
  final clubs = ref.watch(clubsProvider);
  return sortClubsForDisplay(
    clubs.where((c) => c.loftAngle >= 5 && c.loftAngle <= 60).toList(),
  );
});
