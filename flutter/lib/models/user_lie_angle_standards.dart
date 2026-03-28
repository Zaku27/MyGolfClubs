import 'golf_club.dart';

const Map<String, double> kDefaultLieAngleStandardsByClubType = {
  'D': 58.0,
  '3W': 56.0,
  '5W': 56.5,
  '4H': 59.0,
  '5H': 59.5,
  '6I': 61.5,
  '7I': 62.0,
  '8I': 62.5,
  '9I': 63.0,
  'PW': 64.0,
  '50': 64.0,
  '54': 64.0,
  '58': 64.0,
  'P': 70.0,
};

class UserLieAngleStandards {
  const UserLieAngleStandards({
    this.byClubType = const {},
    this.byClubName = const {},
  });

  final Map<String, double> byClubType;
  final Map<String, double> byClubName;

  double standardFor(GolfClub club) {
    final perClubKey = _perClubKey(club.name, club.clubType);
    final normalizedName = _normalizeKey(club.name);
    final normalizedType = _normalizeKey(club.clubType);

    final clubNameOverride = byClubName[perClubKey];
    if (clubNameOverride != null) {
      return clubNameOverride;
    }

    final clubTypeOverride = byClubType[normalizedType];
    if (clubTypeOverride != null) {
      return clubTypeOverride;
    }

    final defaultByType = kDefaultLieAngleStandardsByClubType[normalizedType];
    if (defaultByType != null) {
      return defaultByType;
    }

    if (double.tryParse(normalizedType) != null) {
      return 64.0;
    }

    final inferredType = _inferClubTypeFromNameOrLoft(club, normalizedName);
    if (inferredType != null) {
      final inferred = kDefaultLieAngleStandardsByClubType[inferredType];
      if (inferred != null) {
        return inferred;
      }
    }

    switch (club.category) {
      case ClubCategory.wood:
        return 57.0;
      case ClubCategory.hybrid:
        return 59.5;
      case ClubCategory.iron:
        return 62.0;
      case ClubCategory.wedge:
        return 64.0;
      case ClubCategory.putter:
        return 70.0;
    }
  }

  UserLieAngleStandards copyWith({
    Map<String, double>? byClubType,
    Map<String, double>? byClubName,
  }) {
    return UserLieAngleStandards(
      byClubType: byClubType ?? this.byClubType,
      byClubName: byClubName ?? this.byClubName,
    );
  }

  UserLieAngleStandards setClubTypeStandard(String clubType, double value) {
    final next = Map<String, double>.from(byClubType)
      ..[_normalizeKey(clubType)] = value;
    return copyWith(byClubType: next);
  }

  UserLieAngleStandards setClubNameStandard(String clubName, double value) {
    final next = Map<String, double>.from(byClubName)
      ..[_normalizeKey(clubName)] = value;
    return copyWith(byClubName: next);
  }

  UserLieAngleStandards clearClubTypeStandard(String clubType) {
    final next = Map<String, double>.from(byClubType)
      ..remove(_normalizeKey(clubType));
    return copyWith(byClubType: next);
  }

  UserLieAngleStandards clearClubNameStandard(String clubName) {
    final next = Map<String, double>.from(byClubName)
      ..remove(_normalizeKey(clubName));
    return copyWith(byClubName: next);
  }

  static String normalizeKey(String value) => _normalizeKey(value);

  static String perClubKey(String clubName, String clubType) =>
      _perClubKey(clubName, clubType);

  static String _normalizeKey(String value) => value.trim().toUpperCase();

  static String _perClubKey(String clubName, String clubType) =>
      '${_normalizeKey(clubName)}|${_normalizeKey(clubType)}';

  static String? _inferClubTypeFromNameOrLoft(
    GolfClub club,
    String normalizedName,
  ) {
    if (normalizedName.contains('DRIVER')) return 'D';
    if (normalizedName.contains('PUTTER')) return 'P';
    if (normalizedName.contains('PW') || normalizedName.contains('PITCHING')) {
      return 'PW';
    }

    final woodMatch =
        RegExp(r'\b(\d+)\s*-?\s*W(?:OOD)?\b').firstMatch(normalizedName);
    if (woodMatch != null) {
      return '${woodMatch.group(1)}W';
    }

    final hybridMatch =
        RegExp(r'\b(\d+)\s*-?\s*H(?:YBRID)?\b').firstMatch(normalizedName);
    if (hybridMatch != null) {
      return '${hybridMatch.group(1)}H';
    }

    final ironMatch =
        RegExp(r'\b([3-9])\s*-?\s*I(?:RON)?\b').firstMatch(normalizedName);
    if (ironMatch != null) {
      return '${ironMatch.group(1)}I';
    }

    final loft = club.loftAngle;
    switch (club.category) {
      case ClubCategory.wood:
        if (loft <= 13) return 'D';
        if (loft <= 16.5) return '3W';
        return '5W';
      case ClubCategory.hybrid:
        if (loft <= 23) return '4H';
        return '5H';
      case ClubCategory.iron:
        if (loft <= 29) return '6I';
        if (loft <= 33) return '7I';
        if (loft <= 37) return '8I';
        if (loft <= 41) return '9I';
        return 'PW';
      case ClubCategory.wedge:
        if (loft <= 52) return '50';
        if (loft <= 56) return '54';
        return '58';
      case ClubCategory.putter:
        return 'P';
    }
  }
}
