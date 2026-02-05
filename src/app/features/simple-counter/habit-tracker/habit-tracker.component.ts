import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  HabitAccentColor,
  HabitTimeOfDay,
  SimpleCounter,
  SimpleCounterType,
} from '../simple-counter.model';
import { SimpleCounterService } from '../simple-counter.service';
import { DateService } from '../../../core/date/date.service';
import { T } from '../../../t.const';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { DialogSimpleCounterEditComponent } from '../dialog-simple-counter-edit/dialog-simple-counter-edit.component';
import { DialogSimpleCounterEditSettingsComponent } from '../dialog-simple-counter-edit-settings/dialog-simple-counter-edit-settings.component';
import { EMPTY_SIMPLE_COUNTER } from '../simple-counter.const';

interface HabitGroup {
  timeOfDay: HabitTimeOfDay;
  label: string;
  icon: string;
  habits: SimpleCounter[];
}

@Component({
  selector: 'habit-tracker',
  standalone: true,
  imports: [CommonModule, TranslateModule, MatButtonModule, MatIconModule],
  templateUrl: './habit-tracker.component.html',
  styleUrl: './habit-tracker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitTrackerComponent {
  simpleCounters = input.required<SimpleCounter[]>();

  private _simpleCounterService = inject(SimpleCounterService);
  private _dateService = inject(DateService);
  private _matDialog = inject(MatDialog);
  private _router = inject(Router);

  T = T;
  SimpleCounterType = SimpleCounterType;

  dayOffset = signal(0);

  private _weekTransitionMs = 520;
  weekTransition = signal<null | {
    from: number;
    to: number;
    dir: 'prev' | 'next';
    animate: boolean;
  }>(null);

  isWeekTransitioning = computed(() => this.weekTransition() !== null);

  days = computed(() => this.daysForOffset(this.dayOffset()));

  daysForOffset(offset: number): string[] {
    const result: string[] = [];
    const today = new Date();
    const daysToShow = 6; // Always show 7 days (0-6)
    for (let i = daysToShow; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i + offset);
      result.push(this._dateService.todayStr(d));
    }
    return result;
  }

  // Group habits by time of day
  habitGroups = computed((): HabitGroup[] => {
    const counters = this.simpleCounters();
    const groups: HabitGroup[] = [
      { timeOfDay: 'morning', label: 'Morning', icon: 'wb_sunny', habits: [] },
      { timeOfDay: 'afternoon', label: 'Afternoon', icon: 'wb_cloudy', habits: [] },
      { timeOfDay: 'evening', label: 'Evening', icon: 'nights_stay', habits: [] },
      { timeOfDay: 'anytime', label: 'Anytime', icon: 'schedule', habits: [] },
    ];

    for (const counter of counters) {
      const timeOfDay = counter.timeOfDay || 'anytime';
      const group = groups.find((g) => g.timeOfDay === timeOfDay);
      if (group) {
        group.habits.push(counter);
      }
    }

    // Only return groups that have habits
    return groups.filter((g) => g.habits.length > 0);
  });

  private _animateToOffset(targetOffset: number): void {
    if (this.weekTransition()) {
      return;
    }

    const from = this.dayOffset();
    const to = targetOffset;

    if (from === to) {
      return;
    }

    this.weekTransition.set({
      from,
      to,
      dir: to > from ? 'next' : 'prev',
      animate: false,
    });

    // Trigger CSS transitions reliably by switching to "animate" on next frame.
    window.requestAnimationFrame(() => {
      const tr = this.weekTransition();
      if (!tr || tr.from !== from || tr.to !== to) {
        return;
      }
      this.weekTransition.set({ ...tr, animate: true });
    });

    window.setTimeout(() => {
      this.dayOffset.set(to);
      this.weekTransition.set(null);
    }, this._weekTransitionMs);
  }

  prevWeek(): void {
    this._animateToOffset(this.dayOffset() - 7);
  }

  nextWeek(): void {
    this._animateToOffset(Math.min(0, this.dayOffset() + 7));
  }

  resetToToday(): void {
    this._animateToOffset(0);
  }

  dateRangeLabel = computed(() => {
    const days = this.days();
    if (days.length === 0) return '';
    const first = this.parseDateLocal(days[0]);
    const last = this.parseDateLocal(days[days.length - 1]);

    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const firstStr = first.toLocaleDateString(undefined, formatOptions);
    const lastStr = last.toLocaleDateString(undefined, formatOptions);

    return `${firstStr} - ${lastStr}`;
  });

  dateRangeLabelForOffset(offset: number): string {
    const days = this.daysForOffset(offset);
    if (days.length === 0) return '';
    const first = this.parseDateLocal(days[0]);
    const last = this.parseDateLocal(days[days.length - 1]);

    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const firstStr = first.toLocaleDateString(undefined, formatOptions);
    const lastStr = last.toLocaleDateString(undefined, formatOptions);

    return `${firstStr} - ${lastStr}`;
  }

  shouldShowTodayBtn(): boolean {
    const tr = this.weekTransition();
    if (tr) {
      return tr.to !== 0;
    }
    return this.dayOffset() !== 0;
  }

  parseDateLocal(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  isToday(dateStr: string): boolean {
    return dateStr === this._dateService.todayStr();
  }

  getAccentCssVar(color: HabitAccentColor | undefined): string {
    const colorMap: Record<HabitAccentColor, string> = {
      blue: 'var(--neo-accent-blue)',
      green: 'var(--neo-accent-green)',
      purple: 'var(--neo-accent-purple)',
      orange: 'var(--neo-accent-orange)',
      pink: 'var(--neo-accent-pink)',
      cyan: 'var(--neo-accent-cyan)',
      yellow: 'var(--neo-accent-yellow)',
      red: 'var(--neo-accent-red)',
    };
    return colorMap[color || 'blue'];
  }

  private _longPressTimer?: number;
  private _isLongPress = false;
  private _pendingLongPressAction?: { counter: SimpleCounter; date: string };

  onCellClick(counter: SimpleCounter, date: string): void {
    if (this._isLongPress) {
      this._isLongPress = false;
      return;
    }

    const currentValue = this.getVal(counter, date);

    if (
      counter.type === SimpleCounterType.ClickCounter ||
      counter.type === SimpleCounterType.RepeatedCountdownReminder
    ) {
      // Increment for ClickCounters on left click
      const newVal = currentValue + 1;
      this._simpleCounterService.setCounterForDate(counter.id, date, newVal);
    } else {
      // For StopWatch or others, open dialog on left click
      this.openEditDialog(counter, date);
    }
  }

  onCellContextMenu(event: MouseEvent, counter: SimpleCounter, date: string): void {
    event.preventDefault(); // Prevent default browser context menu

    // Right-click decrements (allows untoggling accidental clicks)
    if (
      counter.type === SimpleCounterType.ClickCounter ||
      counter.type === SimpleCounterType.RepeatedCountdownReminder
    ) {
      const currentValue = this.getVal(counter, date);
      if (currentValue > 0) {
        const newVal = currentValue - 1;
        this._simpleCounterService.setCounterForDate(counter.id, date, newVal);
      }
    } else {
      // For StopWatch, right-click still opens dialog
      this.openEditDialog(counter, date);
    }
  }

  onPressStart(counter: SimpleCounter, date: string): void {
    this._isLongPress = false;
    this._pendingLongPressAction = undefined;
    this._longPressTimer = window.setTimeout(() => {
      this._isLongPress = true;
      this._pendingLongPressAction = { counter, date };
    }, 700); // 700ms for long press
  }

  onPressEnd(): void {
    if (this._longPressTimer) {
      window.clearTimeout(this._longPressTimer);
      this._longPressTimer = undefined;
    }

    // If long press was triggered, open dialog on release
    if (this._pendingLongPressAction) {
      const { counter, date } = this._pendingLongPressAction;
      this._pendingLongPressAction = undefined;
      this.openEditDialog(counter, date);
    }
  }

  openEditDialog(counter: SimpleCounter, date: string): void {
    const counterCopy = {
      ...counter,
      countOnDay: { ...counter.countOnDay },
    };

    this._matDialog.open(DialogSimpleCounterEditComponent, {
      data: { simpleCounter: counterCopy, selectedDate: date },
      restoreFocus: true,
    });
  }

  isSimpleCompletion(counter: SimpleCounter): boolean {
    // Simple completion: ClickCounter type with no specific goal or goal of 1
    return (
      counter.type === SimpleCounterType.ClickCounter &&
      (!counter.streakMinValue || counter.streakMinValue === 1)
    );
  }

  getVal(counter: SimpleCounter, day: string): number {
    return counter.countOnDay[day] || 0;
  }

  getDisplayValue(counter: SimpleCounter, day: string): string {
    const value = this.getVal(counter, day);
    if (value === 0) return '';

    // For simple completion, just show checkmark (handled in template)
    if (this.isSimpleCompletion(counter)) {
      return '';
    }

    // For StopWatch, show time
    if (counter.type === SimpleCounterType.StopWatch) {
      // Convert ms to minutes for display
      const minutes = Math.round(value / 60000);
      if (minutes < 60) {
        return `${minutes}m`;
      } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
      }
    }

    // For ClickCounter with specific values, show the count
    return value.toString();
  }

  getProgress(counter: SimpleCounter, day: string): number {
    const value = this.getVal(counter, day);
    if (value === 0) return 0;

    const goal = counter.streakMinValue || 1;
    return Math.min(100, (value / goal) * 100);
  }

  /**
   * Calculate current streak for a habit.
   * Counts consecutive days completed going backwards from today.
   */
  getStreak(counter: SimpleCounter): number {
    const goal = counter.streakMinValue || 1;
    const today = new Date();
    let streak = 0;

    // Count consecutive days backwards starting from today
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = this._dateService.todayStr(d);
      const value = counter.countOnDay[dateStr] || 0;

      if (value >= goal) {
        streak++;
      } else {
        // If today is incomplete, don't break the streak yet -
        // check if yesterday was complete (allows "in progress" state)
        if (i === 0) {
          continue; // Skip today if incomplete, check yesterday
        }
        break;
      }
    }

    return streak;
  }

  /**
   * Get flame level based on streak length (for visual evolution).
   * 0 = no streak, 1 = 1-6 days, 2 = 7-13 days, 3 = 14-29 days, 4 = 30-59 days, 5 = 60+ days
   */
  getFlameLevel(counter: SimpleCounter): number {
    const streak = this.getStreak(counter);
    if (streak === 0) return 0;
    if (streak < 7) return 1;
    if (streak < 14) return 2;
    if (streak < 30) return 3;
    if (streak < 60) return 4;
    return 5;
  }

  /**
   * Check if today's habit is complete (for flame fill state).
   */
  isTodayComplete(counter: SimpleCounter): boolean {
    const todayStr = this._dateService.todayStr();
    const goal = counter.streakMinValue || 1;
    return (counter.countOnDay[todayStr] || 0) >= goal;
  }

  // Calculate stroke-dashoffset for progress ring
  getProgressOffset(counter: SimpleCounter, day: string, circumference: number): number {
    const progress = this.getProgress(counter, day);
    const progressAmount = (circumference * progress) / 100;
    return circumference - progressAmount;
  }

  addHabit(): void {
    const newHabit = {
      ...EMPTY_SIMPLE_COUNTER,
      isEnabled: true,
    };

    this._matDialog.open(DialogSimpleCounterEditSettingsComponent, {
      data: { simpleCounter: newHabit },
      restoreFocus: true,
      width: '600px',
    });
  }

  openEditSettings(counter: SimpleCounter): void {
    const counterCopy = {
      ...counter,
      countOnDay: { ...counter.countOnDay },
    };

    this._matDialog.open(DialogSimpleCounterEditSettingsComponent, {
      data: { simpleCounter: counterCopy },
      restoreFocus: true,
      width: '600px',
    });
  }

  openManageHabits(): void {
    this._router.navigate(['/config'], {
      queryParams: { tab: 3, section: 'SIMPLE_COUNTER_CFG' },
    });
  }
}
