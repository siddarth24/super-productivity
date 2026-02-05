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
  updateAllSimpleCounters,
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
          updateAllSimpleCounters,
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
