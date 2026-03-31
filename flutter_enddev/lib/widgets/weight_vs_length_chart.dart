import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../models/golf_club.dart';

class WeightVsLengthChart extends StatelessWidget {
  const WeightVsLengthChart({super.key, required this.clubs});

  final List<GolfClub> clubs;

  static const double _normalBandTolerance = 12;
  static const double _outlierThreshold = 15;

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
      return _ChartFrame(
        child: SizedBox(
          height: 380,
          child: Center(
            child: Text(
              'クラブがまだ追加されていません',
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
        .where((club) =>
            _readLengthInInches(club) > 0 &&
            _readWeightInGrams(club) > 0 &&
            _normalizeClubType(club) != 'putter')
        .toList(growable: false);

    if (measuredClubs.isEmpty) {
      return _ChartFrame(
        child: SizedBox(
          height: 380,
          child: Center(
            child: Text(
              '計測可能なクラブデータがありません',
              style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      );
    }

    final regression = _calculateRegression(measuredClubs);
    final points = measuredClubs
        .map((club) => _ClubChartPoint.fromClub(club, regression))
        .toList(growable: false);
    final bounds = _calculateBounds(points, regression);
    final trendSpots = _buildRegressionSpots(bounds, regression, 0);
    final lowerBandSpots =
        _buildRegressionSpots(bounds, regression, -_normalBandTolerance);
    final upperBandSpots =
        _buildRegressionSpots(bounds, regression, _normalBandTolerance);

    final spotToPoint = <ScatterSpot, _ClubChartPoint>{};
    final scatterSpots = <ScatterSpot>[];

    for (final point in points) {
      final style = _pointStyle(point.club, point.deviation);
      final spot = ScatterSpot(
        point.lengthInInches,
        point.weightInGrams,
        dotPainter: FlDotCirclePainter(
          radius: style.radius,
          color: style.fillColor,
          strokeWidth: style.strokeWidth,
          strokeColor: style.strokeColor,
        ),
      );
      scatterSpots.add(spot);
      spotToPoint[spot] = point;
    }

    return _ChartFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '重量と長さ - 外れ値を強調表示',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: theme.colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '回帰トレンドとの差分で、重すぎるクラブと軽すぎるクラブをすぐに見分けられます。',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: theme.colorScheme.surface.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: theme.colorScheme.outlineVariant.withValues(alpha: 0.65),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
            child: SizedBox(
              height: 360,
              child: Stack(
                children: [
                  IgnorePointer(
                    child: LineChart(
                      LineChartData(
                        minX: bounds.minX,
                        maxX: bounds.maxX,
                        minY: bounds.minY,
                        maxY: bounds.maxY,
                        clipData: const FlClipData.all(),
                        lineTouchData: const LineTouchData(enabled: false),
                        gridData: FlGridData(
                          show: true,
                          horizontalInterval: bounds.yInterval,
                          verticalInterval: bounds.xInterval,
                          getDrawingHorizontalLine: (_) => FlLine(
                            color: theme.colorScheme.outlineVariant
                                .withValues(alpha: 0.32),
                            strokeWidth: 1,
                          ),
                          getDrawingVerticalLine: (_) => FlLine(
                            color: theme.colorScheme.outlineVariant
                                .withValues(alpha: 0.24),
                            strokeWidth: 1,
                          ),
                        ),
                        borderData: FlBorderData(
                          show: true,
                          border: Border.all(
                            color: theme.colorScheme.outlineVariant,
                          ),
                        ),
                        titlesData: _buildTitlesData(
                          theme,
                          bounds,
                          showLabels: true,
                        ),
                        betweenBarsData: [
                          BetweenBarsData(
                            fromIndex: 0,
                            toIndex: 1,
                            color: theme.colorScheme.surfaceTint
                                .withValues(alpha: 0.08),
                          ),
                        ],
                        lineBarsData: [
                          LineChartBarData(
                            spots: lowerBandSpots,
                            isCurved: false,
                            color: Colors.transparent,
                            barWidth: 0.01,
                            dotData: const FlDotData(show: false),
                            belowBarData: BarAreaData(show: false),
                          ),
                          LineChartBarData(
                            spots: upperBandSpots,
                            isCurved: false,
                            color: Colors.transparent,
                            barWidth: 0.01,
                            dotData: const FlDotData(show: false),
                            belowBarData: BarAreaData(show: false),
                          ),
                          LineChartBarData(
                            spots: trendSpots,
                            isCurved: false,
                            color: theme.colorScheme.outline,
                            barWidth: 1.4,
                            dashArray: const [6, 4],
                            dotData: const FlDotData(show: false),
                            belowBarData: BarAreaData(show: false),
                          ),
                        ],
                      ),
                    ),
                  ),
                  ScatterChart(
                    ScatterChartData(
                      minX: bounds.minX,
                      maxX: bounds.maxX,
                      minY: bounds.minY,
                      maxY: bounds.maxY,
                      clipData: const FlClipData.all(),
                      scatterSpots: scatterSpots,
                      gridData: const FlGridData(show: false),
                      borderData: FlBorderData(show: false),
                      titlesData: _buildTitlesData(
                        theme,
                        bounds,
                        showLabels: false,
                      ),
                      scatterTouchData: ScatterTouchData(
                        enabled: true,
                        touchTooltipData: ScatterTouchTooltipData(
                          getTooltipColor: (_) => const Color(0xEE1F2933),
                          tooltipPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          getTooltipItems: (spot) {
                            final point = spotToPoint[spot] ??
                                _matchPointForSpot(spot, points);
                            if (point == null) {
                              return ScatterTooltipItem(
                                '不明なクラブ',
                                textStyle: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                ),
                              );
                            }

                            final content = _buildTooltipContent(
                              point.club.name,
                              [
                                ('クラブ種別', _clubTypeCode(point.club)),
                                (
                                  '長さ',
                                  '${point.lengthInInches.toStringAsFixed(2)} in',
                                ),
                                (
                                  '重量',
                                  '${point.weightInGrams.toStringAsFixed(1)} g',
                                ),
                                (
                                  '期待値',
                                  '${point.expectedWeight.toStringAsFixed(1)} g',
                                ),
                                ('偏差', _formatDeviationLabel(point.deviation)),
                                ('示唆', _deviationMessage(point.deviation)),
                              ],
                            );

                            return ScatterTooltipItem(
                              content,
                              textStyle: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                height: 1.42,
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          const _WeightLengthLegend(),
          const SizedBox(height: 18),
          Text(
            'クラブ仕様',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: theme.colorScheme.onSurface,
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
                DataColumn(label: Text('長さ (in)')),
                DataColumn(label: Text('重量 (g)')),
                DataColumn(label: Text('期待値 (g)')),
                DataColumn(label: Text('偏差')),
                DataColumn(label: Text('メモ')),
              ],
              rows: points.map((point) {
                return DataRow(
                  cells: [
                    DataCell(Text(point.club.name)),
                    DataCell(Text(_clubTypeLabel(point.club))),
                    DataCell(Text(point.lengthInInches.toStringAsFixed(2))),
                    DataCell(Text(point.weightInGrams.toStringAsFixed(1))),
                    DataCell(Text(point.expectedWeight.toStringAsFixed(1))),
                    DataCell(
                      Text(
                        _formatDeviationShort(point.deviation),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: _pointStyle(point.club, point.deviation)
                              .fillColor,
                        ),
                      ),
                    ),
                    DataCell(Text(
                      _readNotes(point.club).isEmpty
                          ? '-'
                          : _readNotes(point.club),
                    )),
                  ],
                );
              }).toList(growable: false),
            ),
          ),
        ],
      ),
    );
  }

  static FlTitlesData _buildTitlesData(
    ThemeData theme,
    _ChartBounds bounds, {
    required bool showLabels,
  }) {
    Widget axisLabel(String text) {
      if (!showLabels) {
        return const SizedBox.shrink();
      }
      return Text(text);
    }

    Widget tickLabel(String text) {
      if (!showLabels) {
        return const SizedBox.shrink();
      }
      return Text(
        text,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      );
    }

    return FlTitlesData(
      leftTitles: AxisTitles(
        axisNameWidget: RotatedBox(
          quarterTurns: 3,
          child: axisLabel('クラブ重量（グラム）'),
        ),
        axisNameSize: 32,
        sideTitles: SideTitles(
          showTitles: true,
          interval: bounds.yInterval,
          reservedSize: 48,
          getTitlesWidget: (value, meta) => tickLabel(value.toInt().toString()),
        ),
      ),
      bottomTitles: AxisTitles(
        axisNameWidget: axisLabel('クラブ長（インチ）'),
        axisNameSize: 32,
        sideTitles: SideTitles(
          showTitles: true,
          interval: bounds.xInterval,
          reservedSize: 46,
          getTitlesWidget: (value, meta) => SideTitleWidget(
            meta: meta,
            space: 16,
            child: tickLabel(
              value % 1 == 0
                  ? value.toInt().toString()
                  : value.toStringAsFixed(1),
            ),
          ),
        ),
      ),
      topTitles: const AxisTitles(
        sideTitles: SideTitles(showTitles: false),
      ),
      rightTitles: const AxisTitles(
        sideTitles: SideTitles(showTitles: false),
      ),
    );
  }

  static _RegressionLine _calculateRegression(List<GolfClub> clubs) {
    if (clubs.isEmpty) {
      return const _RegressionLine(slope: -8, intercept: 620);
    }

    final xs = clubs.map(_readLengthInInches).toList(growable: false);
    final ys = clubs.map(_readWeightInGrams).toList(growable: false);

    final meanX = xs.reduce((a, b) => a + b) / xs.length;
    final meanY = ys.reduce((a, b) => a + b) / ys.length;

    double numerator = 0;
    double denominator = 0;

    for (var index = 0; index < xs.length; index++) {
      final dx = xs[index] - meanX;
      numerator += dx * (ys[index] - meanY);
      denominator += dx * dx;
    }

    if (denominator.abs() < 0.0001) {
      return _fallbackRegression(meanX, meanY);
    }

    final slope = numerator / denominator;
    if (slope >= -1) {
      return _fallbackRegression(meanX, meanY);
    }

    return _RegressionLine(
      slope: slope,
      intercept: meanY - (slope * meanX),
    );
  }

  static _RegressionLine _fallbackRegression(double anchorX, double anchorY) {
    const slope = -8.0;
    return _RegressionLine(
      slope: slope,
      intercept: anchorY - (slope * anchorX),
    );
  }

  static _ChartBounds _calculateBounds(
    List<_ClubChartPoint> points,
    _RegressionLine regression,
  ) {
    final minLength =
        points.map((point) => point.lengthInInches).reduce(math.min);
    final maxLength =
        points.map((point) => point.lengthInInches).reduce(math.max);
    final minWeight = points
        .map((point) => math.min(
            point.weightInGrams, point.expectedWeight - _normalBandTolerance))
        .reduce(math.min);
    final maxWeight = points
        .map((point) => math.max(
            point.weightInGrams, point.expectedWeight + _normalBandTolerance))
        .reduce(math.max);

    final minX = ((minLength - 1.0) / 1).floorToDouble().clamp(28.0, 48.0);
    final maxX = ((maxLength + 1.0) / 1).ceilToDouble().clamp(32.0, 50.0);
    final projectedMinY =
        regression.expectedWeight(maxX) - _normalBandTolerance;
    final projectedMaxY =
        regression.expectedWeight(minX) + _normalBandTolerance;
    final minY =
        ((math.min(minWeight, projectedMinY) - 15) / 10).floorToDouble() * 10;
    final maxY =
        ((math.max(maxWeight, projectedMaxY) + 15) / 10).ceilToDouble() * 10;

    return _ChartBounds(
      minX: minX,
      maxX: maxX,
      minY: minY.clamp(150.0, 500.0),
      maxY: maxY.clamp(180.0, 520.0),
      xInterval: maxX - minX <= 12 ? 1 : 2,
      yInterval: maxY - minY <= 160 ? 25 : 50,
    );
  }

  static List<FlSpot> _buildRegressionSpots(
    _ChartBounds bounds,
    _RegressionLine regression,
    double offset,
  ) {
    return [
      FlSpot(bounds.minX, regression.expectedWeight(bounds.minX) + offset),
      FlSpot(bounds.maxX, regression.expectedWeight(bounds.maxX) + offset),
    ];
  }

  static _ClubChartPoint? _matchPointForSpot(
    ScatterSpot spot,
    List<_ClubChartPoint> candidates,
  ) {
    for (final point in candidates) {
      if ((spot.x - point.lengthInInches).abs() < 0.001 &&
          (spot.y - point.weightInGrams).abs() < 0.001) {
        return point;
      }
    }
    return null;
  }

  static _PointStyle _pointStyle(GolfClub club, double deviation) {
    final baseRadius = _baseRadiusForClub(club);

    if (deviation > _outlierThreshold) {
      return const _PointStyle(
        fillColor: Color(0xFFE53935),
        strokeColor: Colors.black,
        radius: 7,
        strokeWidth: 3,
      );
    }

    if (deviation < -_outlierThreshold) {
      return const _PointStyle(
        fillColor: Color(0xFFFF9800),
        strokeColor: Color(0xFF8D4E00),
        radius: 7,
        strokeWidth: 3,
      );
    }

    return _PointStyle(
      fillColor: _clubColor(club),
      strokeColor: Colors.white,
      radius: baseRadius,
      strokeWidth: 1.4,
    );
  }

  static double _baseRadiusForClub(GolfClub club) {
    final normalizedType = _normalizeClubType(club);
    if (normalizedType == 'driver' || normalizedType == 'putter') {
      return 7;
    }
    return 5.8;
  }

  static String _formatDeviationLabel(double deviation) {
    if (deviation.abs() <= _normalBandTolerance) {
      return '${_formatSignedGrams(deviation)} / トレンド内';
    }
    final descriptor = deviation > 0 ? 'トレンドより重い' : 'トレンドより軽い';
    return '${_formatSignedGrams(deviation)} $descriptor';
  }

  static String _formatDeviationShort(double deviation) {
    return _formatSignedGrams(deviation);
  }

  static String _formatSignedGrams(double value) {
    final prefix = value > 0 ? '+' : '';
    return '$prefix${value.toStringAsFixed(1)} g';
  }

  static String _deviationMessage(double deviation) {
    if (deviation > _outlierThreshold) {
      return 'ヘッド重量や全体バランスの確認をおすすめします';
    }
    if (deviation < -_outlierThreshold) {
      return '総重量やシャフトカット量、バランスの確認をおすすめします';
    }
    if (deviation.abs() <= _normalBandTolerance) {
      return 'トレンド内のバランスです';
    }
    return 'ややトレンド外ですが、明確な外れ値ではありません';
  }

  static Color _clubColor(GolfClub club) {
    final normalizedType = _normalizeClubType(club);
    switch (normalizedType) {
      case 'wood':
      case 'driver':
        return const Color(0xFF0D47A1);
      case 'hybrid':
        return const Color(0xFF00ACC1);
      case 'iron':
        return const Color(0xFF0B8F5B);
      case 'wedge':
        return const Color(0xFF9ACD32);
      case 'putter':
        return const Color(0xFF616161);
      default:
        return const Color(0xFF0B8F5B);
    }
  }

  static String _clubTypeLabel(GolfClub club) {
    final normalizedType = _normalizeClubType(club);
    switch (normalizedType) {
      case 'wood':
      case 'driver':
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
    final dynamic c = club;
    final clubType = _safeString(() => c.clubType).trim();
    if (clubType.isNotEmpty) {
      return clubType;
    }
    return _clubTypeLabel(club);
  }

  static String _normalizeClubType(GolfClub club) {
    final dynamic c = club;
    final explicitType = _safeString(() => c.clubType).toLowerCase().trim();
    final name = _safeString(() => c.name).toLowerCase().trim();

    if (explicitType.contains('driver') ||
        explicitType == 'd' ||
        name.contains('driver')) {
      return 'driver';
    }
    if (explicitType.contains('wood') || explicitType.endsWith('w')) {
      return 'wood';
    }
    if (explicitType.contains('hybrid') || explicitType.endsWith('h')) {
      return 'hybrid';
    }
    if (explicitType.contains('putter') ||
        explicitType == 'p' ||
        name.contains('putter')) {
      return 'putter';
    }
    if (explicitType.contains('wedge') ||
        double.tryParse(explicitType) != null) {
      return 'wedge';
    }
    if (explicitType.contains('iron') ||
        explicitType.endsWith('i') ||
        explicitType == 'pw') {
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
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFFF8FCF8), Color(0xFFEFF7EF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.85),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: theme.colorScheme.shadow.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: child,
    );
  }
}

class _WeightLengthLegend extends StatelessWidget {
  const _WeightLengthLegend();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final typeEntries = const <({String label, Color color})>[
      (label: 'ウッド', color: Color(0xFF0D47A1)),
      (label: 'ハイブリッド', color: Color(0xFF00ACC1)),
      (label: 'アイアン', color: Color(0xFF0B8F5B)),
      (label: 'ウェッジ', color: Color(0xFFEF6C00)),
    ];
    final statusEntries = const <({String label, Color color, bool outlined})>[
      (label: '重い外れ値（> +15g）', color: Color(0xFFE53935), outlined: true),
      (label: '軽い外れ値（< -15g）', color: Color(0xFFFF9800), outlined: true),
      (label: '通常（±12g 以内）', color: Color(0xFF90A4AE), outlined: false),
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: 0.62),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.7),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '凡例',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 10,
            children: [
              for (final entry in typeEntries)
                _LegendDot(label: entry.label, color: entry.color),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 14,
            runSpacing: 10,
            children: [
              for (final entry in statusEntries)
                _LegendDot(
                  label: entry.label,
                  color: entry.color,
                  outlined: entry.outlined,
                ),
              const _LegendLine(
                label: 'トレンド線',
                color: Color(0xFF7A7A7A),
              ),
              _LegendBand(
                label: '期待帯（±12g）',
                color: theme.colorScheme.surfaceTint.withValues(alpha: 0.12),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({
    required this.label,
    required this.color,
    this.outlined = false,
  });

  final String label;
  final Color color;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: outlined
                ? Border.all(color: Colors.black87, width: 1.6)
                : Border.all(color: Colors.white, width: 1.2),
          ),
        ),
        const SizedBox(width: 6),
        Text(label),
      ],
    );
  }
}

class _LegendLine extends StatelessWidget {
  const _LegendLine({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: 0,
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: color, width: 2),
            ),
          ),
        ),
        const SizedBox(width: 6),
        Text(label),
      ],
    );
  }
}

class _LegendBand extends StatelessWidget {
  const _LegendBand({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: color.withValues(alpha: 0.75)),
          ),
        ),
        const SizedBox(width: 6),
        Text(label),
      ],
    );
  }
}

class _RegressionLine {
  const _RegressionLine({required this.slope, required this.intercept});

  final double slope;
  final double intercept;

  double expectedWeight(double lengthInInches) {
    return (slope * lengthInInches) + intercept;
  }
}

class _ChartBounds {
  const _ChartBounds({
    required this.minX,
    required this.maxX,
    required this.minY,
    required this.maxY,
    required this.xInterval,
    required this.yInterval,
  });

  final double minX;
  final double maxX;
  final double minY;
  final double maxY;
  final double xInterval;
  final double yInterval;
}

class _ClubChartPoint {
  const _ClubChartPoint({
    required this.club,
    required this.lengthInInches,
    required this.weightInGrams,
    required this.expectedWeight,
    required this.deviation,
  });

  final GolfClub club;
  final double lengthInInches;
  final double weightInGrams;
  final double expectedWeight;
  final double deviation;

  factory _ClubChartPoint.fromClub(GolfClub club, _RegressionLine regression) {
    final length = WeightVsLengthChart._readLengthInInches(club);
    final weight = WeightVsLengthChart._readWeightInGrams(club);
    final expectedWeight = regression.expectedWeight(length);
    return _ClubChartPoint(
      club: club,
      lengthInInches: length,
      weightInGrams: weight,
      expectedWeight: expectedWeight,
      deviation: weight - expectedWeight,
    );
  }
}

class _PointStyle {
  const _PointStyle({
    required this.fillColor,
    required this.strokeColor,
    required this.radius,
    required this.strokeWidth,
  });

  final Color fillColor;
  final Color strokeColor;
  final double radius;
  final double strokeWidth;
}
