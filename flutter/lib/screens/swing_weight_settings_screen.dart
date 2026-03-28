import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/club_providers.dart';

class SwingWeightSettingsScreen extends ConsumerWidget {
  const SwingWeightSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final target = ref.watch(swingWeightTargetProvider);
    final notifier = ref.read(swingWeightTargetProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('スイングウェイト目安設定'),
        actions: [
          TextButton(
            onPressed: notifier.reset,
            child: const Text(
              '初期値に戻す',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            '目安ターゲットを設定',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1B5E20),
                ),
          ),
          const SizedBox(height: 8),
          Text(
            '入力した値が SW 分布チャートの参照線・偏差・ステータス判定に即時反映されます。',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          const _GuideCard(),
          const SizedBox(height: 18),
          _SectionCard(
            title: '目安ターゲット',
            subtitle: '推奨初期値は D2（2.0）です。0.1 刻みで調整できます。',
            child: _TargetInputRow(
              value: target,
              onChanged: notifier.setTarget,
              onReset: notifier.reset,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: const Color(0xFFF7FBF7),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0xFFD7E7D5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 4),
            Text(subtitle),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _GuideCard extends StatelessWidget {
  const _GuideCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF7EE),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFCEE4CC)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.lightbulb_rounded, size: 18, color: Color(0xFF2E7D32)),
              SizedBox(width: 6),
              Text(
                '使い方',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1B5E20),
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text('1. 目安ターゲットを 0.1 刻みで入力する'),
          Text('2. SW分布タブに戻り、目安ラインと偏差を確認する'),
          Text('3. 必要なら「初期値に戻す」で D2（2.0）に戻す'),
        ],
      ),
    );
  }
}

class _TargetInputRow extends StatefulWidget {
  const _TargetInputRow({
    required this.value,
    required this.onChanged,
    required this.onReset,
  });

  final double value;
  final ValueChanged<double> onChanged;
  final VoidCallback onReset;

  @override
  State<_TargetInputRow> createState() => _TargetInputRowState();
}

class _TargetInputRowState extends State<_TargetInputRow> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value.toStringAsFixed(1));
  }

  @override
  void didUpdateWidget(covariant _TargetInputRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextText = widget.value.toStringAsFixed(1);
    if (_controller.text != nextText) {
      _controller.text = nextText;
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
      _controller.text = widget.value.toStringAsFixed(1);
      return;
    }
    widget.onChanged(parsed);
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '目安ターゲット数値',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              Text(
                '現在値: ${widget.value.toStringAsFixed(1)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 2),
              Text(
                '入力範囲: -30.0 〜 30.0（0.1刻み）',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF546E5A),
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ],
          ),
        ),
        SizedBox(
          width: 112,
          child: TextField(
            controller: _controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^-?\d*\.?\d{0,1}')),
              LengthLimitingTextInputFormatter(6),
            ],
            decoration: const InputDecoration(
              suffixText: 'pt',
              isDense: true,
              border: OutlineInputBorder(),
            ),
            onSubmitted: (_) => _commit(),
            onTapOutside: (_) => _commit(),
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          tooltip: '初期値に戻す',
          onPressed: widget.onReset,
          icon: const Icon(Icons.restart_alt_rounded),
        ),
      ],
    );
  }
}
