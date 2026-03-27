import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/golf_club.dart';

// ---------------------------------------------------------------------------
// Default club list — mirrors the TypeScript DEFAULT_CLUBS data
// ---------------------------------------------------------------------------
const List<GolfClub> _defaultClubs = [
  GolfClub(id: 1,  clubType: 'D',   name: 'Driver',       loftAngle: 10.5, length: 45.5,  weight: 310, swingWeight: 'D1', lieAngle: 58.0, shaftType: 'Graphite S',      torque: 4.5, flex: 'S', distance: 230),
  GolfClub(id: 2,  clubType: '3W',  name: '3-Wood',       loftAngle: 15.0, length: 43.0,  weight: 315, swingWeight: 'D1', lieAngle: 56.0, shaftType: 'Graphite S',      torque: 4.0, flex: 'S', distance: 210),
  GolfClub(id: 3,  clubType: '5W',  name: '5-Wood',       loftAngle: 18.0, length: 42.5,  weight: 314, swingWeight: 'D1', lieAngle: 56.5, shaftType: 'Graphite S',      torque: 4.0, flex: 'S', distance: 200),
  GolfClub(id: 4,  clubType: '4H',  name: 'Hybrid (4H)',  loftAngle: 22.0, length: 39.75, weight: 345, swingWeight: 'D1', lieAngle: 59.0, shaftType: 'Steel Regular',   torque: 3.5, flex: 'S', distance: 190),
  GolfClub(id: 5,  clubType: '5H',  name: 'Hybrid (5H)',  loftAngle: 25.0, length: 39.25, weight: 345, swingWeight: 'D1', lieAngle: 59.5, shaftType: 'Steel Regular',   torque: 3.5, flex: 'S', distance: 180),
  GolfClub(id: 6,  clubType: '6I',  name: '6-Iron',       loftAngle: 27.0, length: 37.5,  weight: 418, swingWeight: 'D1', lieAngle: 62.5, shaftType: 'Steel Regular',   torque: 2.5, flex: 'S', distance: 170),
  GolfClub(id: 7,  clubType: '7I',  name: '7-Iron',       loftAngle: 31.0, length: 37.0,  weight: 424, swingWeight: 'D1', lieAngle: 63.0, shaftType: 'Steel Regular',   torque: 2.5, flex: 'S', distance: 160),
  GolfClub(id: 8,  clubType: '8I',  name: '8-Iron',       loftAngle: 35.0, length: 36.5,  weight: 430, swingWeight: 'D1', lieAngle: 63.5, shaftType: 'Steel Regular',   torque: 2.5, flex: 'S', distance: 150),
  GolfClub(id: 9,  clubType: '9I',  name: '9-Iron',       loftAngle: 39.0, length: 36.0,  weight: 436, swingWeight: 'D1', lieAngle: 64.0, shaftType: 'Steel Regular',   torque: 2.5, flex: 'S', distance: 140),
  GolfClub(id: 10, clubType: 'PW',  name: 'PW',           loftAngle: 44.0, length: 35.5,  weight: 442, swingWeight: 'D1', lieAngle: 64.0, shaftType: 'Steel Regular',   torque: 2.5, flex: 'S', distance: 120),
  GolfClub(id: 11, clubType: '50',  name: '50 Wedge',     loftAngle: 50.0, length: 35.25, weight: 424, swingWeight: 'D1', lieAngle: 64.0, shaftType: 'Steel Regular',   torque: 2.5, flex: 'S', distance: 110),
  GolfClub(id: 12, clubType: '54',  name: '54 Wedge',     loftAngle: 54.0, length: 35.0,  weight: 424, swingWeight: 'D1', lieAngle: 64.0, shaftType: 'Steel Regular',   torque: 2.5, flex: 'S', distance: 100),
  GolfClub(id: 13, clubType: '58',  name: '58 Wedge',     loftAngle: 58.0, length: 34.75, weight: 424, swingWeight: 'D1', lieAngle: 64.0, shaftType: 'Steel Regular',   torque: 2.5, flex: 'S', distance:  90),
  GolfClub(id: 14, clubType: 'P',   name: 'Putter',       loftAngle:  3.0, length: 33.0,  weight: 350, swingWeight: 'D1', lieAngle: 70.0, shaftType: 'Steel',           torque: 2.0, flex: 'S', distance:   0),
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

// ---------------------------------------------------------------------------
// Derived provider: chart-ready clubs (loft 5–60°, putter excluded)
// Sorted by ascending loft angle.
// ---------------------------------------------------------------------------
final chartClubsProvider = Provider<List<GolfClub>>((ref) {
  final clubs = ref.watch(clubsProvider);
  return clubs
      .where((c) => c.loftAngle >= 5 && c.loftAngle <= 60)
      .toList()
    ..sort((a, b) => a.loftAngle.compareTo(b.loftAngle));
});
