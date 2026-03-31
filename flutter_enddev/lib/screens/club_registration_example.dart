import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/golf_club.dart';
import '../providers/club_providers.dart';
import '../widgets/club_form_dialog.dart';

// ============================================================================
// ClubRegistrationExample — Example screen showing club registration/edit form
// ============================================================================
class ClubRegistrationExample extends ConsumerWidget {
  const ClubRegistrationExample({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sortedClubs = ref.watch(sortedClubsProvider);
    final notifier = ref.read(clubsProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('クラブ管理'),
        centerTitle: false,
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: sortedClubs.length,
        itemBuilder: (context, index) {
          final club = sortedClubs[index];
          return _ClubCard(
            club: club,
            onEdit: () {
              _showClubFormDialog(context, club, notifier);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: '新しいクラブを追加',
        onPressed: () {
          _showClubFormDialog(context, null, notifier);
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showClubFormDialog(
    BuildContext context,
    GolfClub? club,
    dynamic notifier,
  ) {
    showDialog(
      context: context,
      builder: (_) => ClubFormDialog(
        initialClub: club,
        onSave: (newClub) {
          // Here you would typically add/update the club in your provider
          // Example: notifier.addClub(newClub) or notifier.updateClub(newClub)
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${newClub.name} を保存しました'),
              duration: const Duration(seconds: 2),
            ),
          );
        },
      ),
    );
  }
}

// ============================================================================
// _ClubCard — A card displaying club information
// ============================================================================
class _ClubCard extends StatelessWidget {
  final GolfClub club;
  final VoidCallback onEdit;

  const _ClubCard({
    required this.club,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        club.name,
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'カテゴリ: ${club.category.label}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey[600],
                            ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: club.category.color.withAlpha(200),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    club.category.label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildInfoBadge('ロフト', '${club.loftAngle}°'),
                const SizedBox(width: 8),
                _buildInfoBadge('長さ', '${club.length}in'),
                const SizedBox(width: 8),
                _buildInfoBadge('重量', '${club.weight}g'),
              ],
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.edit),
                label: const Text('編集'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoBadge(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: Colors.grey[100],
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: Colors.grey[300]!,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey[600],
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
