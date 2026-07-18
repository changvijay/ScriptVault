# ScriptVault

An offline-first mobile app for script and note management with goal tracking and progress monitoring.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo dev server
- Scan QR code with Expo Go app to test on a real device

## Stack

- Expo SDK 54, React Native 0.81, Expo Router (file-based routing)
- AsyncStorage — all data stored locally, no backend
- expo-av — voice note recording and playback
- expo-file-system — local file storage for audio/video
- expo-image-picker — video note attachment from library
- react-native-svg — circular progress ring
- @expo-google-fonts/inter — typography

## Where things live

- `app/(tabs)/index.tsx` — Dashboard: stats ring, goals, deadlines, recent scripts
- `app/(tabs)/scripts.tsx` — Scripts list with search, filters, categories
- `app/(tabs)/goals.tsx` — Goal management with progress bars
- `app/(tabs)/settings.tsx` — Category management
- `app/script/[id].tsx` — Script editor: all fields + voice/video notes (id='new' to create)
- `context/DataContext.tsx` — All data operations (scripts, categories, goals) via AsyncStorage
- `types/index.ts` — TypeScript interfaces
- `constants/colors.ts` — Design tokens: amber + navy palette with full dark mode

## Features

1. Script CRUD with title, notes, reference, status, categories, deadline, voice/video notes
2. Voice notes using expo-av (microphone recording)
3. Video notes via expo-image-picker (pick from library)
4. Unlimited categories with custom colors
5. Deadlines with overdue highlighting
6. Search by title/notes/reference, filter by status and category
7. Script status: Not Started / In Progress / Completed
8. Goal system with progress tracking and templates
9. Dashboard with progress ring, stats, upcoming deadlines, recent scripts
10. Full dark mode support (adapts to device system setting)

## User preferences

_Populate as you build._
