import 'dart:convert';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/golf_club.dart';

class LieAngleDistributionChart extends StatelessWidget {
  const LieAngleDistributionChart({super.key, required this.clubs});

  final List<GolfClub> clubs;

  static Future<Map<String, double>>? _standardsFuture;

  static const double _minLieAngle = 50;
  static const double _maxLieAngle = 70;

  @override
  Widget build(BuildContext context) {
    final standardsFuture = _standardsFuture ??= _loadStandardLieAngles();

    return FutureBuilder<Map<String, double>>(
      future: standardsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return _LieAngleChartFrame(
            child: SizedBox(
              height: 420,
              child: Center(
                child: CircularProgressIndicator(
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
          );
        }

        if (snapshot.hasError || !snapshot.hasData) {
          return _LieAngleChartFrame(
            child: SizedBox(
              height: 420,
              child: Center(
                child: Text(
                  'Failed to load lie-angle standards',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
          );
        }

        final standards = snapshot.data!;
        return _buildChart(context, standards);
      },
    );
  }

  Widget _buildChart(BuildContext context, Map<String, double> standards) {
    final theme = Theme.of(context);
    final sortedClubs = _sortClubs(clubs);

    if (sortedClubs.isEmpty) {
      return _LieAngleChartFrame(
        child: SizedBox(
          height: 420,
          child: Center(
            child: Text(
              'No clubs added yet',
              style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      );
    }

    final chartGroups = List<BarChartGroupData>.generate(
      sortedClubs.length,
      (index) {
        final club = sortedClubs[index];
        final rodStyle = _rodStyleFor(club, standards);
        return BarChartGroupData(
          x: index,
          barRods: [
            BarChartRodData(
              toY: club.lieAngle.clamp(_minLieAngle, _maxLieAngle),
              width: 20,
              color: rodStyle.fillColor,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(8),
                topRight: Radius.circular(8),
              ),
              borderSide: rodStyle.borderSide,
              backDrawRodData: BackgroundBarChartRodData(
                show: true,
                toY: _maxLieAngle,
                color: const Color(0xFFE6EFE8),
              ),
            ),
          ],
        );
      },
      growable: false,
    );

    return _LieAngleChartFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Lie Angle Distribution',
            style: theme.textTheme.titleLarge?.copyWith(
              color: const Color(0xFF1B5E20),
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Check lie-angle consistency across the bag and quickly flag clubs that may need fitting.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Deviation and status are calculated against club-specific standard lie values.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 360,
            child: BarChart(
              BarChartData(
                minY: _minLieAngle,
                maxY: _maxLieAngle,
                alignment: BarChartAlignment.spaceAround,
                barGroups: chartGroups,
                gridData: FlGridData(
                  show: true,
                  horizontalInterval: 2,
                  verticalInterval: 1,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: theme.colorScheme.outlineVariant
                        .withValues(alpha: 0.32),
                    strokeWidth: 1,
                  ),
                  getDrawingVerticalLine: (_) => FlLine(
                    color: theme.colorScheme.outlineVariant
                        .withValues(alpha: 0.18),
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(
                  show: true,
                  border: Border.all(
                    color: theme.colorScheme.outlineVariant,
                  ),
                ),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    axisNameWidget: Text(
                      'Clubs',
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: const Color(0xFF1B5E20),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    axisNameSize: 34,
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 56,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= sortedClubs.length) {
                          return const SizedBox.shrink();
                        }

                        final club = sortedClubs[index];
                        return SideTitleWidget(
                          meta: meta,
                          space: 12,
                          child: Transform.rotate(
                            angle: -0.45,
                            child: Text(
                              club.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    axisNameWidget: Text(
                      'Lie Angle (°)',
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: const Color(0xFF1B5E20),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    axisNameSize: 36,
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 46,
                      interval: 2,
                      getTitlesWidget: (value, meta) => Text(
                        value.toInt().toString(),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                ),
                barTouchData: BarTouchData(
                  enabled: true,
                  handleBuiltInTouches: true,
                  touchTooltipData: BarTouchTooltipData(
                    tooltipPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    tooltipMargin: 10,
                    fitInsideHorizontally: true,
                    fitInsideVertically: true,
                    getTooltipColor: (_) => const Color(0xEE1B4332),
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      final club = sortedClubs[group.x];
                      final standardLie = _standardLieAngleFor(club, standards);
                      final deviation = club.lieAngle - standardLie;
                      return BarTooltipItem(
                        '${club.name}\n'
                        'Standard: ${standardLie.toStringAsFixed(1)}°\n'
                        'Lie: ${club.lieAngle.toStringAsFixed(1)}°\n'
                        'Deviation: ${_formatDeviation(deviation)}\n'
                        'Type: ${_clubTypeLabel(club)}',
                        const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          height: 1.45,
                          fontWeight: FontWeight.w600,
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const _LieAngleLegend(),
          const SizedBox(height: 20),
          Text(
            'Lie Angle Summary',
            style: theme.textTheme.titleMedium?.copyWith(
              color: const Color(0xFF1B5E20),
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStatePropertyAll(
                const Color(0xFFDDEBDD),
              ),
              dataRowMinHeight: 48,
              dataRowMaxHeight: 60,
              columns: const [
                DataColumn(label: Text('Club Name')),
                DataColumn(label: Text('Type')),
                DataColumn(label: Text('Lie Angle (°)')),
                DataColumn(label: Text('Deviation from Standard')),
                DataColumn(label: Text('Status')),
              ],
              rows: sortedClubs.map((club) {
                final deviation =
                    club.lieAngle - _standardLieAngleFor(club, standards);
                final isGood = deviation.abs() <= 2;
                final statusColor =
                    isGood ? const Color(0xFF2E7D32) : const Color(0xFFD84315);

                return DataRow(
                  cells: [
                    DataCell(Text(club.name)),
                    DataCell(Text(_clubTypeLabel(club))),
                    DataCell(Text(club.lieAngle.toStringAsFixed(1))),
                    DataCell(Text(_formatDeviation(deviation))),
                    DataCell(
                      Text(
                        isGood ? 'Good' : 'Adjust Recommended',
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                );
              }).toList(growable: false),
            ),
          ),
        ],
      ),
    );
  }

  static Future<Map<String, double>> _loadStandardLieAngles() async {
    final jsonString =
        await rootBundle.loadString('assets/lie_angle_standards.json');
    final decoded = jsonDecode(jsonString);

    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Invalid lie angle standards JSON format.');
    }

    return decoded.map((key, value) => MapEntry(key.toUpperCase(),
        value is num ? value.toDouble() : double.parse(value.toString())));
  }

  static List<GolfClub> _sortClubs(List<GolfClub> clubs) {
    final sorted = [...clubs];
    sorted.sort((a, b) {
      final categoryCompare = _categoryRank(a).compareTo(_categoryRank(b));
      if (categoryCompare != 0) {
        return categoryCompare;
      }

      final loftCompare = a.loftAngle.compareTo(b.loftAngle);
      if (loftCompare != 0) {
        return loftCompare;
      }

      return a.name.compareTo(b.name);
    });
    return sorted;
  }

  static int _categoryRank(GolfClub club) {
    switch (club.category) {
      case ClubCategory.wood:
        return 0;
      case ClubCategory.hybrid:
        return 1;
      case ClubCategory.iron:
        return 2;
      case ClubCategory.wedge:
        return 3;
      case ClubCategory.putter:
        return 4;
    }
  }

  static _RodStyle _rodStyleFor(GolfClub club, Map<String, double> standards) {
    final deviation = club.lieAngle - _standardLieAngleFor(club, standards);
    if (deviation.abs() > 2) {
      return const _RodStyle(
        fillColor: Color(0xFFC62828),
        borderSide: BorderSide(color: Color(0xFF8E0000), width: 2),
      );
    }

    return _RodStyle(
      fillColor: _baseColorFor(club),
      borderSide: BorderSide.none,
    );
  }

  static double _standardLieAngleFor(
      GolfClub club, Map<String, double> standardByType) {
    final clubType = club.clubType.trim().toUpperCase();
    final direct = standardByType[clubType];
    if (direct != null) {
      return direct;
    }

    if (double.tryParse(clubType) != null) {
      return 64.0;
    }

    switch (club.category) {
      case ClubCategory.wood:
        return 57.0;
      case ClubCategory.hybrid:
        return 59.5;
      case ClubCategory.iron:
        return 63.0;
      case ClubCategory.wedge:
        return 64.0;
      case ClubCategory.putter:
        return 70.0;
    }
  }

  static Color _baseColorFor(GolfClub club) {
    switch (club.category) {
      case ClubCategory.wood:
        return const Color(0xFF1976D2);
      case ClubCategory.hybrid:
        return const Color(0xFF1976D2);
      case ClubCategory.iron:
        return const Color(0xFF2E7D32);
      case ClubCategory.wedge:
        return const Color(0xFFEF6C00);
      case ClubCategory.putter:
        return const Color(0xFF424242);
    }
  }

  static String _clubTypeLabel(GolfClub club) {
    switch (club.category) {
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

  static String _formatDeviation(double deviation) {
    final sign = deviation > 0 ? '+' : '';
    return '$sign${deviation.toStringAsFixed(1)}°';
  }
}

class _LieAngleChartFrame extends StatelessWidget {
  const _LieAngleChartFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFF7FBF7), Color(0xFFEEF7EE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFD7E7D5)),
        boxShadow: [
          BoxShadow(
            color: theme.colorScheme.shadow.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
        child: child,
      ),
    );
  }
}

class _LieAngleLegend extends StatelessWidget {
  const _LieAngleLegend();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 10,
      children: const [
        _LegendChip(label: 'Iron', color: Color(0xFF2E7D32)),
        _LegendChip(label: 'Wood / Hybrid', color: Color(0xFF1976D2)),
        _LegendChip(label: 'Wedge', color: Color(0xFFEF6C00)),
        _LegendChip(label: 'Putter', color: Color(0xFF424242)),
        _LegendChip(label: 'Outside Standard ±2°', color: Color(0xFFC62828)),
      ],
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: const Color(0xFF16331A),
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _RodStyle {
  const _RodStyle({required this.fillColor, required this.borderSide});

  final Color fillColor;
  final BorderSide borderSide;
}
