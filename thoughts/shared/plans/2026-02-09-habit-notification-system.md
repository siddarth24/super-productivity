# Per-Habit Notification System Implementation Plan

## Overview

Add a modular, configurable reminder system for habits (SimpleCounters) that fires scheduled notifications when the app is running AND when closed via a systemd user service. Desktop-only (Electron, primary target: Arch Linux).

## Current State Analysis

- **Habit Tracker** is implemented as `SimpleCounter` in `/src/app/features/simple-counter/`
- SimpleCounter model has `streakWeekDays` pattern for day selection that can be reused
- Existing sound system via `playSound()` with 11 available sounds
- `ReminderService` uses Web Worker for task scheduling - pattern to follow
- `NotifyService` handles desktop notifications
- No systemd integration exists - needs to be built from scratch

### Key Discoveries

- `simple-counter.model.ts:21-44`: `SimpleCounterCfgFields` interface to extend
- `simple-counter-form.const.ts:165-188`: Weekday multi-checkbox pattern already exists
- `play-sound.ts:12-44`: Sound playback via Web Audio API
- `reminder.service.ts:52-63`: Web Worker creation pattern for timers
- `focus-mode.effects.ts:50-51, 1127-1144`: Sound + notification pattern
- `ipc-events.const.ts`: IPC event definitions for Electron communication

## Desired End State

After implementation:

1. Each habit can have notifications enabled with specific times (e.g., 9:00 AM, 2:00 PM)
2. Notifications fire on selected days of the week
3. Notifications play a selectable sound from a built-in library (with preview)
4. When app is running: in-app notification via NotifyService + sound
5. When app is closed: systemd helper fires desktop notifications
6. Clicking a notification opens the app and navigates to the specific habit
7. Global snooze duration configurable in settings

### Verification

- Unit tests pass for new service/effects
- E2E test verifies notification settings persist and notifications fire
- Manual verification: close app, receive notification at scheduled time, click opens app to habit

## What We're NOT Doing

- Mobile/Android/iOS notifications (desktop-only)
- "Times-per-day" mode (only specific times)
- Per-habit snooze duration (using global default)
- Integration with other notification systems (only systemd on Linux)

## Implementation Approach

Follow existing patterns:

- Extend model like `streakWeekDays` was added
- Create effects class following `focus-mode.effects.ts` pattern
- Use Web Worker like `reminder.service.ts` for scheduling
- Add IPC events like other Electron features

---

## Phase 1: Model & Constant Updates

### Overview

Extend the SimpleCounter model with notification configuration fields and add constants for available sounds.

### Changes Required

#### 1. SimpleCounter Model Extension

**File**: `src/app/features/simple-counter/simple-counter.model.ts`
**Changes**: Add notification config fields to `SimpleCounterCfgFields`

```typescript
// Add after line 43 (before closing brace of SimpleCounterCfgFields)

  // Notification configuration
  notificationEnabled?: boolean;
  notificationDays?: { [key: number]: boolean }; // 0=Sun, 1=Mon, etc.
  notificationTimes?: string[]; // Array of "HH:MM" strings
  notificationSound?: string; // Sound file name from NOTIFICATION_SOUNDS
```

#### 2. Sound Constants

**File**: `src/app/features/simple-counter/simple-counter.const.ts`
**Changes**: Add notification sound options

```typescript
// Add after existing constants

export const NOTIFICATION_SOUNDS = [
  { value: 'copper-bell-ding.mp3', label: 'Copper Bell' },
  { value: 'ding-small-bell.mp3', label: 'Small Bell' },
  { value: 'positive.ogg', label: 'Positive' },
  { value: 'done1.mp3', label: 'Done 1' },
  { value: 'done2.mp3', label: 'Done 2' },
  { value: 'done3.mp3', label: 'Done 3' },
  { value: 'done4.mp3', label: 'Done 4' },
  { value: 'done5.mp3', label: 'Done 5' },
  { value: 'done6.mp3', label: 'Done 6' },
  { value: 'done7.mp3', label: 'Done 7' },
] as const;

export const DEFAULT_NOTIFICATION_SOUND = 'ding-small-bell.mp3';
```

#### 3. Empty Simple Counter Defaults

**File**: `src/app/features/simple-counter/simple-counter.const.ts`
**Changes**: Add defaults to `EMPTY_SIMPLE_COUNTER`

```typescript
// Add to EMPTY_SIMPLE_COUNTER object

  notificationEnabled: false,
  notificationDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false },
  notificationTimes: [],
  notificationSound: DEFAULT_NOTIFICATION_SOUND,
```

#### 4. Translation Keys

**File**: `src/assets/i18n/en.json`
**Changes**: Add translation keys under `F.SIMPLE_COUNTER.FORM`

```json
"L_NOTIFICATION_ENABLED": "Enable notifications",
"L_NOTIFICATION_DAYS": "Notification days",
"L_NOTIFICATION_TIMES": "Notification times",
"L_NOTIFICATION_SOUND": "Notification sound",
"L_ADD_TIME": "Add time",
"L_PREVIEW_SOUND": "Preview",
"L_NOTIFICATION_SECTION": "Notifications"
```

### Success Criteria

#### Automated Verification

- [x] TypeScript compiles: `npm run checkFile src/app/features/simple-counter/simple-counter.model.ts`
- [x] TypeScript compiles: `npm run checkFile src/app/features/simple-counter/simple-counter.const.ts`

#### Manual Verification

- [ ] None needed for this phase

---

## Phase 2: Form Configuration

### Overview

Add notification configuration fields to the SimpleCounter settings form.

### Changes Required

#### 1. Form Field Configuration

**File**: `src/app/features/config/form-cfgs/simple-counter-form.const.ts`
**Changes**: Add notification form fields after `isHideButton` checkbox (around line 248)

```typescript
// Add before the closing bracket of fieldGroup array (after isHideButton)

          // === NOTIFICATION SECTION ===
          {
            type: 'checkbox',
            key: 'notificationEnabled',
            templateOptions: {
              label: T.F.SIMPLE_COUNTER.FORM.L_NOTIFICATION_ENABLED,
            },
          },
          {
            key: 'notificationDays',
            type: 'multicheckbox',
            resetOnHide: false,
            expressions: {
              hide: (fCfg: FormlyFieldConfig) => !fCfg.model.notificationEnabled,
            },
            templateOptions: {
              label: T.F.SIMPLE_COUNTER.FORM.L_NOTIFICATION_DAYS,
              options: [
                { label: T.F.TASK_REPEAT.F.MONDAY, value: 1 },
                { label: T.F.TASK_REPEAT.F.TUESDAY, value: 2 },
                { label: T.F.TASK_REPEAT.F.WEDNESDAY, value: 3 },
                { label: T.F.TASK_REPEAT.F.THURSDAY, value: 4 },
                { label: T.F.TASK_REPEAT.F.FRIDAY, value: 5 },
                { label: T.F.TASK_REPEAT.F.SATURDAY, value: 6 },
                { label: T.F.TASK_REPEAT.F.SUNDAY, value: 0 },
              ],
            },
          },
          {
            key: 'notificationTimes',
            type: 'repeat',
            className: 'notification-times',
            resetOnHide: false,
            expressions: {
              hide: (fCfg: FormlyFieldConfig) => !fCfg.model.notificationEnabled,
            },
            templateOptions: {
              addText: T.F.SIMPLE_COUNTER.FORM.L_ADD_TIME,
              getInitialValue: () => '09:00',
            },
            fieldArray: {
              type: 'input',
              templateOptions: {
                type: 'time',
                label: T.F.SIMPLE_COUNTER.FORM.L_NOTIFICATION_TIMES,
              },
            },
          },
          {
            key: 'notificationSound',
            type: 'select',
            resetOnHide: false,
            expressions: {
              hide: (fCfg: FormlyFieldConfig) => !fCfg.model.notificationEnabled,
            },
            templateOptions: {
              label: T.F.SIMPLE_COUNTER.FORM.L_NOTIFICATION_SOUND,
              options: NOTIFICATION_SOUNDS.map(s => ({
                label: s.label,
                value: s.value,
              })),
            },
          },
```

#### 2. Import Constants

**File**: `src/app/features/config/form-cfgs/simple-counter-form.const.ts`
**Changes**: Add import for NOTIFICATION_SOUNDS

```typescript
// Update import to include NOTIFICATION_SOUNDS
import {
  EMPTY_SIMPLE_COUNTER,
  NOTIFICATION_SOUNDS,
} from '../../simple-counter/simple-counter.const';
```

#### 3. Dialog Settings Component Update

**File**: `src/app/features/simple-counter/dialog-simple-counter-edit-settings/dialog-simple-counter-edit-settings.component.ts`
**Changes**: Handle new notification fields in `_extractSettingsModel` and `_normalizeSettings`

In `_extractSettingsModel` (around line 97):

```typescript
      notificationEnabled: counter.notificationEnabled ?? false,
      notificationDays: counter.notificationDays
        ? { ...counter.notificationDays }
        : { ...EMPTY_SIMPLE_COUNTER.notificationDays },
      notificationTimes: counter.notificationTimes
        ? [...counter.notificationTimes]
        : [],
      notificationSound: counter.notificationSound ?? DEFAULT_NOTIFICATION_SOUND,
```

In `_normalizeSettings` (around line 120):

```typescript
      notificationEnabled: settings.notificationEnabled ?? false,
      notificationDays: settings.notificationDays
        ? { ...settings.notificationDays }
        : undefined,
      notificationTimes: settings.notificationTimes
        ? [...settings.notificationTimes]
        : undefined,
      notificationSound: settings.notificationSound ?? undefined,
```

Also add cleanup logic at the end of `_normalizeSettings`:

```typescript
if (!normalized.notificationEnabled) {
  normalized.notificationDays = undefined;
  normalized.notificationTimes = undefined;
  normalized.notificationSound = undefined;
}
```

### Success Criteria

#### Automated Verification

- [x] Lint passes: `npm run checkFile src/app/features/config/form-cfgs/simple-counter-form.const.ts`
- [x] Lint passes: `npm run checkFile src/app/features/simple-counter/dialog-simple-counter-edit-settings/dialog-simple-counter-edit-settings.component.ts`

#### Manual Verification

- [ ] Open a habit's settings dialog
- [ ] Enable notifications checkbox appears
- [ ] Enabling shows days, times, and sound fields
- [ ] Can add/remove notification times
- [ ] Sound selector shows all 10 sounds
- [ ] Settings save and persist correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 3: Notification Service & Effects (In-App)

### Overview

Create the notification service and effects to schedule and fire notifications while the app is running.

### Changes Required

#### 1. Notification Service

**File**: `src/app/features/simple-counter/habit-notification.service.ts` (NEW)

```typescript
import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { NotifyService } from '../../core/notify/notify.service';
import { playSound } from '../../util/play-sound';
import { GlobalConfigService } from '../config/global-config.service';
import { SimpleCounter } from './simple-counter.model';
import { T } from '../../t.const';
import { IS_ELECTRON } from '../../app.constants';
import { getWorklogStr } from '../../util/get-work-log-str';

interface ScheduledNotification {
  counterId: string;
  counterTitle: string;
  timeoutId: ReturnType<typeof setTimeout>;
  scheduledTime: string; // HH:MM
}

@Injectable({
  providedIn: 'root',
})
export class HabitNotificationService implements OnDestroy {
  private readonly _notifyService = inject(NotifyService);
  private readonly _globalConfigService = inject(GlobalConfigService);
  private readonly _store = inject(Store);

  private _scheduled = signal<ScheduledNotification[]>([]);
  private _dayCheckInterval: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    this._clearAllScheduled();
    if (this._dayCheckInterval) {
      clearInterval(this._dayCheckInterval);
    }
  }

  /**
   * Updates scheduled notifications based on counter configs.
   * Called when counters change or at start of new day.
   */
  updateSchedule(counters: SimpleCounter[]): void {
    this._clearAllScheduled();

    const today = new Date().getDay(); // 0=Sun, 1=Mon, etc.
    const now = new Date();
    const currentTimeStr = this._getTimeString(now);

    for (const counter of counters) {
      if (!counter.notificationEnabled) continue;
      if (!counter.notificationDays?.[today]) continue;
      if (!counter.notificationTimes?.length) continue;

      for (const timeStr of counter.notificationTimes) {
        // Skip times that have already passed today
        if (timeStr <= currentTimeStr) continue;

        const ms = this._getMillisecondsUntil(timeStr);
        if (ms <= 0) continue;

        const timeoutId = setTimeout(() => {
          this._fireNotification(counter);
        }, ms);

        this._scheduled.update((arr) => [
          ...arr,
          {
            counterId: counter.id,
            counterTitle: counter.title,
            timeoutId,
            scheduledTime: timeStr,
          },
        ]);
      }
    }

    // Sync to Electron for systemd helper
    if (IS_ELECTRON) {
      this._syncToElectron(counters);
    }
  }

  private _fireNotification(counter: SimpleCounter): void {
    const volume = this._globalConfigService.sound()?.volume ?? 100;

    // Play sound
    if (counter.notificationSound && volume > 0) {
      playSound(counter.notificationSound, volume);
    }

    // Show desktop notification
    this._notifyService.notifyDesktop({
      title: T.F.SIMPLE_COUNTER.NOTIFICATION_TITLE,
      body: counter.title,
      translateParams: { title: counter.title },
    });

    // Remove from scheduled list
    this._scheduled.update((arr) =>
      arr.filter(
        (s) =>
          !(
            s.counterId === counter.id &&
            s.scheduledTime === this._getTimeString(new Date())
          ),
      ),
    );
  }

  private _clearAllScheduled(): void {
    for (const scheduled of this._scheduled()) {
      clearTimeout(scheduled.timeoutId);
    }
    this._scheduled.set([]);
  }

  private _getTimeString(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private _getMillisecondsUntil(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    return target.getTime() - Date.now();
  }

  private _syncToElectron(counters: SimpleCounter[]): void {
    if (!IS_ELECTRON) return;

    const enabledCounters = counters.filter(
      (c) =>
        c.notificationEnabled &&
        c.notificationTimes?.length &&
        Object.values(c.notificationDays || {}).some(Boolean),
    );

    const config = enabledCounters.map((c) => ({
      id: c.id,
      title: c.title,
      days: c.notificationDays,
      times: c.notificationTimes,
      sound: c.notificationSound,
    }));

    window.ea.syncHabitNotificationConfig(config);
  }
}
```

#### 2. Notification Effects

**File**: `src/app/features/simple-counter/store/habit-notification.effects.ts` (NEW)

```typescript
import { inject, Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngrx/effects';
import { LOCAL_ACTIONS } from '../../../util/local-actions.token';
import { Store } from '@ngrx/store';
import { tap, withLatestFrom, debounceTime, startWith } from 'rxjs/operators';
import { interval } from 'rxjs';
import { selectAllSimpleCounters } from './simple-counter.reducer';
import { HabitNotificationService } from '../habit-notification.service';
import {
  addSimpleCounter,
  deleteSimpleCounter,
  updateSimpleCounter,
  upsertSimpleCounter,
} from './simple-counter.actions';

@Injectable()
export class HabitNotificationEffects {
  private readonly _actions$ = inject(LOCAL_ACTIONS);
  private readonly _store = inject(Store);
  private readonly _habitNotificationService = inject(HabitNotificationService);

  /**
   * Update notification schedule when counters change.
   * Debounced to batch rapid changes.
   */
  updateScheduleOnCounterChange$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(
          addSimpleCounter,
          updateSimpleCounter,
          upsertSimpleCounter,
          deleteSimpleCounter,
        ),
        debounceTime(500),
        withLatestFrom(this._store.select(selectAllSimpleCounters)),
        tap(([_, counters]) => {
          this._habitNotificationService.updateSchedule(counters);
        }),
      ),
    { dispatch: false },
  );

  /**
   * Re-schedule at midnight for the new day.
   * Also handles initial load.
   */
  dailyReschedule$ = createEffect(
    () =>
      interval(60000).pipe(
        // Check every minute
        startWith(0),
        withLatestFrom(this._store.select(selectAllSimpleCounters)),
        tap(([_, counters]) => {
          const now = new Date();
          // Re-schedule at midnight (00:00) or on initial load
          if (now.getHours() === 0 && now.getMinutes() === 0) {
            this._habitNotificationService.updateSchedule(counters);
          }
        }),
      ),
    { dispatch: false },
  );

  /**
   * Initial schedule on app start.
   */
  constructor() {
    // Schedule on next tick to ensure store is hydrated
    setTimeout(() => {
      this._store.select(selectAllSimpleCounters).subscribe((counters) => {
        this._habitNotificationService.updateSchedule(counters);
      });
    }, 1000);
  }
}
```

#### 3. Register Effects

**File**: `src/app/root-store/feature-stores.module.ts`
**Changes**: Add HabitNotificationEffects to the effects array

```typescript
// Add import
import { HabitNotificationEffects } from '../features/simple-counter/store/habit-notification.effects';

// Add to EffectsModule.forFeature array
EffectsModule.forFeature([
  // ... existing effects
  HabitNotificationEffects,
]),
```

#### 4. Translation Key for Notification

**File**: `src/assets/i18n/en.json`
**Changes**: Add notification title translation

```json
"NOTIFICATION_TITLE": "Habit Reminder: {{title}}"
```

### Success Criteria

#### Automated Verification

- [x] Lint passes: `npm run checkFile src/app/features/simple-counter/habit-notification.service.ts`
- [x] Lint passes: `npm run checkFile src/app/features/simple-counter/habit-notification.service.ts`
- [x] Lint passes: `npm run checkFile src/app/features/simple-counter/store/habit-notification.effects.ts`
- [x] Unit tests pass: `npm run test:file src/app/features/simple-counter/habit-notification.service.spec.ts`

#### Manual Verification

- [ ] Enable notifications for a habit with a time 1-2 minutes from now
- [ ] Notification fires at the scheduled time
- [ ] Sound plays with the selected sound
- [ ] Desktop notification appears

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 4: Electron IPC Integration

### Overview

Add IPC events and handlers for syncing notification config to Electron main process and handling notification clicks.

### Changes Required

#### 1. IPC Event Definitions

**File**: `electron/shared-with-frontend/ipc-events.const.ts`
**Changes**: Add new IPC events

```typescript
// Add to IPC enum (around line 90, before closing brace)

  // Habit Notifications
  HABIT_NOTIFICATION_SYNC_CONFIG = 'HABIT_NOTIFICATION_SYNC_CONFIG',
  HABIT_NOTIFICATION_FOCUS = 'HABIT_NOTIFICATION_FOCUS',
  HABIT_NOTIFICATION_CLICKED = 'HABIT_NOTIFICATION_CLICKED',
```

#### 2. Window EA Type Definitions

**File**: `src/app/core/window-ea.d.ts`
**Changes**: Add type for the new IPC method

```typescript
// Add to ElectronAPI interface

  syncHabitNotificationConfig: (config: Array<{
    id: string;
    title: string;
    days: { [key: number]: boolean } | undefined;
    times: string[] | undefined;
    sound: string | undefined;
  }>) => void;
```

#### 3. Preload Script

**File**: `electron/preload.ts`
**Changes**: Expose new IPC method

```typescript
// Add to the contextBridge.exposeInMainWorld object

  syncHabitNotificationConfig: (config: any[]) => {
    ipcRenderer.send(IPC.HABIT_NOTIFICATION_SYNC_CONFIG, config);
  },
```

#### 4. IPC Handler

**File**: `electron/ipc-handlers/habit-notifications.ts` (NEW)

```typescript
import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC } from '../shared-with-frontend/ipc-events.const';
import { getMainWindow } from '../main-window';

const CONFIG_FILE_NAME = 'habit-notification-config.json';

function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
}

export function initHabitNotificationHandlers(): void {
  ipcMain.on(IPC.HABIT_NOTIFICATION_SYNC_CONFIG, (_event, config: any[]) => {
    try {
      const configPath = getConfigPath();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('[Habit Notifications] Config synced to:', configPath);
    } catch (err) {
      console.error('[Habit Notifications] Failed to sync config:', err);
    }
  });

  ipcMain.on(IPC.HABIT_NOTIFICATION_CLICKED, (_event, counterId: string) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      // Send to renderer to navigate to the habit
      mainWindow.webContents.send(IPC.HABIT_NOTIFICATION_FOCUS, counterId);
    }
  });
}
```

#### 5. Register Handler in Main

**File**: `electron/start-app.ts`
**Changes**: Initialize habit notification handlers

```typescript
// Add import at top
import { initHabitNotificationHandlers } from './ipc-handlers/habit-notifications';

// Add in the initialization section (around where other handlers are initialized)
initHabitNotificationHandlers();
```

#### 6. Handle Notification Click in Renderer

**File**: `src/app/features/simple-counter/simple-counter.service.ts`
**Changes**: Listen for notification click and navigate

```typescript
// Add to constructor or init method

if (IS_ELECTRON) {
  window.ea.on(IPC.HABIT_NOTIFICATION_FOCUS, (counterId: string) => {
    // Navigate to habits page and scroll to/highlight the specific counter
    this._router.navigate(['/habits']);
    // Optionally: open the habit's edit dialog
    setTimeout(() => {
      const counter = this.getById(counterId);
      if (counter) {
        this.openEditDialog(counter);
      }
    }, 100);
  });
}
```

### Success Criteria

#### Automated Verification

- [x] TypeScript compiles: `npm run checkFile electron/shared-with-frontend/ipc-events.const.ts`
- [x] TypeScript compiles: `npm run checkFile electron/preload.ts`
- [x] TypeScript compiles: `npm run checkFile electron/ipc-handlers/habit-notifications.ts`

#### Manual Verification

- [ ] Run app in Electron mode
- [ ] Configure a habit with notifications
- [ ] Check that config file is written to userData folder
- [ ] Verify config file contains correct data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Phase 5: systemd Background Helper

### Overview

Create a standalone Node.js process that runs as a systemd user service and fires notifications when the main app is closed.

### Changes Required

#### 1. Helper Application

**File**: `electron/habit-notification-helper/index.ts` (NEW)

```typescript
#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as schedule from 'node-schedule';
import notifier from 'node-notifier';

const APP_NAME = 'Super Productivity';
const CONFIG_FILE_NAME = 'habit-notification-config.json';

interface HabitConfig {
  id: string;
  title: string;
  days: { [key: number]: boolean };
  times: string[];
  sound?: string;
}

function getConfigPath(): string {
  // Match Electron's userData path
  const platform = process.platform;
  if (platform === 'linux') {
    return path.join(os.homedir(), '.config', 'superProductivity', CONFIG_FILE_NAME);
  } else if (platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'superProductivity',
      CONFIG_FILE_NAME,
    );
  } else {
    return path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'superProductivity',
      CONFIG_FILE_NAME,
    );
  }
}

function readConfig(): HabitConfig[] {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return [];
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[Habit Helper] Failed to read config:', err);
    return [];
  }
}

function isMainAppRunning(): boolean {
  // Check if main app is running by looking for lock file or process
  const lockPath = path.join(path.dirname(getConfigPath()), 'app.lock');
  return fs.existsSync(lockPath);
}

function scheduleNotifications(configs: HabitConfig[]): void {
  // Cancel all existing jobs
  for (const jobName of Object.keys(schedule.scheduledJobs)) {
    schedule.cancelJob(jobName);
  }

  for (const config of configs) {
    if (!config.times?.length) continue;

    for (const timeStr of config.times) {
      const [hour, minute] = timeStr.split(':').map(Number);

      // Build cron-like schedule: minute hour * * dayOfWeek
      const enabledDays = Object.entries(config.days || {})
        .filter(([_, enabled]) => enabled)
        .map(([day]) => parseInt(day));

      if (enabledDays.length === 0) continue;

      const jobName = `${config.id}-${timeStr}`;

      schedule.scheduleJob(jobName, { hour, minute, dayOfWeek: enabledDays }, () => {
        // Only fire if main app is NOT running
        if (!isMainAppRunning()) {
          notifier.notify({
            title: APP_NAME,
            message: `Habit Reminder: ${config.title}`,
            icon: path.join(__dirname, 'icon.png'),
            wait: true,
          });

          notifier.on('click', () => {
            // Launch app with deep link to the habit
            const { exec } = require('child_process');
            exec(`superproductivity://habit/${config.id}`);
          });
        }
      });
    }
  }

  console.log(
    `[Habit Helper] Scheduled ${Object.keys(schedule.scheduledJobs).length} notification jobs`,
  );
}

function watchConfig(): void {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Watch for config changes
  fs.watch(configDir, (eventType, filename) => {
    if (filename === CONFIG_FILE_NAME) {
      console.log('[Habit Helper] Config changed, rescheduling...');
      const configs = readConfig();
      scheduleNotifications(configs);
    }
  });
}

// Main
console.log('[Habit Helper] Starting...');
const configs = readConfig();
scheduleNotifications(configs);
watchConfig();

// Keep process alive
setInterval(() => {}, 1 << 30);
```

#### 2. Package.json for Helper

**File**: `electron/habit-notification-helper/package.json` (NEW)

```json
{
  "name": "sp-habit-notification-helper",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "dependencies": {
    "node-notifier": "^10.0.1",
    "node-schedule": "^2.1.1"
  }
}
```

#### 3. systemd Service File

**File**: `electron/habit-notification-helper/sp-habit-helper.service` (NEW)

```ini
[Unit]
Description=Super Productivity Habit Notification Helper
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/node %h/.config/superProductivity/habit-notification-helper/index.js
Restart=on-failure
RestartSec=10
Environment=DISPLAY=:0
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/%U/bus

[Install]
WantedBy=default.target
```

#### 4. Auto-Installation Logic

**File**: `electron/habit-notification-helper/installer.ts` (NEW)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { app } from 'electron';

const SERVICE_NAME = 'sp-habit-helper.service';
const HELPER_DIR_NAME = 'habit-notification-helper';

export function installSystemdService(): void {
  if (process.platform !== 'linux') {
    console.log('[Habit Helper Installer] Not Linux, skipping systemd install');
    return;
  }

  try {
    const userConfigDir = path.join(os.homedir(), '.config', 'systemd', 'user');
    const servicePath = path.join(userConfigDir, SERVICE_NAME);

    // Check if already installed
    if (fs.existsSync(servicePath)) {
      console.log('[Habit Helper Installer] Service already installed');
      return;
    }

    // Create directories
    fs.mkdirSync(userConfigDir, { recursive: true });

    const helperTargetDir = path.join(app.getPath('userData'), HELPER_DIR_NAME);
    fs.mkdirSync(helperTargetDir, { recursive: true });

    // Copy helper files
    const helperSourceDir = path.join(__dirname, HELPER_DIR_NAME);
    const filesToCopy = ['index.js', 'package.json'];
    for (const file of filesToCopy) {
      fs.copyFileSync(path.join(helperSourceDir, file), path.join(helperTargetDir, file));
    }

    // Install npm dependencies
    execSync('npm install --production', { cwd: helperTargetDir });

    // Generate service file with correct paths
    const serviceContent = `[Unit]
Description=Super Productivity Habit Notification Helper
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/node ${helperTargetDir}/index.js
Restart=on-failure
RestartSec=10
Environment=DISPLAY=:0
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${process.getuid()}/bus

[Install]
WantedBy=default.target
`;

    fs.writeFileSync(servicePath, serviceContent);

    // Enable and start service
    execSync('systemctl --user daemon-reload');
    execSync(`systemctl --user enable ${SERVICE_NAME}`);
    execSync(`systemctl --user start ${SERVICE_NAME}`);

    console.log('[Habit Helper Installer] Service installed and started');
  } catch (err) {
    console.error('[Habit Helper Installer] Failed to install:', err);
  }
}
```

#### 5. Call Installer on First Run

**File**: `electron/start-app.ts`
**Changes**: Add installer call

```typescript
// Add import
import { installSystemdService } from './habit-notification-helper/installer';

// Add after app is ready (in the initialization section)
installSystemdService();
```

#### 6. Lock File for App Running Detection

**File**: `electron/start-app.ts`
**Changes**: Create/remove lock file

```typescript
// Add at app ready
const lockPath = path.join(app.getPath('userData'), 'app.lock');
fs.writeFileSync(lockPath, process.pid.toString());

// Add at app quit
app.on('quit', () => {
  try {
    fs.unlinkSync(lockPath);
  } catch (e) {
    // Ignore
  }
});
```

### Success Criteria

#### Automated Verification

- [x] TypeScript compiles: `npm run checkFile electron/habit-notification-helper/installer.ts`
- [x] Helper builds without errors

#### Manual Verification

- [ ] Run Electron app once - systemd service should be installed
- [ ] Check with: `systemctl --user status sp-habit-helper.service`
- [ ] Close the app
- [ ] Configure a notification time 1-2 minutes from now
- [ ] Wait for notification to fire while app is closed
- [ ] Click notification - app should open and navigate to the habit

**Implementation Note**: After completing this phase and all automated verification passes, pause here for final manual confirmation.

---

## Phase 6: Global Snooze Setting

### Overview

Add a global snooze duration setting to the global config.

### Changes Required

#### 1. Global Config Model

**File**: `src/app/features/config/global-config.model.ts`
**Changes**: Add snooze duration to SoundConfig or create new section

```typescript
// Add to MiscConfig (around line 24)
  habitNotificationSnoozeDuration?: number; // in milliseconds
```

#### 2. Default Config

**File**: `src/app/features/config/default-global-config.const.ts`
**Changes**: Add default snooze duration

```typescript
// Add to misc section
  habitNotificationSnoozeDuration: 10 * 60 * 1000, // 10 minutes
```

#### 3. Settings Form

**File**: `src/app/features/config/form-cfgs/misc-form.const.ts`
**Changes**: Add snooze duration field

```typescript
{
  key: 'habitNotificationSnoozeDuration',
  type: 'duration',
  templateOptions: {
    label: T.F.CONFIG.MISC.L_HABIT_SNOOZE_DURATION,
    description: T.G.DURATION_DESCRIPTION,
  },
},
```

### Success Criteria

#### Automated Verification

- [x] Lint passes: `npm run checkFile src/app/features/config/global-config.model.ts`
- [x] Lint passes: `npm run checkFile src/app/features/config/default-global-config.const.ts`
- [x] Lint passes: `npm run checkFile src/app/features/config/form-cfgs/misc-settings-form.const.ts`

#### Manual Verification

- [ ] Snooze duration setting appears in Misc settings
- [ ] Value persists correctly

---

## Testing Strategy

### Unit Tests

**File**: `src/app/features/simple-counter/habit-notification.service.spec.ts` (NEW)

- Test `updateSchedule()` correctly schedules notifications
- Test `_getMillisecondsUntil()` calculates time correctly
- Test notifications not scheduled for past times
- Test notifications not scheduled for disabled days

**File**: `src/app/features/simple-counter/store/habit-notification.effects.spec.ts` (NEW)

- Test effects use LOCAL_ACTIONS
- Test schedule updates on counter changes
- Test debouncing works correctly

### E2E Tests

**File**: `e2e/tests/habits/habit-notifications.spec.ts` (NEW)

- Test notification settings UI
- Test settings persistence
- Test sound preview

### Manual Testing Steps

1. Enable notifications for a habit
2. Set time to 1 minute from now
3. Verify notification fires (in-app)
4. Close app, set time, verify systemd notification fires
5. Click notification, verify app opens to correct habit
6. Test snooze functionality

## Performance Considerations

- Debounce config syncs to Electron (already implemented)
- Use efficient timer scheduling via node-schedule
- Only schedule notifications for current day
- Clear old schedules before creating new ones

## Migration Notes

- No data migration needed
- New fields default to undefined/false
- systemd service auto-installs on first run
- Service can be manually disabled via `systemctl --user disable sp-habit-helper.service`

## References

- Original ticket: `ticket-001.md`
- Research document: `thoughts/research.md`
- Existing reminder pattern: `src/app/features/reminder/reminder.service.ts`
- Focus mode sound pattern: `src/app/features/focus-mode/store/focus-mode.effects.ts:50-51`
