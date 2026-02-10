import { SimpleCounter, SimpleCounterType } from './simple-counter.model';

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

export const EMPTY_SIMPLE_COUNTER: SimpleCounter = {
  id: '',

  // basic cfg
  title: '',
  isEnabled: false,
  icon: null,
  type: SimpleCounterType.ClickCounter,

  // dynamic
  countOnDay: {},
  isOn: false,
  isTrackStreaks: true,
  streakMinValue: 1,
  streakMode: 'specific-days',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  streakWeekDays: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false },

  // UI customization
  timeOfDay: 'anytime',
  accentColor: 'blue',

  // notification
  notificationEnabled: false,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  notificationDays: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false },
  notificationTimes: [],
  notificationSound: DEFAULT_NOTIFICATION_SOUND,
};

export const DEFAULT_SIMPLE_COUNTERS: SimpleCounter[] = [
  {
    ...EMPTY_SIMPLE_COUNTER,
    id: 'STANDING_DESK_ID',
    title: 'Standing Desk Timer',
    type: SimpleCounterType.StopWatch,
    icon: 'directions_walk',
    isTrackStreaks: true,
    streakMinValue: 30 * 60 * 1000,
    timeOfDay: 'morning',
    accentColor: 'green',
  },
  {
    ...EMPTY_SIMPLE_COUNTER,
    id: 'COFFEE_COUNTER',
    title: 'Coffee Counter',
    type: SimpleCounterType.ClickCounter,
    icon: 'free_breakfast',
    isTrackStreaks: false,
    streakMinValue: 2,
    timeOfDay: 'morning',
    accentColor: 'orange',
  },
  {
    ...EMPTY_SIMPLE_COUNTER,
    id: 'STRETCHING_COUNTER',
    title: 'Stretching Counter',
    type: SimpleCounterType.RepeatedCountdownReminder,
    icon: 'fitness_center',
    countdownDuration: 30 * 60 * 1000,
    isTrackStreaks: true,
    streakMinValue: 8,
    timeOfDay: 'anytime',
    accentColor: 'purple',
  },
];
