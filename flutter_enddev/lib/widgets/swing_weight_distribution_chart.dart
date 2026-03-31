import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../models/golf_club.dart';

class SwingWeightDistributionChart extends StatelessWidget {
  const SwingWeightDistributionChart({
    super.key,
    required this.clubs,
    required this.targetValue,
  });

  final List<GolfClub> clubs;
  final double targetValue;

  static const double _goodTolerance = 1.5;
  static const double _adjustRecommended = 2.0;

  static String _buildTooltipContent(
    String title,
    List<(String, String)> rows,
  ) {
    final maxLabelLength = rows.fold<int>(0, (max, row) {
      return row.$1.length > max ? row.$1.length : max;
    });

    final buffer = StringBuffer(title);
    for (final row in rows) {
      buffer
        ..write('\n')
        ..write(row.$1.padRight(maxLabelLength))
        ..write(' : ')
        ..write(row.$2);
    }
    return buffer.toString();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (clubs.isEmpty) {
      return _SwingWeightChartFrame(
        child: SizedBox(
          height: 420,
          child: Center(
            child: Text(
              'クラブがまだ追加されていません',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      );
    }

    final sortedClubs = _sortClubs(clubs);
    final entries = sortedClubs
        .map((club) => _SwingWeightEntry.fromClub(club, targetValue))
        .toList(growable: false);
    final targetLabel = numericToSwingWeightLabel(targetValue);

    final minY = _resolveMinY(entries, targetValue);
    final maxY = _resolveMaxY(entries, targetValue);

    final barGroups = List<BarChartGroupData>.generate(
      entries.length,
      (index) {
        final entry = entries[index];
        final style = _barStyleFor(entry);

        return BarChartGroupData(
          x: index,
          barRods: [
            BarChartRodData(
              toY: entry.numericValue,
              width: 18,
              color: style.fillColor,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(8),
                topRight: Radius.circular(8),
              ),
              borderSide: style.borderSide,
            ),
          ],
        );
      },
      growable: false,
    );

    return _SwingWeightChartFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'スイングウェイト分布',
            style: theme.textTheme.titleLarge?.copyWith(
              color: const Color(0xFF1B5E20),
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '理想的なセットは、各クラブ間の差が1〜2ポイント以内に収まる傾向があります。',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFEAF4EA),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0xFF66BB6A)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 18,
                  height: 0,
                  margin: const EdgeInsets.only(right: 8),
                  decoration: const BoxDecoration(
                    border: Border(
                      top: BorderSide(
                        color: Color(0xFF2E7D32),
                        width: 2,
                        style: BorderStyle.solid,
                      ),
                    ),
                  ),
                ),
                Text(
                  '目安ターゲット: $targetLabel',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: const Color(0xFF1B5E20),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 360,
            child: BarChart(
              BarChartData(
                minY: minY,
                maxY: maxY,
                alignment: BarChartAlignment.spaceAround,
                barGroups: barGroups,
                extraLinesData: ExtraLinesData(
                  horizontalLines: [
                    HorizontalLine(
                      y: targetValue,
                      color: const Color(0xFF2E7D32),
                      strokeWidth: 2,
                      dashArray: const [8, 4],
                    ),
                  ],
                ),
                gridData: FlGridData(
                  show: true,
                  horizontalInterval: 2,
                  verticalInterval: 1,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: theme.colorScheme.outlineVariant
                        .withValues(alpha: 0.35),
                    strokeWidth: 1,
                  ),
                  getDrawingVerticalLine: (_) => FlLine(
                    color:
                        theme.colorScheme.outlineVariant.withValues(alpha: 0.2),
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(
                  show: true,
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                ),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    axisNameWidget: Text(
                      'クラブ',
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: const Color(0xFF1B5E20),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    axisNameSize: 34,
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 60,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= entries.length) {
                          return const SizedBox.shrink();
                        }

                        return SideTitleWidget(
                          meta: meta,
                          space: 20,
                          child: Transform.rotate(
                            angle: -0.45,
                            child: Text(
                              entries[index].club.name,
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
                      'スイングウェイト数値',
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: const Color(0xFF1B5E20),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    axisNameSize: 40,
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 44,
                      interval: 2,
                      getTitlesWidget: (value, meta) => Text(
                        value.toStringAsFixed(0),
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
                    fitInsideHorizontally: true,
                    fitInsideVertically: true,
                    tooltipPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    tooltipMargin: 10,
                    getTooltipColor: (_) => const Color(0xEE1B4332),
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      final entry = entries[group.x];
                      final deviation = entry.deviationFromD2;
                      final content = _buildTooltipContent(entry.club.name, [
                        ('クラブ種別', _clubTypeCode(entry.club)),
                        ('SW', entry.swingWeightLabel),
                        ('偏差', _formatSigned(deviation)),
                        ('状態', _statusForDeviation(deviation).label),
                      ]);

                      return BarTooltipItem(
                        content,
                        const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          height: 1.4,
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const _StatusLegend(),
          const SizedBox(height: 18),
          Text(
            'スイングウェイト詳細',
            style: theme.textTheme.titleMedium?.copyWith(
              color: const Color(0xFF1B5E20),
              fontWeight: FontWeight.w700,
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
                DataColumn(label: Text('クラブ名')),
                DataColumn(label: Text('種類')),
                DataColumn(label: Text('スイングウェイト')),
                DataColumn(label: Text('目安偏差')),
                DataColumn(label: Text('ステータス')),
              ],
              rows: entries.map((entry) {
                final status = _statusForDeviation(entry.deviationFromD2);
                return DataRow(
                  cells: [
                    DataCell(Text(entry.club.name)),
                    DataCell(Text(_clubTypeLabel(entry.club))),
                    DataCell(Text(entry.swingWeightLabel)),
                    DataCell(Text(_formatSigned(entry.deviationFromD2))),
                    DataCell(
                      Text(
                        status.label,
                        style: TextStyle(
                          color: status.color,
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

  static double _resolveMinY(List<_SwingWeightEntry> entries, double target) {
    final minValue =
        entries.map((e) => e.numericValue).reduce((a, b) => a < b ? a : b);
    return (minValue < target ? minValue - 2 : target - 2).floorToDouble();
  }

  static double _resolveMaxY(List<_SwingWeightEntry> entries, double target) {
    final maxValue =
        entries.map((e) => e.numericValue).reduce((a, b) => a > b ? a : b);
    return (maxValue > target ? maxValue + 2 : target + 2).ceilToDouble();
  }

  static _BarStyle _barStyleFor(_SwingWeightEntry entry) {
    final deviation = entry.deviationFromD2.abs();
    final baseColor = _clubTypeColor(entry.club);

    if (deviation > _adjustRecommended) {
      return const _BarStyle(
        fillColor: Color(0xFFE53935),
        borderSide: BorderSide(color: Color(0xFFB71C1C), width: 2),
      );
    }

    if (deviation > _goodTolerance) {
      return const _BarStyle(
        fillColor: Color(0xFFFB8C00),
        borderSide: BorderSide(color: Color(0xFFE65100), width: 1.6),
      );
    }

    return _BarStyle(fillColor: baseColor, borderSide: BorderSide.none);
  }

  static List<GolfClub> _sortClubs(List<GolfClub> clubs) {
    final sorted = List<GolfClub>.from(clubs);
    sorted.sort((a, b) {
      final aKey = _clubOrderKey(a);
      final bKey = _clubOrderKey(b);
      if (aKey != bKey) {
        return aKey.compareTo(bKey);
      }

      final aRank = _clubRankWithinType(a);
      final bRank = _clubRankWithinType(b);
      if (aRank != bRank) {
        return aRank.compareTo(bRank);
      }

      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });
    return sorted;
  }

  static int _clubOrderKey(GolfClub club) {
    final normalizedType = _normalizeClubType(club);
    final normalizedName = club.name.toLowerCase();

    if (normalizedName.contains('driver')) return 0;
    if (normalizedType == 'wood') return 1;
    if (normalizedType == 'hybrid') return 2;

    final ironNumber = _extractClubNumber(club);
    if (normalizedType == 'iron' && ironNumber != null && ironNumber <= 4)
      return 3;
    if (normalizedType == 'iron' && ironNumber != null && ironNumber <= 7)
      return 4;
    if (normalizedType == 'iron') return 5;

    if (normalizedType == 'wedge') return 6;
    if (normalizedType == 'putter') return 7;

    return 8;
  }

  static int _clubRankWithinType(GolfClub club) {
    final normalizedType = _normalizeClubType(club);
    final number = _extractClubNumber(club);

    if (normalizedType == 'wood' || normalizedType == 'hybrid') {
      return number ?? 99;
    }
    if (normalizedType == 'iron') {
      return number ?? 99;
    }
    if (normalizedType == 'wedge') {
      final name = club.name.toLowerCase();
      if (name.contains('pw') || name.contains('pitch')) return 0;
      if (name.contains('aw') || name.contains('approach')) return 1;
      if (name.contains('gw') || name.contains('gap')) return 2;
      if (name.contains('sw') || name.contains('sand')) return 3;
      if (name.contains('lw') || name.contains('lob')) return 4;
      return number ?? 99;
    }

    return 99;
  }

  static int? _extractClubNumber(GolfClub club) {
    final inputs = [club.name.toLowerCase(), club.clubType.toLowerCase()];
    for (final text in inputs) {
      final match = RegExp(r'(\d{1,2})').firstMatch(text);
      if (match != null) {
        return int.tryParse(match.group(1)!);
      }
    }
    return null;
  }

  static String _normalizeClubType(GolfClub club) {
    final type = club.clubType.toLowerCase().trim();
    final name = club.name.toLowerCase().trim();

    if (name.contains('driver')) return 'wood';
    if (type.contains('wood') || name.contains('wood') || name.endsWith('w'))
      return 'wood';
    if (type.contains('hybrid') ||
        name.contains('hybrid') ||
        name.endsWith('h')) return 'hybrid';
    if (type.contains('putter') || name.contains('putter')) return 'putter';

    if (type.contains('wedge') ||
        name.contains('wedge') ||
        name.contains('pw') ||
        name.contains('aw') ||
        name.contains('gw') ||
        name.contains('sw') ||
        name.contains('lw')) {
      return 'wedge';
    }

    if (type.contains('iron') || name.contains('iron') || name.endsWith('i'))
      return 'iron';
    return 'iron';
  }

  static Color _clubTypeColor(GolfClub club) {
    switch (_normalizeClubType(club)) {
      case 'wood':
        return const Color(0xFF1565C0);
      case 'hybrid':
        return const Color(0xFF26C6DA);
      case 'iron':
        return const Color(0xFF2E8B57);
      case 'wedge':
        return const Color(0xFF9ACD32);
      case 'putter':
        return const Color(0xFF757575);
      default:
        return const Color(0xFF2E8B57);
    }
  }

  static String _clubTypeLabel(GolfClub club) {
    switch (_normalizeClubType(club)) {
      case 'wood':
        return 'ウッド';
      case 'hybrid':
        return 'ハイブリッド';
      case 'iron':
        return 'アイアン';
      case 'wedge':
        return 'ウェッジ';
      case 'putter':
        return 'パター';
      default:
        return 'アイアン';
    }
  }

  static String _clubTypeCode(GolfClub club) {
    final clubType = club.clubType.trim();
    if (clubType.isNotEmpty) {
      return clubType;
    }
    return _clubTypeLabel(club);
  }

  static _DeviationStatus _statusForDeviation(double deviation) {
    final absolute = deviation.abs();
    if (absolute <= _goodTolerance) {
      return const _DeviationStatus('良好', Color(0xFF2E7D32));
    }
    if (absolute > _adjustRecommended) {
      return const _DeviationStatus('調整推奨', Color(0xFFC62828));
    }
    if (deviation > 0) {
      return const _DeviationStatus('やや重い', Color(0xFFEF6C00));
    }
    return const _DeviationStatus('やや軽い', Color(0xFFEF6C00));
  }

  static String _formatSigned(double value) {
    final sign = value >= 0 ? '+' : '';
    return '$sign${value.toStringAsFixed(1)}';
  }
}

class _SwingWeightEntry {
  const _SwingWeightEntry({
    required this.club,
    required this.swingWeightLabel,
    required this.numericValue,
    required this.targetValue,
  });

  factory _SwingWeightEntry.fromClub(GolfClub club, double targetValue) {
    final raw = club.swingWeight.trim();
    return _SwingWeightEntry(
      club: club,
      swingWeightLabel: raw.isEmpty ? '-' : raw.toUpperCase(),
      numericValue: swingWeightToNumeric(raw),
      targetValue: targetValue,
    );
  }

  final GolfClub club;
  final String swingWeightLabel;
  final double numericValue;
  final double targetValue;

  double get deviationFromD2 => numericValue - targetValue;
}

class _BarStyle {
  const _BarStyle({required this.fillColor, required this.borderSide});

  final Color fillColor;
  final BorderSide borderSide;
}

class _DeviationStatus {
  const _DeviationStatus(this.label, this.color);

  final String label;
  final Color color;
}

class _SwingWeightChartFrame extends StatelessWidget {
  const _SwingWeightChartFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          colors: [Color(0xFFF6FFF6), Color(0xFFEDF7ED)],
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

class _StatusLegend extends StatelessWidget {
  const _StatusLegend();

  @override
  Widget build(BuildContext context) {
    final entries = const <({String label, Color color})>[
      (label: '良好（|偏差| <= 1.5）', color: Color(0xFF2E7D32)),
      (label: 'やや重い（+偏差）', color: Color(0xFFEF6C00)),
      (label: 'やや軽い（-偏差）', color: Color(0xFFEF6C00)),
      (label: '調整推奨（> 2.0）', color: Color(0xFFC62828)),
    ];

    return Wrap(
      spacing: 14,
      runSpacing: 10,
      children: [
        for (final entry in entries)
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

double swingWeightToNumeric(String swingWeight) {
  final normalized = swingWeight.trim().toUpperCase();
  final match = RegExp(r'^([A-F])\s*([0-9](?:\.[05])?)$').firstMatch(
    normalized,
  );
  if (match == null) {
    return 0.0;
  }

  // D0 is the baseline (0), so C9 becomes -1 and E1 becomes +11.
  final letterIndex = match.group(1)!.codeUnitAt(0) - 'D'.codeUnitAt(0);
  final point = double.parse(match.group(2)!);
  if (point < 0 || point > 9.5) {
    return 0.0;
  }

  return letterIndex * 10 + point;
}

String numericToSwingWeightLabel(double value) {
  final rounded = (value * 2).roundToDouble() / 2;
  final letterIndex = (rounded / 10).floor();
  final point = rounded - letterIndex * 10;
  final letterCode = 'D'.codeUnitAt(0) + letterIndex;

  if (letterCode < 'A'.codeUnitAt(0) || letterCode > 'Z'.codeUnitAt(0)) {
    return rounded.toStringAsFixed(1);
  }

  final pointLabel = point == point.roundToDouble()
      ? point.toStringAsFixed(0)
      : point.toStringAsFixed(1);
  return '${String.fromCharCode(letterCode)}$pointLabel';
}
