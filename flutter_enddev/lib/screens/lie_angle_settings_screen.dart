import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user_lie_angle_standards.dart';
import '../providers/club_providers.dart';

class LieAngleSettingsScreen extends ConsumerWidget {
  const LieAngleSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clubs = ref.watch(clubsProvider);
    final userStandards = ref.watch(userLieAngleStandardsProvider);
    final notifier = ref.read(userLieAngleStandardsProvider.notifier);

    final clubTypeKeys = {
      ...kDefaultLieAngleStandardsByClubType.keys,
      ...clubs.map(UserLieAngleStandards.standardTypeKeyForClub),
    }.toList()
      ..sort(UserLieAngleStandards.compareClubTypeOrder);

    final sortedClubs = ref.watch(sortedClubsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('ライ角基準値設定'),
        actions: [
          TextButton(
            onPressed: notifier.resetAll,
            child: const Text(
              '全てリセット',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            '何を設定すればいい？',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1B5E20),
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'まずはクラブタイプ別を設定し、必要なクラブだけ個別上書きを入れてください。',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          const _GuideCard(),
          const SizedBox(height: 18),
          _SectionCard(
            title: '1) クラブタイプ別（基本）',
            subtitle:
                '現在の clubType・番手・ロフトから基準タイプを自動判定しています。個別上書きがある場合のみ、そちらが優先されます。',
            child: Column(
              children: [
                for (final clubTypeKey in clubTypeKeys)
                  _StandardInputRow(
                    label: UserLieAngleStandards.displayLabelForClubType(
                      clubTypeKey,
                    ),
                    defaultValue:
                        kDefaultLieAngleStandardsByClubType[clubTypeKey] ??
                            UserLieAngleStandards.fallbackForClubType(
                              clubTypeKey,
                            ),
                    currentValue: userStandards.byClubType[clubTypeKey],
                    onChanged: (value) =>
                        notifier.setClubTypeStandard(clubTypeKey, value),
                    onReset: () => notifier.clearClubTypeStandard(clubTypeKey),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _SectionCard(
            title: '2) クラブ別 override（必要なものだけ）',
            subtitle: '個別調整したいクラブだけ設定してください。未設定なら上の基本値を使います。',
            child: Column(
              children: [
                for (final club in sortedClubs)
                  // Keep per-club overrides unique even when model names repeat across lofts.
                  _StandardInputRow(
                    label: '${club.name} ${club.number}'.trim(),
                    supportingText: club.clubType,
                    defaultValue: userStandards.standardFor(club),
                    currentValue: userStandards
                        .byClubName[UserLieAngleStandards.perClubKey(
                      club.name,
                      club.clubType,
                      club.number,
                    )],
                    onChanged: (value) => notifier.setClubNameStandard(
                      UserLieAngleStandards.perClubKey(
                        club.name,
                        club.clubType,
                        club.number,
                      ),
                      value,
                    ),
                    onReset: () => notifier.clearClubNameStandard(
                      UserLieAngleStandards.perClubKey(
                        club.name,
                        club.clubType,
                        club.number,
                      ),
                    ),
                  ),
              ],
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
                '使い方（おすすめ手順）',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1B5E20),
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text('1. 先に「クラブタイプ別」を設定する'),
          Text('2. ずれが気になるクラブだけ「クラブ別 override」を設定する'),
          Text('3. 入力後に Enter で保存。戻すときは右のリセットアイコンを押す'),
        ],
      ),
    );
  }
}

class _StandardInputRow extends StatefulWidget {
  const _StandardInputRow({
    required this.label,
    required this.defaultValue,
    required this.currentValue,
    required this.onChanged,
    required this.onReset,
    this.supportingText,
  });

  final String label;
  final String? supportingText;
  final double defaultValue;
  final double? currentValue;
  final ValueChanged<double> onChanged;
  final VoidCallback onReset;

  @override
  State<_StandardInputRow> createState() => _StandardInputRowState();
}

class _StandardInputRowState extends State<_StandardInputRow> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: (widget.currentValue ?? widget.defaultValue).toStringAsFixed(1),
    );
  }

  @override
  void didUpdateWidget(covariant _StandardInputRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextText =
        (widget.currentValue ?? widget.defaultValue).toStringAsFixed(1);
    if (_controller.text != nextText) {
      _controller.text = nextText;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isOverridden = widget.currentValue != null;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.label,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                if (widget.supportingText != null)
                  Text(
                    widget.supportingText!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                const SizedBox(height: 2),
                Text(
                  isOverridden
                      ? '上書き中: ${widget.currentValue!.toStringAsFixed(1)}°'
                      : '未設定（標準値 ${widget.defaultValue.toStringAsFixed(1)}° を使用）',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isOverridden
                            ? const Color(0xFFB26A00)
                            : const Color(0xFF546E5A),
                        fontWeight:
                            isOverridden ? FontWeight.w700 : FontWeight.w500,
                      ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 96,
            child: TextField(
              controller: _controller,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                suffixText: '°',
                isDense: true,
                border: OutlineInputBorder(),
              ),
              onSubmitted: (value) {
                final parsed = double.tryParse(value.trim());
                if (parsed != null) {
                  widget.onChanged(parsed);
                }
              },
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'この行の上書きを解除',
            onPressed: widget.onReset,
            icon: const Icon(Icons.restart_alt_rounded),
          ),
        ],
      ),
    );
  }
}
