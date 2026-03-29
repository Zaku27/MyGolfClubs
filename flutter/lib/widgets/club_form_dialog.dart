import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/golf_club.dart';

class ClubFormDialog extends StatefulWidget {
  final GolfClub? initialClub;
  final void Function(GolfClub) onSave;

  const ClubFormDialog({
    super.key,
    this.initialClub,
    required this.onSave,
  });

  @override
  State<ClubFormDialog> createState() => _ClubFormDialogState();
}

class _ClubFormDialogState extends State<ClubFormDialog> {
  late final GlobalKey<FormState> _formKey;
  late final TextEditingController _nameController;
  late final TextEditingController _numberController;
  late final TextEditingController _loftController;
  late final TextEditingController _lengthController;
  late final TextEditingController _weightController;
  late final TextEditingController _swingWeightController;
  late final TextEditingController _lieAngleController;
  late final TextEditingController _shaftTypeController;
  late final TextEditingController _torqueController;
  late final TextEditingController _flexController;
  late final TextEditingController _distanceController;
  late final TextEditingController _notesController;

  String? _selectedClubType;
  String? _selectedSuggestion;

  bool get _isPutterSelected => _selectedClubType == 'Putter';

  static const List<String> _clubTypeOptions = [
    'Driver',
    'Wood',
    'Hybrid',
    'Iron',
    'Wedge',
    'Putter',
  ];

  static const Map<String, List<String>> _numberSuggestions = {
    'Driver': ['1W'],
    'Wood': ['3W', '5W', '7W', '9W'],
    'Hybrid': ['2H', '3H', '4H', '5H', '6H'],
    'Iron': ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    'Wedge': ['PW', 'GW', 'AW', 'SW', 'LW'],
  };

  @override
  void initState() {
    super.initState();
    _formKey = GlobalKey<FormState>();

    _nameController =
        TextEditingController(text: widget.initialClub?.name ?? '');
    _numberController =
        TextEditingController(text: widget.initialClub?.number ?? '');
    _loftController = TextEditingController(
      text: widget.initialClub != null
          ? widget.initialClub!.loftAngle.toString()
          : '',
    );
    _lengthController = TextEditingController(
      text: widget.initialClub != null
          ? widget.initialClub!.length.toString()
          : '',
    );
    _weightController = TextEditingController(
      text: widget.initialClub != null
          ? widget.initialClub!.weight.toString()
          : '',
    );
    _swingWeightController =
        TextEditingController(text: widget.initialClub?.swingWeight ?? '');
    _lieAngleController = TextEditingController(
      text: widget.initialClub != null
          ? widget.initialClub!.lieAngle.toString()
          : '',
    );
    _shaftTypeController =
        TextEditingController(text: widget.initialClub?.shaftType ?? '');
    _torqueController = TextEditingController(
      text: widget.initialClub != null
          ? widget.initialClub!.torque.toString()
          : '',
    );
    _flexController =
        TextEditingController(text: widget.initialClub?.flex ?? 'R');
    _distanceController = TextEditingController(
      text: widget.initialClub != null && widget.initialClub!.distance > 0
          ? widget.initialClub!.distance.toString()
          : '',
    );
    _notesController =
        TextEditingController(text: widget.initialClub?.notes ?? '');

    _selectedClubType = widget.initialClub?.clubType;

    if (_selectedClubType == null) {
      _selectedClubType = 'Driver';
      _applyClubTypeDefault('Driver', force: true);
    } else {
      _initializeSuggestionSelection();
      _applyClubTypeDefault(_selectedClubType!,
          force: _numberController.text.trim().isEmpty);
      _applyPutterRules();
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _numberController.dispose();
    _loftController.dispose();
    _lengthController.dispose();
    _weightController.dispose();
    _swingWeightController.dispose();
    _lieAngleController.dispose();
    _shaftTypeController.dispose();
    _torqueController.dispose();
    _flexController.dispose();
    _distanceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _initializeSuggestionSelection() {
    final type = _selectedClubType;
    final current = _numberController.text.trim().toUpperCase();
    if (type == null || current.isEmpty) {
      _selectedSuggestion = null;
      return;
    }

    final suggestions = _numberSuggestions[type] ?? const <String>[];
    _selectedSuggestion = suggestions.contains(current) ? current : 'Custom';
  }

  void _onClubTypeChanged(String? value) {
    if (value == null || value == _selectedClubType) {
      return;
    }

    setState(() {
      _selectedClubType = value;
      _selectedSuggestion = null;
      _applyClubTypeDefault(value, force: true);
      _applyPutterRules();
    });
  }

  void _applyPutterRules() {
    if (_isPutterSelected) {
      _swingWeightController.clear();
    }
  }

  void _applyClubTypeDefault(String clubType, {required bool force}) {
    final current = _numberController.text.trim();
    if (!force && current.isNotEmpty) {
      return;
    }

    switch (clubType) {
      case 'Driver':
        _numberController.text = '1W';
        _selectedSuggestion = '1W';
        break;
      case 'Wood':
        _numberController.text = '3W';
        _selectedSuggestion = '3W';
        break;
      case 'Hybrid':
        _numberController.text = '3H';
        _selectedSuggestion = '3H';
        break;
      case 'Iron':
        _numberController.text = '7';
        _selectedSuggestion = '7';
        break;
      case 'Wedge':
        _numberController.text = 'PW';
        _selectedSuggestion = 'PW';
        break;
      case 'Putter':
        _numberController.text = 'Putter';
        _selectedSuggestion = null;
        _swingWeightController.clear();
        break;
    }
  }

  String _normalizeClubNumber(String type, String rawValue) {
    final normalized = rawValue.trim().toUpperCase().replaceAll(' ', '');
    if (type == 'Putter') {
      return 'Putter';
    }
    if (type == 'Driver' && normalized.isEmpty) {
      return '1W';
    }
    return normalized;
  }

  void _handleSave() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final clubType = _selectedClubType ?? 'Driver';
    final cleanedNumber =
        _normalizeClubNumber(clubType, _numberController.text);

    final newClub = GolfClub(
      id: widget.initialClub?.id ?? DateTime.now().millisecondsSinceEpoch,
      clubType: clubType,
      name: _nameController.text.trim(),
      number: cleanedNumber,
      loftAngle: double.tryParse(_loftController.text) ?? 0.0,
      length: double.tryParse(_lengthController.text) ?? 0.0,
      weight: double.tryParse(_weightController.text) ?? 0.0,
      swingWeight: _isPutterSelected ? '' : _swingWeightController.text.trim(),
      lieAngle: double.tryParse(_lieAngleController.text) ?? 0.0,
      shaftType: _shaftTypeController.text.trim(),
      torque: double.tryParse(_torqueController.text) ?? 0.0,
      flex: _flexController.text.trim(),
      distance: double.tryParse(_distanceController.text) ?? 0.0,
      notes: _notesController.text.trim(),
    );

    widget.onSave(newClub);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.initialClub != null;

    return Dialog(
      insetPadding: const EdgeInsets.all(16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isEditing ? 'クラブ情報を編集' : '新しいクラブを追加',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 16),
                  _buildClubTypeField(),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _nameController,
                    decoration: _inputDecoration(
                      context,
                      label: 'クラブ名（メーカー・モデル） *',
                      hint: '例: Ping G430, Titleist T150',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'クラブ名を入力してください';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    child: _buildDynamicNumberField(),
                  ),
                  const SizedBox(height: 16),
                  _buildSectionHeading(context, 'スペック'),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _loftController,
                    decoration: _inputDecoration(
                      context,
                      label: 'ロフト角',
                      hint: '10.5',
                      suffix: '°',
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*$')),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildResponsivePair(
                    first: TextFormField(
                      controller: _lengthController,
                      decoration: _inputDecoration(
                        context,
                        label: '長さ',
                        hint: '45.5',
                        suffix: 'in',
                      ),
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d*$')),
                      ],
                    ),
                    second: TextFormField(
                      controller: _weightController,
                      decoration: _inputDecoration(
                        context,
                        label: '重量',
                        hint: '310',
                        suffix: 'g',
                      ),
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d*$')),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _isPutterSelected
                      ? TextFormField(
                          controller: _lieAngleController,
                          decoration: _inputDecoration(
                            context,
                            label: 'ライ角',
                            hint: '58.0',
                            suffix: '°',
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                                RegExp(r'^\d*\.?\d*$')),
                          ],
                        )
                      : _buildResponsivePair(
                          first: TextFormField(
                            controller: _swingWeightController,
                            decoration: _inputDecoration(
                              context,
                              label: 'スイングウェイト',
                              hint: 'D1',
                            ),
                          ),
                          second: TextFormField(
                            controller: _lieAngleController,
                            decoration: _inputDecoration(
                              context,
                              label: 'ライ角',
                              hint: '58.0',
                              suffix: '°',
                            ),
                            keyboardType: const TextInputType.numberWithOptions(
                                decimal: true),
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(
                                  RegExp(r'^\d*\.?\d*$')),
                            ],
                          ),
                        ),
                  const SizedBox(height: 16),
                  _buildResponsiveTriple(
                    first: TextFormField(
                      controller: _shaftTypeController,
                      decoration: _inputDecoration(
                        context,
                        label: 'シャフト',
                        hint: 'Graphite S',
                      ),
                    ),
                    second: TextFormField(
                      controller: _torqueController,
                      decoration: _inputDecoration(
                        context,
                        label: 'トルク',
                        hint: '4.5',
                      ),
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d*$')),
                      ],
                    ),
                    third: TextFormField(
                      controller: _flexController,
                      decoration: _inputDecoration(
                        context,
                        label: 'フレックス',
                        hint: 'R',
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildSectionHeading(context, '追加情報'),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _distanceController,
                    decoration: _inputDecoration(
                      context,
                      label: '飛距離',
                      hint: '165',
                      suffix: 'yd',
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*$')),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _notesController,
                    decoration: _inputDecoration(
                      context,
                      label: 'メモ',
                      hint: '追加情報（オプション）',
                    ),
                    minLines: 1,
                    maxLines: 3,
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('キャンセル'),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _handleSave,
                        child: Text(isEditing ? '更新' : '保存'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildClubTypeField() {
    return DropdownButtonFormField<String>(
      initialValue: _selectedClubType,
      isExpanded: true,
      decoration: _inputDecoration(
        context,
        label: 'クラブタイプ *',
      ),
      items: _clubTypeOptions
          .map(
            (type) => DropdownMenuItem<String>(
              value: type,
              child: Text(type),
            ),
          )
          .toList(),
      onChanged: _onClubTypeChanged,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'クラブタイプを選択してください';
        }
        return null;
      },
    );
  }

  Widget _buildDynamicNumberField() {
    final clubType = _selectedClubType ?? 'Driver';

    if (clubType == 'Putter') {
      return TextFormField(
        key: const ValueKey<String>('putter-number'),
        enabled: false,
        initialValue: 'Putter',
        decoration: _inputDecoration(
          context,
          label: 'クラブ番号',
          hint: 'Putter',
        ),
      );
    }

    if (clubType == 'Driver') {
      return DropdownButtonFormField<String>(
        key: const ValueKey<String>('driver-number-dropdown'),
        initialValue: (_numberSuggestions['Driver'] ?? const ['1W'])
                .contains(_numberController.text)
            ? _numberController.text
            : '1W',
        isExpanded: true,
        decoration: _inputDecoration(
          context,
          label: 'クラブ番号 *',
        ),
        items: const [DropdownMenuItem(value: '1W', child: Text('1W'))],
        onChanged: (value) {
          if (value == null) return;
          setState(() {
            _numberController.text = value;
            _selectedSuggestion = value;
          });
        },
        validator: (value) {
          if (value == null || value.trim().isEmpty) {
            return 'クラブ番号を選択してください';
          }
          return null;
        },
      );
    }

    final suggestions = _numberSuggestions[clubType] ?? const <String>[];
    final dropdownValue = suggestions.contains(_selectedSuggestion)
        ? _selectedSuggestion
        : 'Custom';
    final isCustom = dropdownValue == 'Custom';

    return Column(
      key: ValueKey<String>('dynamic-number-$clubType'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: dropdownValue,
          isExpanded: true,
          decoration: _inputDecoration(
            context,
            label: 'よく使うクラブ番号',
          ),
          items: [
            ...suggestions.map((value) {
              final label = clubType == 'Iron' && value == '1'
                  ? '1 (Rare 1I)'
                  : clubType == 'Iron' && value == '2'
                      ? '2 (Rare 2I)'
                      : value;
              return DropdownMenuItem<String>(
                value: value,
                child: Text(label),
              );
            }),
            const DropdownMenuItem<String>(
              value: 'Custom',
              child: Text('Custom (free text)'),
            ),
          ],
          onChanged: (value) {
            if (value == null) return;
            setState(() {
              _selectedSuggestion = value;
              if (value != 'Custom') {
                _numberController.text = value;
              }
            });
          },
        ),
        if (isCustom) ...[
          const SizedBox(height: 10),
          TextFormField(
            controller: _numberController,
            textCapitalization: TextCapitalization.characters,
            decoration: _inputDecoration(
              context,
              label: 'クラブ番号 *',
              hint: '例: 7, PW, 3W, 4H',
            ),
            validator: (value) {
              if (!isCustom) {
                return null;
              }
              if (value == null || value.trim().isEmpty) {
                return 'クラブ番号を入力してください';
              }
              return null;
            },
          ),
        ],
      ],
    );
  }

  Widget _buildSectionHeading(BuildContext context, String title) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: colorScheme.onSurface,
              ),
        ),
        const SizedBox(height: 6),
        Divider(color: colorScheme.outlineVariant),
      ],
    );
  }

  InputDecoration _inputDecoration(
    BuildContext context, {
    required String label,
    String? hint,
    String? suffix,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      suffixText: suffix,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      alignLabelWithHint: true,
    );
  }

  Widget _buildResponsivePair({
    required Widget first,
    required Widget second,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 520) {
          return Column(
            children: [
              first,
              const SizedBox(height: 12),
              second,
            ],
          );
        }

        return Row(
          children: [
            Expanded(child: first),
            const SizedBox(width: 12),
            Expanded(child: second),
          ],
        );
      },
    );
  }

  Widget _buildResponsiveTriple({
    required Widget first,
    required Widget second,
    required Widget third,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 640) {
          return Column(
            children: [
              first,
              const SizedBox(height: 12),
              second,
              const SizedBox(height: 12),
              third,
            ],
          );
        }

        return Row(
          children: [
            Expanded(flex: 2, child: first),
            const SizedBox(width: 12),
            Expanded(child: second),
            const SizedBox(width: 12),
            Expanded(child: third),
          ],
        );
      },
    );
  }
}
