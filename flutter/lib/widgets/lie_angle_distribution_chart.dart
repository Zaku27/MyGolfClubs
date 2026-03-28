import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/golf_club.dart';
import '../providers/club_providers.dart';

class LieAngleDistributionChart extends ConsumerWidget {
  const LieAngleDistributionChart({super.key, required this.clubs});

  final List<GolfClub> clubs;

  static const double _minLieAngle = 50;
  static const double _maxLieAngle = 70;
  static const double _goodTolerance = 1.5;
  static const Color _standardLineColor = Color(0xFF00897B);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final userStandards = ref.watch(userLieAngleStandardsProvider);
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

    final clubEntries = sortedClubs
        .map((club) => _LieAngleEntry(
              club: club,
              standardLieAngle: userStandards.standardFor(club),
            ))
        .toList(growable: false);

    final chartGroups = List<BarChartGroupData>.generate(
      clubEntries.length,
      (index) {
        final entry = clubEntries[index];
        final rodStyle = _rodStyleFor(entry);
        return BarChartGroupData(
          x: index,
          barRods: [
            BarChartRodData(
              toY: entry.club.lieAngle.clamp(_minLieAngle, _maxLieAngle),
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

    final standardSpots = List<FlSpot>.generate(
      clubEntries.length,
      (index) => FlSpot(index.toDouble(), clubEntries[index].standardLieAngle),
      growable: false,
    );
    final upperGoodRangeSpots = List<FlSpot>.generate(
      clubEntries.length,
      (index) => FlSpot(
        index.toDouble(),
        (clubEntries[index].standardLieAngle + _goodTolerance)
            .clamp(_minLieAngle, _maxLieAngle),
      ),
      growable: false,
    );
    final lowerGoodRangeSpots = List<FlSpot>.generate(
      clubEntries.length,
      (index) => FlSpot(
        index.toDouble(),
        (clubEntries[index].standardLieAngle - _goodTolerance)
            .clamp(_minLieAngle, _maxLieAngle),
      ),
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
            'User standards are applied first, then app defaults by club type.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'The shaded band shows the good range of +/-1.5° around each club standard.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 360,
            child: Stack(
              children: [
                BarChart(
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
                            if (index < 0 || index >= clubEntries.length) {
                              return const SizedBox.shrink();
                            }

                            final club = clubEntries[index].club;
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
                          final entry = clubEntries[group.x];
                          return BarTooltipItem(
                            '${entry.club.name}\n'
                            'Measured: ${entry.club.lieAngle.toStringAsFixed(1)}°\n'
                            'Standard: ${entry.standardLieAngle.toStringAsFixed(1)}°\n'
                            'Deviation: ${_formatDeviation(entry.deviation)}\n'
                            'Status: ${entry.status.label}',
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
                IgnorePointer(
                  child: LineChart(
                    LineChartData(
                      minX: -0.5,
                      maxX: sortedClubs.length - 0.5,
                      betweenBarsData: [
                        BetweenBarsData(
                          fromIndex: 0,
                          toIndex: 1,
                          color: const Color(0x332E7D32),
                        ),
                      ],
                      minY: _minLieAngle,
                      maxY: _maxLieAngle,
                      lineBarsData: [
                        LineChartBarData(
                          spots: upperGoodRangeSpots,
                          isCurved: false,
                          color: Colors.transparent,
                          barWidth: 0,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(show: false),
                        ),
                        LineChartBarData(
                          spots: lowerGoodRangeSpots,
                          isCurved: false,
                          color: Colors.transparent,
                          barWidth: 0,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(show: false),
                        ),
                        LineChartBarData(
                          spots: standardSpots,
                          isCurved: false,
                          color: _standardLineColor,
                          barWidth: 3,
                          dashArray: const [7, 4],
                          dotData: FlDotData(
                            show: true,
                            getDotPainter: (spot, percent, bar, index) =>
                                FlDotCirclePainter(
                              radius: 4,
                              color: _standardLineColor,
                              strokeColor: Colors.white,
                              strokeWidth: 1.5,
                            ),
                          ),
                          belowBarData: BarAreaData(show: false),
                        ),
                      ],
                      // Keep the same reserved axis spaces as the BarChart,
                      // so the overlay line uses the exact same plot area.
                      titlesData: FlTitlesData(
                        topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        leftTitles: AxisTitles(
                          axisNameSize: 36,
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 46,
                            getTitlesWidget: (_, __) => const SizedBox.shrink(),
                          ),
                        ),
                        bottomTitles: AxisTitles(
                          axisNameSize: 34,
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 56,
                            getTitlesWidget: (_, __) => const SizedBox.shrink(),
                          ),
                        ),
                      ),
                      gridData: const FlGridData(show: false),
                      borderData: FlBorderData(show: false),
                      lineTouchData: const LineTouchData(enabled: false),
                    ),
                  ),
                ),
              ],
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
                DataColumn(label: Text('Measured')),
                DataColumn(label: Text('Standard')),
                DataColumn(label: Text('Deviation')),
                DataColumn(label: Text('Status')),
              ],
              rows: clubEntries.map((entry) {
                return DataRow(
                  cells: [
                    DataCell(Text(entry.club.name)),
                    DataCell(Text(_clubTypeLabel(entry.club))),
                    DataCell(Text(entry.club.lieAngle.toStringAsFixed(1))),
                    DataCell(Text(entry.standardLieAngle.toStringAsFixed(1))),
                    DataCell(Text(_formatDeviation(entry.deviation))),
                    DataCell(
                      Text(
                        entry.status.label,
                        style: TextStyle(
                          color: entry.status.color,
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

  static _RodStyle _rodStyleFor(_LieAngleEntry entry) {
    if (entry.status == _LieAngleStatus.adjustRecommended) {
      return const _RodStyle(
        fillColor: Color(0xFFC62828),
        borderSide: BorderSide(color: Color(0xFF8E0000), width: 2),
      );
    }

    if (entry.status == _LieAngleStatus.slightlyOff) {
      return _RodStyle(
        fillColor: _baseColorFor(entry.club),
        borderSide: const BorderSide(color: Color(0xFFEF6C00), width: 2),
      );
    }

    return _RodStyle(
      fillColor: _baseColorFor(entry.club),
      borderSide: BorderSide.none,
    );
  }

  static Color _baseColorFor(GolfClub club) {
    switch (club.category) {
      case ClubCategory.wood:
        return const Color(0xFF1976D2);
      case ClubCategory.hybrid:
        return const Color(0xFF26C6DA);
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
        _LegendChip(label: 'Wood', color: Color(0xFF1976D2)),
        _LegendChip(label: 'Hybrid', color: Color(0xFF26C6DA)),
        _LegendChip(label: 'Wedge', color: Color(0xFFEF6C00)),
        _LegendChip(label: 'Putter', color: Color(0xFF424242)),
        _LegendChip(label: 'Standard Line', color: Color(0xFF00897B)),
        _LegendChip(label: 'Good Range ±1.5°', color: Color(0x662E7D32)),
        _LegendChip(label: 'Adjust Recommended', color: Color(0xFFC62828)),
      ],
    );
  }
}

class _LieAngleEntry {
  const _LieAngleEntry({
    required this.club,
    required this.standardLieAngle,
  });

  final GolfClub club;
  final double standardLieAngle;

  double get deviation => club.lieAngle - standardLieAngle;

  _LieAngleStatus get status {
    final absDeviation = deviation.abs();
    if (absDeviation <= 1.5) {
      return _LieAngleStatus.good;
    }
    if (absDeviation <= 3.0) {
      return _LieAngleStatus.slightlyOff;
    }
    return _LieAngleStatus.adjustRecommended;
  }
}

enum _LieAngleStatus {
  good('良好', Color(0xFF2E7D32)),
  slightlyOff('ややズレ', Color(0xFFEF6C00)),
  adjustRecommended('調整推奨', Color(0xFFC62828));

  const _LieAngleStatus(this.label, this.color);

  final String label;
  final Color color;
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
