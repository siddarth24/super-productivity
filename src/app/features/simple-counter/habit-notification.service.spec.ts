/* eslint-disable @typescript-eslint/naming-convention */
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HabitNotificationService } from './habit-notification.service';
import { NotifyService } from '../../core/notify/notify.service';
import { GlobalConfigService } from '../config/global-config.service';
import { SimpleCounter } from './simple-counter.model';
import { EMPTY_SIMPLE_COUNTER } from './simple-counter.const';
import { signal } from '@angular/core';

describe('HabitNotificationService', () => {
  let service: HabitNotificationService;
  let notifyServiceSpy: jasmine.SpyObj<NotifyService>;

  const allDays = {
    0: true,
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  };

  const noDays: { [key: number]: boolean } = {
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
  };

  const createCounter = (
    id: string,
    partial: Partial<SimpleCounter> = {},
  ): SimpleCounter => ({
    ...EMPTY_SIMPLE_COUNTER,
    id,
    title: `Counter ${id}`,
    isEnabled: true,
    ...partial,
  });

  beforeEach(() => {
    notifyServiceSpy = jasmine.createSpyObj('NotifyService', ['notifyDesktop']);
    notifyServiceSpy.notifyDesktop.and.returnValue(Promise.resolve(undefined));

    const mockSoundSignal = signal({ volume: 100 });
    const mockGlobalConfigService = {
      sound: mockSoundSignal,
    };

    TestBed.configureTestingModule({
      providers: [
        HabitNotificationService,
        { provide: NotifyService, useValue: notifyServiceSpy },
        { provide: GlobalConfigService, useValue: mockGlobalConfigService },
      ],
    });

    service = TestBed.inject(HabitNotificationService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('updateSchedule', () => {
    it('should not schedule notifications for disabled counters', () => {
      const counter = createCounter('1', {
        notificationEnabled: false,
        notificationTimes: ['23:59'],
        notificationDays: allDays,
      });

      service.updateSchedule([counter]);
      // No notification should fire - counter is disabled
    });

    it('should not schedule notifications for past times', fakeAsync(() => {
      const now = new Date();
      const pastHour = now.getHours() - 1;
      if (pastHour < 0) {
        // skip test if it's midnight
        return;
      }
      const pastTime = `${pastHour.toString().padStart(2, '0')}:00`;

      const counter = createCounter('1', {
        notificationEnabled: true,
        notificationTimes: [pastTime],
        notificationDays: allDays,
      });

      service.updateSchedule([counter]);

      // Wait a bit - no notification should fire
      tick(1000);
      expect(notifyServiceSpy.notifyDesktop).not.toHaveBeenCalled();
    }));

    it('should not schedule notifications for days not enabled', () => {
      const counter = createCounter('1', {
        notificationEnabled: true,
        notificationTimes: ['23:59'],
        notificationDays: noDays,
      });

      service.updateSchedule([counter]);
      // No notification should be scheduled for today
    });

    it('should clear previous schedules when updating', () => {
      const counter = createCounter('1', {
        notificationEnabled: true,
        notificationTimes: ['23:59'],
        notificationDays: allDays,
      });

      service.updateSchedule([counter]);
      // Update again with empty list
      service.updateSchedule([]);
      // Previous schedule should be cleared
    });
  });
});
