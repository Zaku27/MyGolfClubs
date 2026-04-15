# ⛳ My Golf Room - Golf Club Data Management App

> Status (2026-03): Active development is Web-only (React + TypeScript). Flutter development is paused and no new Flutter features are planned for now.

A simple, clean web application for managing your golf club collection. Track specifications for up to 14 standard clubs or add custom clubs beyond the standard set.

## Features

✅ **View & Manage Clubs** - Display all clubs in your bag with detailed specifications  
✅ **Edit Club Data** - Modify any club parameter (length, weight, angles, shaft type, etc.)  
✅ **Add Custom Clubs** - Add new clubs beyond the standard 14  
✅ **Delete Clubs** - Remove clubs from your collection  
✅ **Local Data Storage** - Data persists in browser using IndexedDB (Dexie)  
✅ **Responsive Design** - Works on desktop, tablet, and mobile devices  
✅ **Clean UI** - Intuitive card-based interface  

## Default Clubs

The app comes with 15 pre-configured standard clubs:

1. Driver | 2. 3-Wood | 3. 5-Wood | 4. Hybrid (4H) | 5. 3-Iron  
6. 4-Iron | 7. 5-Iron | 8. 6-Iron | 9. 7-Iron | 10. 8-Iron  
11. 9-Iron | 12. PW | 13. GW | 14. SW | 15. Putter  

## Club Data Fields

Each club stores the following specifications:

| Field | Type | Example |
|-------|------|---------|
| Club Name | Text | "Driver" |
| Length | Number | 45.5 (inches) |
| Weight | Number | 200 (grams) |
| Swing Weight / Balance | Text | "D2" |
| Lie Angle | Number | 56 (degrees) |
| Loft Angle | Number | 10.5 (degrees) |
| Shaft Type / Flex | Text | "Graphite Regular" |
| Notes | Text | Optional custom notes |

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand
- **Database**: Dexie (IndexedDB wrapper)
- **Styling**: CSS3

## Project Structure

```
src/
├── App.tsx                    # Main application component
├── App.css                    # Global styles
├── types/
│   └── golf.ts               # TypeScript interfaces & default clubs
├── db/
│   ├── database.ts           # Dexie database configuration
│   └── clubService.ts        # CRUD operations
├── store/
│   └── clubStore.ts          # Zustand state management
└── components/
    ├── ClubList.tsx          # Club list view
    ├── ClubCard.tsx          # Individual club card
    ├── ClubForm.tsx          # Add/edit form
    ├── ClubCard.css
    ├── ClubForm.css
    └── ClubList.css
```

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

The app will be available at `http://localhost:5174` (or next available port).

## Usage

1. **View Clubs** - Launch the app to see all clubs in your bag
2. **Edit Club** - Click "Edit" on any club card to modify its specifications
3. **Add Club** - Click "+ Add New Club" to add a new club to your collection
4. **Delete Club** - Click "Delete" on a club card to remove it (with confirmation)
5. **Save Data** - All changes are automatically saved to your browser's local storage

## Data Persistence

All club data is stored locally in your browser using **IndexedDB** through the Dexie library. 

- Data persists across browser sessions
- Clear browser data/cache to reset the app to defaults
- No server or account required

## Customization

### Add/Modify Default Clubs

Edit `src/types/golf.ts` and update the `DEFAULT_CLUBS` array. The app will automatically initialize these clubs on first load.

### Styling

- Global styles: `src/App.css`
- Component styles: Located next to each component (e.g., `src/components/ClubCard.css`)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

- ☐ Export/import club data (JSON, CSV)
- ☐ Multiple bag profiles
- ☐ Handicap tracking
- ☐ Cloud sync
- ☐ Mobile app support (on hold)

## License

Open source - feel free to use and modify for personal use.

---

**Happy golfing! ⛳**
