# TaskVault

Offline-first personal operational memory system for Windows. Built with Electron, React, TypeScript, and SQLite.

## Features

- **Context Recovery**: Tasks reopened after 30+ days are instantly understandable via pinned summaries and timeline
- **Idle Age Engine**: Visual indicators show task freshness (green <3 days, yellow 3-7 days, red >7 days)
- **Smart Sorting**: Priority DESC, then Idle Age DESC - neglected HIGH priority tasks always float to top
- **Timeline System**: Chat-style feed with notes, images, files, and status changes
- **Clipboard Integration**: Ctrl+V to paste images directly into tasks
- **Drag & Drop**: Attach files by dragging them onto the timeline
- **Gamification**: XP system with levels, streaks, and Necromancer bonus for reviving neglected tasks
- **Auto-Cleanup**: Archived tasks auto-delete after 30 days

## Tech Stack

- **Runtime**: Electron + Vite
- **Language**: TypeScript (strict mode)
- **UI**: React + Tailwind CSS
- **Database**: better-sqlite3 + drizzle-orm
- **Icons**: lucide-react
- **Platform**: Windows 10/11

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Windows 10 or 11
- Git
- **Visual Studio 2022 Community with "Desktop development with C++" workload** (required for `better-sqlite3`)

> **⚠️ Important**: `better-sqlite3` requires native compilation. If you encounter build errors, see [SETUP_WINDOWS.md](./SETUP_WINDOWS.md) for detailed setup instructions.

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd MyTaskTracker
```

2. Install dependencies:
```bash
npm install
```

3. Build the Electron main process:
```bash
npm run build
```

Note: The database will be created automatically on first run at:
`%APPDATA%/taskvault/taskvault.db`

### Development

Run in development mode:
```bash
npm run electron:dev
```

This will:
- Start Vite dev server on http://localhost:5173
- Launch Electron with hot reload
- Open DevTools automatically

### Production Build

Build for Windows:
```bash
npm run electron:build
```

The installer will be created in the `dist` directory.

## Architecture

### Security

- `contextIsolation: true`
- `nodeIntegration: false`
- All file system and database access via typed IPC APIs

### Database Schema

- **tasks**: Core task data with status, priority, timestamps
- **timeline_entries**: Notes, images, files, status changes, gamification events
- **gamification**: User stats (XP, level, streak)

### IPC API

All renderer ↔ main communication goes through typed IPC handlers:
- `getTasks()` - Get all tasks with idle age
- `getTaskById(id)` - Get task with full timeline
- `createTask(payload)` - Create new task
- `updateTask(payload)` - Update task metadata
- `addTimelineEntry(payload)` - Add note/status/file entry
- `attachFile(taskId, filePath)` - Attach file via drag-drop
- `pasteImage(taskId, buffer)` - Paste image from clipboard
- `searchTasks(query)` - Search tasks and timeline notes
- `getGamification()` - Get user stats
- `checkNecromancerBonus(taskId)` - Check and grant necromancer bonus

## Usage

### Creating Tasks

1. Click "New Task" button
2. Enter title and select priority
3. Press Enter or click "Create"

### Adding Context

- **Notes**: Type in the note field and press Ctrl+Enter
- **Images**: Press Ctrl+V while viewing a task to paste from clipboard
- **Files**: Drag and drop files onto the timeline area
- **Pinned Summary**: Click "Edit" on the pinned summary to add quick context

### Task States

- **OPEN**: Active task
- **DONE**: Completed task
- **ARCHIVED**: Archived task (auto-deletes after 30 days)

### Idle Age

Tasks show visual indicators based on last touch:
- **Green**: <3 days (Fresh)
- **Yellow**: 3-7 days (Stale)
- **Red**: >7 days (Neglected) + ghost icon

### Gamification

- Create task: +5 XP
- Add note/file: +2 XP
- Complete task: +20 XP
- Necromancer bonus: +50 XP (for reviving tasks idle >10 days)

Level = floor(XP / 100) + 1

## Data Location

- **Database**: `%APPDATA%/taskvault/taskvault.db`
- **Attachments**: `%APPDATA%/taskvault/attachments/{taskId}/`

All paths are relative and portable - the app can be moved without breaking references.

## License

MIT

