**Summary**
Add a per-habit notification system to the Habit Tracker so each habit can have scheduled reminders (days, times, frequency) and a selectable sound from a built-in library. Desktop-only (primary target: Arch Linux / Electron). Include closed-app support via a background helper installed as a systemd user service.

**Description**
Add a modular, configurable reminder system for habits:

- Per-habit config for enabled/disabled, days-of-week, specific times or times-per-day, optional snooze, and selectable notification sound (previewable).
- Reminders should fire when the app is running and also when the app is closed by implementing a small background helper registered as a systemd user service (auto-enabled on first run).
