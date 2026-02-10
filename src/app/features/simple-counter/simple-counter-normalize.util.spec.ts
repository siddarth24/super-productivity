import { normalizeSimpleCounterSettings } from './simple-counter-normalize.util';
import { SimpleCounterCfgFields, SimpleCounterType } from './simple-counter.model';

describe('normalizeSimpleCounterSettings', () => {
  const base: SimpleCounterCfgFields = {
    id: '1',
    title: 't',
    isEnabled: true,
    icon: null,
    type: SimpleCounterType.ClickCounter,
  } as any;

  it('defaults notificationTimes to [] when not set', () => {
    const settings = { ...base } as SimpleCounterCfgFields;
    const normalized = normalizeSimpleCounterSettings(settings);

    expect(normalized.notificationTimes).toEqual([]);
  });

  it('clears notificationTimes to [] when notificationEnabled is false and clears other notification fields', () => {
    const notificationDays: { [key: number]: boolean } = {};
    notificationDays[1] = true;
    const settings = {
      ...base,
      notificationEnabled: false,
      notificationTimes: ['08:00'],
      notificationDays,
      notificationSound: 'ding',
    } as any;

    const normalized = normalizeSimpleCounterSettings(settings);

    expect(normalized.notificationEnabled).toBeFalse();
    expect(normalized.notificationTimes).toEqual([]);
    expect(normalized.notificationDays).toBeUndefined();
    expect(normalized.notificationSound).toBeUndefined();
  });
});
