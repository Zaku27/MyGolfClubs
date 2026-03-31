import '../models/golf_club.dart';

String _normalizeSortText(String value) {
  return value.trim().toUpperCase().replaceAll(RegExp(r'[\s-]'), '');
}

bool isPutterClub(GolfClub club) {
  final type = _normalizeSortText(club.clubType);
  final name = _normalizeSortText(club.name);
  return type == 'P' || type == 'PUTTER' || name.contains('PUTTER');
}

int compareClubsForDisplay(GolfClub a, GolfClub b) {
  final aPutter = isPutterClub(a);
  final bPutter = isPutterClub(b);
  if (aPutter && !bPutter) return 1;
  if (!aPutter && bPutter) return -1;

  final loftDiff = a.loftAngle.compareTo(b.loftAngle);
  if (loftDiff != 0) return loftDiff;

  final lengthDiff = a.length.compareTo(b.length);
  if (lengthDiff != 0) return lengthDiff;

  return a.name.compareTo(b.name);
}

List<GolfClub> sortClubsForDisplay(List<GolfClub> clubs) {
  return [...clubs]..sort(compareClubsForDisplay);
}
