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
    final perClubKey = _perClubKey(club.name, club.clubType, club.number);
    final normalizedName = _normalizeKey(club.name);
    final normalizedType = _standardTypeKeyForClub(club);
    final legacyType = _normalizeKey(club.clubType);

    final clubNameOverride = byClubName[perClubKey];
    if (clubNameOverride != null) {
      return clubNameOverride;
    }

    final clubTypeOverride =
        byClubType[normalizedType] ?? byClubType[legacyType];
    if (clubTypeOverride != null) {
      return clubTypeOverride;
    }

    final defaultByType = kDefaultLieAngleStandardsByClubType[normalizedType] ??
        kDefaultLieAngleStandardsByClubType[legacyType];
    if (defaultByType != null) {
      return defaultByType;
    }

    final inferredType = _inferClubTypeFromNameOrLoft(club, normalizedName);
    if (inferredType != null) {
      final inferred = kDefaultLieAngleStandardsByClubType[inferredType];
      if (inferred != null) {
        return inferred;
      }
    }

    return _fallbackForClubType(normalizedType);
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

  static String perClubKey(
    String clubName,
    String clubType, [
    String clubNumber = '',
  ]) =>
      _perClubKey(clubName, clubType, clubNumber);

  static String standardTypeKeyForClub(GolfClub club) =>
      _standardTypeKeyForClub(club);

  static String displayLabelForClubType(String clubType) {
    final normalized = _normalizeKey(clubType);
    switch (normalized) {
      case 'D':
        return 'Driver';
      case 'P':
        return 'Putter';
      default:
        return normalized;
    }
  }

  static double fallbackForClubType(String clubType) =>
      _fallbackForClubType(_normalizeKey(clubType));

  static int compareClubTypeOrder(String a, String b) {
    final ak = _clubTypeSortKey(a);
    final bk = _clubTypeSortKey(b);
    if (ak.$1 != bk.$1) return ak.$1.compareTo(bk.$1);
    if (ak.$2 != bk.$2) return ak.$2.compareTo(bk.$2);
    return ak.$3.compareTo(bk.$3);
  }

  static String _normalizeKey(String value) => value.trim().toUpperCase();

  static String _perClubKey(
    String clubName,
    String clubType, [
    String clubNumber = '',
  ]) {
    final normalizedName = _normalizeKey(clubName);
    final normalizedType = _normalizeKey(clubType);
    final normalizedNumber = _normalizeKey(clubNumber);

    if (normalizedNumber.isEmpty) {
      return '$normalizedName|$normalizedType';
    }

    return '$normalizedName|$normalizedType|$normalizedNumber';
  }

  static String _standardTypeKeyForClub(GolfClub club) {
    final normalizedName = _normalizeKey(club.name);
    final normalizedNumber = _normalizeKey(club.number);
    final legacyType = _normalizeKey(club.clubType);

    switch (club.category) {
      case ClubCategory.driver:
        return 'D';
      case ClubCategory.wood:
        final woodNumber = _extractLeadingNumber(normalizedNumber);
        if (woodNumber != null) {
          return woodNumber == 1 ? 'D' : '${woodNumber}W';
        }
        break;
      case ClubCategory.hybrid:
        final hybridNumber = _extractLeadingNumber(normalizedNumber);
        if (hybridNumber != null) {
          return '${hybridNumber}H';
        }
        break;
      case ClubCategory.iron:
        if (normalizedNumber == 'PW') {
          return 'PW';
        }
        final ironNumber = _extractLeadingNumber(normalizedNumber);
        if (ironNumber != null) {
          return '${ironNumber}I';
        }
        break;
      case ClubCategory.wedge:
        if (normalizedNumber == 'PW') {
          return 'PW';
        }
        final wedgeKey = _wedgeTypeKey(club.loftAngle, normalizedNumber);
        if (wedgeKey != null) {
          return wedgeKey;
        }
        break;
      case ClubCategory.putter:
        return 'P';
    }

    final inferred = _inferClubTypeFromNameOrLoft(club, normalizedName);
    if (inferred != null) {
      return inferred;
    }

    if (kDefaultLieAngleStandardsByClubType.containsKey(legacyType)) {
      return legacyType;
    }

    return _fallbackClubTypeKeyForCategory(club.category);
  }

  static int? _extractLeadingNumber(String value) {
    final match = RegExp(r'^(\d+)').firstMatch(value);
    if (match == null) {
      return null;
    }
    return int.tryParse(match.group(1)!);
  }

  static String? _wedgeTypeKey(double loftAngle, String normalizedNumber) {
    final numericLoft = double.tryParse(normalizedNumber) ?? loftAngle;
    if (!numericLoft.isFinite || numericLoft <= 0) {
      return null;
    }
    if (numericLoft <= 52) {
      return '50';
    }
    if (numericLoft <= 56) {
      return '54';
    }
    return '58';
  }

  static String _fallbackClubTypeKeyForCategory(ClubCategory category) {
    switch (category) {
      case ClubCategory.driver:
        return 'D';
      case ClubCategory.wood:
        return '3W';
      case ClubCategory.hybrid:
        return '5H';
      case ClubCategory.iron:
        return '7I';
      case ClubCategory.wedge:
        return '54';
      case ClubCategory.putter:
        return 'P';
    }
  }

  static double _fallbackForClubType(String clubType) {
    final normalized = _normalizeKey(clubType);
    final defaultByType = kDefaultLieAngleStandardsByClubType[normalized];
    if (defaultByType != null) {
      return defaultByType;
    }
    if (double.tryParse(normalized) != null) {
      return 64.0;
    }
    switch (normalized) {
      case 'D':
      case 'DRIVER':
        return 58.0;
      case 'WOOD':
        return 57.0;
      case 'HYBRID':
        return 59.5;
      case 'IRON':
        return 62.0;
      case 'WEDGE':
        return 64.0;
      case 'P':
      case 'PUTTER':
        return 70.0;
    }
    if (normalized.endsWith('W')) {
      return 57.0;
    }
    if (normalized.endsWith('H')) {
      return 59.5;
    }
    if (normalized.endsWith('I') || normalized == 'PW') {
      return 62.0;
    }
    return 64.0;
  }

  static (int, int, String) _clubTypeSortKey(String clubTypeRaw) {
    final clubType = _normalizeKey(clubTypeRaw);
    if (clubType == 'D' || clubType == 'DRIVER') return (0, 0, clubType);
    if (clubType == 'WOOD') return (1, 999, clubType);
    if (clubType == 'HYBRID') return (2, 999, clubType);
    if (clubType == 'PW') return (3, 10, clubType);
    if (clubType == 'IRON') return (3, 999, clubType);
    if (clubType.endsWith('W')) {
      final n = int.tryParse(clubType.replaceAll('W', '')) ?? 999;
      return (1, n, clubType);
    }
    if (clubType.endsWith('H')) {
      final n = int.tryParse(clubType.replaceAll('H', '')) ?? 999;
      return (2, n, clubType);
    }
    if (clubType.endsWith('I')) {
      final n = int.tryParse(clubType.replaceAll('I', '')) ?? 999;
      return (3, n, clubType);
    }
    if (clubType == 'WEDGE') return (5, 999, clubType);
    final wedgeLoft = double.tryParse(clubType);
    if (wedgeLoft != null) {
      return (5, wedgeLoft.round(), clubType);
    }
    if (clubType == 'P' || clubType == 'PUTTER') return (6, 0, clubType);
    return (7, 999, clubType);
  }

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
