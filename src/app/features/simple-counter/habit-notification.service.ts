import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { NotifyService } from '../../core/notify/notify.service';
import { playSound } from '../../util/play-sound';
import { GlobalConfigService } from '../config/global-config.service';
import { SimpleCounter } from './simple-counter.model';
import { T } from '../../t.const';
import { IS_ELECTRON } from '../../app.constants';

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

  private _scheduled = signal<ScheduledNotification[]>([]);

  ngOnDestroy(): void {
    this._clearAllScheduled();
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
