// pubspec.yaml deps required:
//   flutter_riverpod: ^3.3.1
//   fl_chart: ^1.2.0
//
// Usage — wrap your app with ProviderScope and navigate here:
//   runApp(ProviderScope(child: MyApp()));
//   Navigator.push(context, MaterialPageRoute(builder: (_) => const AnalysisScreen()));

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';

import '../models/golf_club.dart';
import '../providers/club_providers.dart';
import '../widgets/lie_angle_distribution_chart.dart';
import '../widgets/weight_vs_length_chart.dart';

// ============================================================================
// AnalysisScreen — top-level screen with a TabBar
// ============================================================================
class AnalysisScreen extends ConsumerWidget {
  const AnalysisScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 3,
      initialIndex: 1,
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F7FA),
        appBar: AppBar(
          title: const Text('クラブ分析'),
          centerTitle: false,
          bottom: const TabBar(
            tabs: [
              Tab(
                  icon: Icon(Icons.scatter_plot_outlined),
                  text: 'Loft vs Distance'),
              Tab(icon: Icon(Icons.straighten), text: 'Weight vs Length'),
              Tab(icon: Icon(Icons.bar_chart_rounded), text: 'Lie Angle'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            LoftDistanceTab(),
            WeightLengthTab(),
            LieAngleTab(),
          ],
        ),
      ),
    );
  }
}

class WeightLengthTab extends ConsumerWidget {
  const WeightLengthTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clubs = ref.watch(clubsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: WeightVsLengthChart(clubs: clubs),
    );
  }
}

class LieAngleTab extends ConsumerWidget {
  const LieAngleTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clubs = ref.watch(clubsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: LieAngleDistributionChart(clubs: clubs),
    );
  }
}

// ============================================================================
// LoftDistanceTab — hosts chart + legend + data table
// ============================================================================
class LoftDistanceTab extends ConsumerWidget {
  const LoftDistanceTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allClubs = ref.watch(clubsProvider);
    final chartClubs = ref.watch(chartClubsProvider); // loft 5-60°
    final headSpeed = ref.watch(headSpeedProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Section header ──────────────────────────────────────────────
          const Text(
            'Loft vs Estimated Distance',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            'Category-specific curves with a 42 m/s baseline  •  tap a dot for details',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          ),
          const SizedBox(height: 12),
          _HeadSpeedInput(
            currentValue: headSpeed,
            onCommit: (value) {
              ref.read(headSpeedProvider.notifier).setHeadSpeed(value);
            },
          ),
          const SizedBox(height: 16),

          // ── Scatter chart ────────────────────────────────────────────────
          Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 20, 24, 8),
              child:
                  _LoftVsDistanceChart(clubs: chartClubs, headSpeed: headSpeed),
            ),
          ),
          const SizedBox(height: 12),

          // ── Legend ───────────────────────────────────────────────────────
          const _ChartLegend(),
          const SizedBox(height: 24),
          const Divider(height: 32),

          // ── Data table ───────────────────────────────────────────────────
          const Text(
            'Club Data Table',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            'Tap the Actual Distance column to enter your real carry distance.',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          ),
          const SizedBox(height: 10),
          _LoftDistanceTable(
            clubs: allClubs,
            headSpeed: headSpeed,
            onDistanceChanged: (id, yards) {
              ref.read(clubsProvider.notifier).updateClubDistance(id, yards);
            },
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ============================================================================
// _LoftVsDistanceChart
// Renders a ScatterChart (fl_chart) with an actual-distance connecting line
// overlaid via a transparent LineChart in a Stack.
// ============================================================================
class _LoftVsDistanceChart extends StatelessWidget {
  final List<GolfClub> clubs;
  final double headSpeed;

  const _LoftVsDistanceChart({required this.clubs, required this.headSpeed});

  // Chart axis bounds
  static const double _minX = 5;
  static const double _maxX = 65;
  static const double _minY = 0;
  static const double _maxY = 340;

  // Shared axis padding — both chart widgets MUST use these exact values so
  // the data areas are perfectly aligned in the Stack overlay.
  static const double _leftReserved = 44;
  static const double _leftAxisName = 20;
  static const double _bottomReserved = 30;
  static const double _bottomAxisName = 20;

  List<FlSpot> _buildActualLineSpots() {
    final sorted = [...clubs]
      ..sort((a, b) => a.loftAngle.compareTo(b.loftAngle));
    return [
      for (final c in sorted)
        if (c.distance > 0) FlSpot(c.loftAngle, c.distance),
    ];
  }

  bool _isActualSpot(GolfClub club, ScatterSpot spot) {
    return club.distance > 0 && (spot.y - club.distance).abs() < 0.01;
  }

  // ── Scatter spots ────────────────────────────────────────────────────────
  List<ScatterSpot> _buildSpots() {
    return [
      for (final c in clubs) ...[
        ScatterSpot(
          c.loftAngle,
          c.estimatedDistanceFor(headSpeed),
          dotPainter: FlDotCirclePainter(
            color: Colors.white,
            radius: 10,
            strokeColor: c.category.color,
            strokeWidth: 3,
          ),
        ),
        if (c.distance > 0)
          ScatterSpot(
            c.loftAngle,
            c.distance,
            dotPainter: FlDotCirclePainter(
              color: c.category.color,
              radius: 9,
              strokeColor: Colors.white,
              strokeWidth: 1.5,
            ),
          ),
      ],
    ];
  }

  // ── ScatterChartData ─────────────────────────────────────────────────────
  ScatterChartData _buildScatterData() {
    return ScatterChartData(
      minX: _minX,
      maxX: _maxX,
      minY: _minY,
      maxY: _maxY,
      scatterSpots: _buildSpots(),
      titlesData: FlTitlesData(
        leftTitles: AxisTitles(
          axisNameWidget: const RotatedBox(
            quarterTurns: 3,
            child: Text('Distance (y)', style: TextStyle(fontSize: 11)),
          ),
          axisNameSize: _leftAxisName,
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: _leftReserved,
            interval: 50,
            getTitlesWidget: (val, meta) => Text(
              val.toInt().toString(),
              style: const TextStyle(fontSize: 10, color: Colors.grey),
            ),
          ),
        ),
        bottomTitles: AxisTitles(
          axisNameWidget:
              const Text('Loft Angle (°)', style: TextStyle(fontSize: 11)),
          axisNameSize: _bottomAxisName,
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: _bottomReserved,
            interval: 10,
            getTitlesWidget: (val, meta) => Text(
              '${val.toInt()}°',
              style: const TextStyle(fontSize: 10, color: Colors.grey),
            ),
          ),
        ),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles:
            const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      gridData: FlGridData(
        show: true,
        horizontalInterval: 50,
        verticalInterval: 10,
        getDrawingHorizontalLine: (_) =>
            FlLine(color: Colors.grey.shade200, strokeWidth: 1),
        getDrawingVerticalLine: (_) =>
            FlLine(color: Colors.grey.shade200, strokeWidth: 1),
      ),
      borderData: FlBorderData(
        show: true,
        border: Border.all(color: Colors.grey.shade300),
      ),
      scatterTouchData: ScatterTouchData(
        enabled: true,
        touchTooltipData: ScatterTouchTooltipData(
          getTooltipColor: (_) => const Color(0xDD1C1C1E),
          tooltipPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          getTooltipItems: (ScatterSpot spot) {
            // Match club by loftAngle (which is our X value — unique per club)
            final club = clubs.firstWhere(
              (c) => c.loftAngle == spot.x,
              orElse: () => clubs.first,
            );
            final isActual = _isActualSpot(club, spot);
            final est = club.estimatedDistanceFor(headSpeed);
            return ScatterTooltipItem(
              '${club.name}\n'
              'Loft: ${club.loftAngle}°   ${isActual ? 'Actual' : 'Est'}: ${(isActual ? spot.y : est).toStringAsFixed(0)} y',
              textStyle: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                height: 1.5,
              ),
              bottomMargin: 8,
            );
          },
        ),
      ),
    );
  }

  // ── LineChartData for actual-distance overlay ─────────────────────────────
  // IMPORTANT: reserved sizes must mirror the ScatterChart exactly so the
  // two chart data-area rectangles are pixel-aligned inside the Stack.
  LineChartData _buildActualLineData() {
    final actualSpots = _buildActualLineSpots();
    final canDrawLine = actualSpots.length >= 2;
    return LineChartData(
      minX: _minX,
      maxX: _maxX,
      minY: _minY,
      maxY: _maxY,
      backgroundColor: Colors.transparent,
      borderData: FlBorderData(show: false),
      gridData: const FlGridData(show: false),
      titlesData: FlTitlesData(
        leftTitles: AxisTitles(
          axisNameSize: _leftAxisName,
          sideTitles:
              SideTitles(showTitles: false, reservedSize: _leftReserved),
        ),
        bottomTitles: AxisTitles(
          axisNameSize: _bottomAxisName,
          sideTitles:
              SideTitles(showTitles: false, reservedSize: _bottomReserved),
        ),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles:
            const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      lineBarsData: canDrawLine
          ? [
              LineChartBarData(
                spots: actualSpots,
                isCurved: false,
                color: Colors.orange.withValues(alpha: 0.75),
                barWidth: 2,
                isStrokeCapRound: true,
                dotData: const FlDotData(show: false),
              ),
            ]
          : const [],
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 320,
      child: Stack(
        children: [
          ScatterChart(_buildScatterData()),
          // Actual line overlay — ignore pointer so scatter touch-events still fire
          IgnorePointer(
            child: LineChart(_buildActualLineData()),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// _ChartLegend
// ============================================================================
class _ChartLegend extends StatelessWidget {
  const _ChartLegend();

  @override
  Widget build(BuildContext context) {
    const categories = [
      (ClubCategory.wood, 'Woods'),
      (ClubCategory.hybrid, 'Hybrids'),
      (ClubCategory.iron, 'Irons'),
      (ClubCategory.wedge, 'Wedges'),
      (ClubCategory.putter, 'Putter'),
    ];

    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: [
        ...categories.map(
          (entry) => _LegendDot(color: entry.$1.color, label: entry.$2),
        ),
        const _LegendMarker(
          fillColor: Colors.white,
          strokeColor: Color(0xFF44574D),
          label: 'Estimated',
          strokeWidth: 2,
        ),
        const _LegendMarker(
          fillColor: Color(0xFF44574D),
          strokeColor: Color(0xFF44574D),
          label: 'Actual',
        ),
        // Actual line indicator
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 22,
              height: 2,
              decoration: BoxDecoration(
                color: Colors.orange.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(1),
              ),
            ),
            const SizedBox(width: 5),
            const Text('Actual Line', style: TextStyle(fontSize: 12)),
          ],
        ),
      ],
    );
  }
}

class _HeadSpeedInput extends StatefulWidget {
  final double currentValue;
  final ValueChanged<double> onCommit;

  const _HeadSpeedInput({
    required this.currentValue,
    required this.onCommit,
  });

  @override
  State<_HeadSpeedInput> createState() => _HeadSpeedInputState();
}

class _HeadSpeedInputState extends State<_HeadSpeedInput> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.currentValue.toStringAsFixed(1),
    );
  }

  @override
  void didUpdateWidget(covariant _HeadSpeedInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentValue != widget.currentValue) {
      _controller.text = widget.currentValue.toStringAsFixed(1);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _commit() {
    final parsed = double.tryParse(_controller.text.trim());
    if (parsed == null) {
      _controller.text = widget.currentValue.toStringAsFixed(1);
      return;
    }
    final clamped = parsed.clamp(30.0, 60.0);
    widget.onCommit(clamped);
    _controller.text = clamped.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.speed_outlined, size: 18),
            const SizedBox(width: 8),
            const Text(
              'Head Speed',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 88,
              child: TextField(
                controller: _controller,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,1}')),
                  LengthLimitingTextInputFormatter(4),
                ],
                decoration: const InputDecoration(
                  isDense: true,
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                ),
                onSubmitted: (_) => _commit(),
                onTapOutside: (_) => _commit(),
              ),
            ),
            const SizedBox(width: 8),
            Text('m/s',
                style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _LegendMarker extends StatelessWidget {
  final Color fillColor;
  final Color strokeColor;
  final double strokeWidth;
  final String label;

  const _LegendMarker({
    required this.fillColor,
    required this.strokeColor,
    required this.label,
    this.strokeWidth = 1,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: fillColor,
            shape: BoxShape.circle,
            border: Border.all(color: strokeColor, width: strokeWidth),
          ),
        ),
        const SizedBox(width: 5),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

// ============================================================================
// _LoftDistanceTable
// Data table with an editable "Actual Distance" column.
// ============================================================================
class _LoftDistanceTable extends StatelessWidget {
  final List<GolfClub> clubs;
  final double headSpeed;
  final void Function(int clubId, double yards) onDistanceChanged;

  const _LoftDistanceTable({
    required this.clubs,
    required this.headSpeed,
    required this.onDistanceChanged,
  });

  @override
  Widget build(BuildContext context) {
    final sorted = [...clubs]
      ..sort((a, b) => a.loftAngle.compareTo(b.loftAngle));

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 2,
      clipBehavior: Clip.hardEdge,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columnSpacing: 18,
          headingRowHeight: 40,
          dataRowMinHeight: 44,
          dataRowMaxHeight: 56,
          headingRowColor: WidgetStateProperty.all(Colors.grey.shade100),
          columns: const [
            DataColumn(label: _HeaderCell('Club')),
            DataColumn(label: _HeaderCell('Loft'), numeric: true),
            DataColumn(label: _HeaderCell('Est. Dist'), numeric: true),
            DataColumn(label: _HeaderCell('Actual Dist')),
          ],
          rows: sorted.map((club) {
            final actual = club.distance;
            return DataRow(
              cells: [
                // Club name with colour dot
                DataCell(Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEAF4ED),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        club.clubType,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2D4A3B),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: club.category.color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(club.name, style: const TextStyle(fontSize: 13)),
                  ],
                )),
                DataCell(Text(
                  '${club.loftAngle.toStringAsFixed(1)}°',
                  style: const TextStyle(fontSize: 13),
                )),
                // Estimated distance (read-only, blue-grey)
                DataCell(Text(
                  '${club.estimatedDistanceFor(headSpeed).toStringAsFixed(0)} y',
                  style:
                      const TextStyle(fontSize: 13, color: Color(0xFF546E7A)),
                )),
                // Actual distance (editable)
                DataCell(_EditableDistanceCell(
                  key: ValueKey('dist_${club.id}'),
                  currentValue: actual,
                  onCommit: (yards) => onDistanceChanged(club.id, yards),
                )),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _HeaderCell extends StatelessWidget {
  final String text;
  const _HeaderCell(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13));
}

// ============================================================================
// _EditableDistanceCell
// Tap to enter edit mode; shows a compact TextField.
// Commits on submit or focus-loss; ignores non-numeric or out-of-range input.
// ============================================================================
class _EditableDistanceCell extends StatefulWidget {
  final double currentValue;
  final ValueChanged<double> onCommit;

  const _EditableDistanceCell({
    super.key,
    required this.currentValue,
    required this.onCommit,
  });

  @override
  State<_EditableDistanceCell> createState() => _EditableDistanceCellState();
}

class _EditableDistanceCellState extends State<_EditableDistanceCell> {
  late final TextEditingController _ctrl;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
      text:
          widget.currentValue > 0 ? widget.currentValue.toStringAsFixed(0) : '',
    );
  }

  @override
  void didUpdateWidget(_EditableDistanceCell old) {
    super.didUpdateWidget(old);
    // Keep the text field in sync when the value is updated externally
    if (!_editing && old.currentValue != widget.currentValue) {
      _ctrl.text =
          widget.currentValue > 0 ? widget.currentValue.toStringAsFixed(0) : '';
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _commit() {
    final parsed = double.tryParse(_ctrl.text.trim());
    if (parsed != null && parsed >= 0 && parsed <= 400) {
      widget.onCommit(parsed);
    } else {
      // Revert to last valid value on bad input
      _ctrl.text =
          widget.currentValue > 0 ? widget.currentValue.toStringAsFixed(0) : '';
    }
    setState(() => _editing = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_editing) {
      return SizedBox(
        width: 88,
        child: TextField(
          controller: _ctrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(3),
          ],
          style: const TextStyle(fontSize: 13),
          decoration: InputDecoration(
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
            suffixText: 'y',
            suffixStyle: TextStyle(fontSize: 11, color: Colors.grey[600]),
          ),
          onSubmitted: (_) => _commit(),
          // onTapOutside requires Flutter 3.7+
          onTapOutside: (_) => _commit(),
        ),
      );
    }

    final hasValue = widget.currentValue > 0;
    return GestureDetector(
      onTap: () => setState(() {
        _editing = true;
        _ctrl.selection = TextSelection(
          baseOffset: 0,
          extentOffset: _ctrl.text.length,
        );
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: hasValue ? null : Colors.amber.shade50,
          border: Border.all(
            color: hasValue ? Colors.grey.shade300 : Colors.amber.shade200,
          ),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              hasValue
                  ? '${widget.currentValue.toStringAsFixed(0)} y'
                  : 'tap to set',
              style: TextStyle(
                fontSize: 13,
                color: hasValue ? Colors.black87 : Colors.grey,
              ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.edit_outlined, size: 13, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
  }
}
