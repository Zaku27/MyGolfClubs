# Golf Club Registration Form Redesign

## Overview

The GolfClub registration/edit form has been redesigned to provide a much clearer, dropdownbased interface that prevents club type misclassification (e.g., distinguishing "Ping W" wedge from Wood).

## Changes Made

### 1. **Updated `GolfClub` Model** (`golf_club.dart`)

#### Added Driver to ClubCategory Enum
```dart
enum ClubCategory { driver, wood, hybrid, iron, wedge, putter }
```

- **Driver** now has its own category (not grouped with Wood)
- Each category has a distinct color for UI display:
  - Driver: Red (#D32F2F)
  - Wood: Blue (#1565C0)
  - Hybrid: Teal (#00695C)
  - Iron: Green (#2E7D32)
  - Wedge: Yellow-Green (#9ACD32)
  - Putter: Grey (#757575)

#### Updated `category` Getter
The category detection logic now properly handles Driver:
```dart
ClubCategory get category {
  if (clubType == 'Driver') return ClubCategory.driver;
  if (clubType == 'PW') return ClubCategory.iron;
  if (clubType == 'D' || (clubType.endsWith('W') && clubType != 'Driver')) 
    return ClubCategory.wood;
  // ... etc
}
```

#### Enhanced `copyWith` Method
Now supports updating any field, not just distance:
```dart
GolfClub copyWith({
  int? id,
  String? clubType,
  String? name,
  double? loftAngle,
  // ... all other fields
}) => GolfClub(...)
```

### 2. **New Club Form Dialog Widget** (`widgets/club_form_dialog.dart`)

#### Key Features

**Dropdown with Fixed Options**
```
- Driver
- Wood
- Hybrid
- Iron
- Wedge
- Putter
```

**Helpful Description Section**
- Shows clear guidance text above dropdown
- Includes note about wedge classification

**Visual Examples**
Shows mapping examples like:
- "Ping G430 W" → Wedge
- "7 Iron" → Iron
- "3 Wood" → Wood

**Form Fields**
1. **Club Type** (Required) - Dropdown
2. **Club Name** (Required) - Free text field for user-friendly names
3. **Loft Angle** (Optional) - Degrees
4. **Length** (Optional) - Inches
5. **Weight** (Optional) - Grams
6. **Swing Weight** (Optional)
7. **Lie Angle** (Optional) - Degrees
8. **Shaft Type** (Optional)
9. **Torque** (Optional)
10. **Flex** (Optional) - S/SR/R/A/L
11. **Notes** (Optional) - Free text

#### Validation
- Club Type: Required
- Club Name: Required
- Numeric fields: Accept decimals only
- Friendly error messages in Japanese

#### Material 3 Styling
- Clean, modern design
- Rounded corners (12px)
- Color-coded helper sections
- Side-by-side field layouts for space efficiency
- Dialog-based modal presentation

### 3. **Example Integration Screen** (`screens/club_registration_example.dart`)

Demonstrates how to integrate the form:
```dart
showDialog(
  context: context,
  builder: (_) => ClubFormDialog(
    initialClub: club,  // null for new, GolfClub for edit
    onSave: (newClub) {
      // Handle saving logic here
    },
  ),
);
```

Includes:
- List view of clubs with edit capability
- Club cards showing summary information
- Floating action button to add new clubs
- Full material design styling

## Usage Guide

### Adding a New Club Dialog

```dart
import 'package:flutter/material.dart';
import 'club_form_dialog.dart';

showDialog(
  context: context,
  builder: (_) => ClubFormDialog(
    initialClub: null,  // New club
    onSave: (newClub) {
      // newClub contains all the form data
      // Add to your provider/database here
    },
  ),
);
```

### Editing an Existing Club

```dart
showDialog(
  context: context,
  builder: (_) => ClubFormDialog(
    initialClub: existingClub,  // Pre-fills form
    onSave: (updatedClub) {
      // Update your provider/database
    },
  ),
);
```

### Integrating with Your Riverpod Provider

```dart
// In your club_providers.dart
final clubsProvider = 
  StateNotifierProvider<ClubsNotifier, List<GolfClub>>(...);

// In your widget
@override
Widget build(BuildContext context, WidgetRef ref) {
  final notifier = ref.read(clubsProvider.notifier);
  
  showDialog(
    context: context,
    builder: (_) => ClubFormDialog(
      onSave: (newClub) {
        notifier.addClub(newClub);  // or updateClub(newClub)
      },
    ),
  );
}
```

## Data Storage

### Saving Club Type

The form stores `clubType` as one of these strings:
- "Driver"
- "Wood"
- "Hybrid"
- "Iron"
- "Wedge"
- "Putter"

When saving to database/storage:
```dart
// Before storing, you might want to map to a code
String _clubTypeToCode(String label) {
  return {
    'Driver': 'D',
    'Wood': 'W',
    'Hybrid': 'H',
    'Iron': 'I',
    'Wedge': 'WG',
    'Putter': 'P',
  }[label] ?? label;
}
```

Or store the label directly and let the `category` getter parse it.

## Benefits of This Redesign

1. **Prevents Misclassification**: Users can't mistake "Ping W" for Wood anymore
2. **Clear Categories**: Fixed dropdown options eliminate free-text confusion
3. **Rich Context**: Helper text and examples guide users
4. **Flexible Club Names**: Club name remains free text for user flexibility
5. **Complete Data Capture**: All relevant club specifications in one form
6. **Validation**: Required fields and format validation prevent data errors
7. **Material 3 Design**: Modern, professional appearance
8. **Internationalization Ready**: Japanese labels included

## Future Enhancements

Potential improvements:
- Add club images/icons for visual reference
- Pre-populate loft/length based on category and number
- Add quick-add templates for common clubs (e.g., "Standard 7-iron")
- Store photos of club markings
- Cloud sync for club specs
- Import from club manufacturer databases

## Files Modified

- `flutter/lib/models/golf_club.dart` - Updated ClubCategory enum and model
- `flutter/lib/widgets/club_form_dialog.dart` - New form widget (NEW)
- `flutter/lib/screens/club_registration_example.dart` - Example screen (NEW)

## Integration Checklist

- [ ] Review the ClubFormDialog widget
- [ ] Update your provider's addClub/updateClub methods if needed
- [ ] Integrate ClubFormDialog into your main clubs management screen
- [ ] Test form validation with edge cases
- [ ] Update database schema if migrating from old club type format
- [ ] Test category detection with your existing club data
- [ ] Add UI button/fab to show the form
- [ ] Test on multiple device sizes (responsive layout)
