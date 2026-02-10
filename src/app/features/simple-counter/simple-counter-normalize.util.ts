import {
  SimpleCounterCfgFields,
  SimpleCounterCopy,
  SimpleCounterType,
} from './simple-counter.model';
import { EMPTY_SIMPLE_COUNTER } from './simple-counter.const';

export const normalizeSimpleCounterSettings = (
  settings: SimpleCounterCfgFields,
): Partial<SimpleCounterCopy> => {
  const normalized: Partial<SimpleCounterCopy> = {
    title: settings.title,
    isEnabled: settings.isEnabled,
    isHideButton: settings.isHideButton,
    icon: settings.icon,
    type: settings.type,
    isTrackStreaks: settings.isTrackStreaks,
    streakMinValue: settings.streakMinValue,
    streakMode: settings.streakMode || 'specific-days',
    streakWeekDays: settings.streakWeekDays
      ? { ...settings.streakWeekDays }
      : settings.isTrackStreaks
        ? { ...EMPTY_SIMPLE_COUNTER.streakWeekDays }
        : undefined,
    streakWeeklyFrequency: settings.streakWeeklyFrequency,
    countdownDuration: settings.countdownDuration ?? undefined,
    timeOfDay: settings.timeOfDay || 'anytime',
    accentColor: settings.accentColor || 'blue',
    notificationEnabled: settings.notificationEnabled ?? false,
    notificationDays: settings.notificationDays
      ? { ...settings.notificationDays }
      : undefined,
    // default to [] (preserve empty array)
    notificationTimes: settings.notificationTimes ? [...settings.notificationTimes] : [],
    notificationSound: settings.notificationSound ?? undefined,
  };

  if (!normalized.isTrackStreaks) {
    normalized.streakWeekDays = undefined;
    normalized.streakMinValue = undefined;
    normalized.streakMode = undefined;
    normalized.streakWeeklyFrequency = undefined;
  }

  if (
    normalized.type !== SimpleCounterType.RepeatedCountdownReminder &&
    normalized.countdownDuration
  ) {
    normalized.countdownDuration = undefined;
  }

  if (!normalized.notificationEnabled) {
    normalized.notificationDays = undefined;
    // keep an empty array instead of undefined so it persists as empty
    normalized.notificationTimes = [];
    normalized.notificationSound = undefined;
  }

  return normalized;
};
