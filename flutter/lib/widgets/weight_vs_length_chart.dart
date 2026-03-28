import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../models/golf_club.dart';

class WeightVsLengthChart extends StatelessWidget {
  const WeightVsLengthChart({super.key, required this.clubs});

  final List<GolfClub> clubs;

  static const double _minX = 30;
  static const double _maxX = 48;
  static const double _minY = 200;
  static const double _maxY = 450;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (clubs.isEmpty) {
      return _ChartFrame(
        child: SizedBox(
          height: 360,
          child: Center(
            child: Text(
              'No clubs added yet',
              style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      );
    }

    final measuredClubs = clubs
        .where((club) => _readLengthInInches(club) > 0 && _readWeightInGrams(club) > 0)
        .toList(growable: false);

    if (measuredClubs.isEmpty) {
      return _ChartFrame(
        child: SizedBox(
          height: 360,
          child: Center(
            child: Text(
              'No measurable club data available',
              style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      );
    }

    final spotToClub = <ScatterSpot, GolfClub>{};
    final spots = <ScatterSpot>[];

    for (final club in measuredClubs) {
      final spot = ScatterSpot(
        _readLengthInInches(club),
        _readWeightInGrams(club),
        dotPainter: FlDotCirclePainter(
          radius: _dotRadius(club),
          color: _clubColor(club),
          strokeWidth: 1.2,
          strokeColor: Colors.white,
        ),
      );
      spots.add(spot);
      spotToClub[spot] = club;
    }

    return _ChartFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Weight vs Length',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: const Color(0xFF1B5E20),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 340,
            child: ScatterChart(
              ScatterChartData(
                minX: _minX,
                maxX: _maxX,
                minY: _minY,
                maxY: _maxY,
                scatterSpots: spots,
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    axisNameWidget: const RotatedBox(
                      quarterTurns: 3,
                      child: Text('Club Weight (grams)'),
                    ),
                    axisNameSize: 28,
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 50,
                      reservedSize: 46,
                      getTitlesWidget: (value, meta) => Text(
                        value.toInt().toString(),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    axisNameWidget: const Text('Club Length (inches)'),
                    axisNameSize: 28,
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 2,
                      reservedSize: 34,
                      getTitlesWidget: (value, meta) => Text(
                        value.toInt().toString(),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                ),
                gridData: FlGridData(
                  show: true,
                  horizontalInterval: 25,
                  verticalInterval: 1,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: theme.colorScheme.outlineVariant.withValues(alpha: 0.35),
                    strokeWidth: 1,
                  ),
                  getDrawingVerticalLine: (_) => FlLine(
                    color: theme.colorScheme.outlineVariant.withValues(alpha: 0.25),
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(
                  show: true,
                  border: Border.all(
                    color: theme.colorScheme.outlineVariant,
                  ),
                ),
                scatterTouchData: ScatterTouchData(
                  enabled: true,
                  touchTooltipData: ScatterTouchTooltipData(
                    getTooltipColor: (_) => const Color(0xEE1F2933),
                    tooltipPadding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    getTooltipItems: (spot) {
                      final club = spotToClub[spot] ?? _matchClubForSpot(spot, measuredClubs);
                      if (club == null) {
                        return ScatterTooltipItem(
                          'Unknown club',
                          textStyle: const TextStyle(color: Colors.white, fontSize: 12),
                        );
                      }

                      final length = _readLengthInInches(club);
                      final weight = _readWeightInGrams(club);

                      return ScatterTooltipItem(
                        '${club.name}\n'
                        'Type: ${_clubTypeLabel(club)}\n'
                        'Length: ${length.toStringAsFixed(2)} in\n'
                        'Weight: ${weight.toStringAsFixed(1)} g',
                        textStyle: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const _WeightLengthLegend(),
          const SizedBox(height: 18),
          Text(
            'Club Specs',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: const Color(0xFF1B5E20),
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStatePropertyAll(
                theme.colorScheme.secondaryContainer.withValues(alpha: 0.55),
              ),
              columns: const [
                DataColumn(label: Text('Club Name')),
                DataColumn(label: Text('Type')),
                DataColumn(label: Text('Length (in)')),
                DataColumn(label: Text('Weight (g)')),
                DataColumn(label: Text('Notes (if any)')),
              ],
              rows: measuredClubs.map((club) {
                return DataRow(
                  cells: [
                    DataCell(Text(club.name)),
                    DataCell(Text(_clubTypeLabel(club))),
                    DataCell(Text(_readLengthInInches(club).toStringAsFixed(2))),
                    DataCell(Text(_readWeightInGrams(club).toStringAsFixed(1))),
                    DataCell(Text(_readNotes(club).isEmpty ? '-' : _readNotes(club))),
                  ],
                );
              }).toList(growable: false),
            ),
          ),
        ],
      ),
    );
  }

  static GolfClub? _matchClubForSpot(ScatterSpot spot, List<GolfClub> candidates) {
    for (final club in candidates) {
      final x = _readLengthInInches(club);
      final y = _readWeightInGrams(club);
      if ((spot.x - x).abs() < 0.001 && (spot.y - y).abs() < 0.001) {
        return club;
      }
    }
    return null;
  }

  static double _dotRadius(GolfClub club) {
    final normalizedType = _normalizeClubType(club);
    if (normalizedType == 'driver' || normalizedType == 'putter') {
      return 8;
    }
    return 6;
  }

  static Color _clubColor(GolfClub club) {
    final normalizedType = _normalizeClubType(club);
    switch (normalizedType) {
      case 'wood':
      case 'driver':
        return const Color(0xFF0D47A1);
      case 'hybrid':
        return const Color(0xFF26C6DA);
      case 'iron':
        return const Color(0xFF2E8B57);
      case 'wedge':
        return const Color(0xFFEF6C00);
      case 'putter':
        return const Color(0xFF424242);
      default:
        return const Color(0xFF2E8B57);
    }
  }

  static String _clubTypeLabel(GolfClub club) {
    final normalizedType = _normalizeClubType(club);
    switch (normalizedType) {
      case 'wood':
      case 'driver':
        return 'Wood';
      case 'hybrid':
        return 'Hybrid';
      case 'iron':
        return 'Iron';
      case 'wedge':
        return 'Wedge';
      case 'putter':
        return 'Putter';
      default:
        return 'Iron';
    }
  }

  static String _normalizeClubType(GolfClub club) {
    final dynamic c = club;
    final explicitType = _safeString(() => c.clubType).toLowerCase().trim();
    final name = _safeString(() => c.name).toLowerCase().trim();

    if (explicitType.contains('driver') || explicitType == 'd' || name.contains('driver')) {
      return 'driver';
    }
    if (explicitType.contains('wood') || explicitType.endsWith('w')) {
      return 'wood';
    }
    if (explicitType.contains('hybrid') || explicitType.endsWith('h')) {
      return 'hybrid';
    }
    if (explicitType.contains('putter') || explicitType == 'p' || name.contains('putter')) {
      return 'putter';
    }
    if (explicitType.contains('wedge') || double.tryParse(explicitType) != null) {
      return 'wedge';
    }
    if (explicitType.contains('iron') || explicitType.endsWith('i') || explicitType == 'pw') {
      return 'iron';
    }
    return 'iron';
  }

  static double _readLengthInInches(GolfClub club) {
    final dynamic c = club;
    final lengthInInches = _safeDouble(() => c.lengthInInches);
    if (lengthInInches != null) {
      return lengthInInches;
    }
    return _safeDouble(() => c.length) ?? 0;
  }

  static double _readWeightInGrams(GolfClub club) {
    final dynamic c = club;
    final weightInGrams = _safeDouble(() => c.weightInGrams);
    if (weightInGrams != null) {
      return weightInGrams;
    }
    return _safeDouble(() => c.weight) ?? 0;
  }

  static String _readNotes(GolfClub club) {
    final dynamic c = club;
    final notes = _safeString(() => c.notes);
    return notes.trim();
  }

  static String _safeString(String Function() read) {
    try {
      return read();
    } catch (_) {
      return '';
    }
  }

  static double? _safeDouble(num Function() read) {
    try {
      return read().toDouble();
    } catch (_) {
      return null;
    }
  }
}

class _ChartFrame extends StatelessWidget {
  const _ChartFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          colors: [Color(0xFFF7FFF7), Color(0xFFEFF8EE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(
          color: const Color(0xFF66BB6A),
          width: 1.4,
        ),
        boxShadow: [
          BoxShadow(
            color: theme.colorScheme.shadow.withValues(alpha: 0.08),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: child,
    );
  }
}

class _WeightLengthLegend extends StatelessWidget {
  const _WeightLengthLegend();

  @override
  Widget build(BuildContext context) {
    final legendEntries = const <({String label, Color color})>[
      (label: 'Wood', color: Color(0xFF0D47A1)),
      (label: 'Hybrid', color: Color(0xFF26C6DA)),
      (label: 'Iron', color: Color(0xFF2E8B57)),
      (label: 'Wedge', color: Color(0xFFEF6C00)),
      (label: 'Putter', color: Color(0xFF424242)),
    ];

    return Wrap(
      spacing: 14,
      runSpacing: 10,
      children: [
        for (final entry in legendEntries)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: entry.color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Text(entry.label),
            ],
          ),
      ],
    );
  }
}
