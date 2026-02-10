import { isEqualSimpleCounterCfg } from './is-equal-simple-counter-cfg.util';
import { SimpleCounterType } from './simple-counter.model';

describe('isEqualSimpleCounterCfg', () => {
  const base = {
    id: '1',
    title: 't',
    isEnabled: true,
    icon: null,
    type: SimpleCounterType.ClickCounter,
  } as any;

  it('returns false when notificationTimes differ', () => {
    const a = [{ ...base, notificationTimes: ['08:00'] }];
    const b = [{ ...base, notificationTimes: [] }];

    expect(isEqualSimpleCounterCfg(a, b)).toBeFalse();
  });

  it('returns true when notificationTimes equal', () => {
    const a = [{ ...base, notificationTimes: ['08:00'] }];
    const b = [{ ...base, notificationTimes: ['08:00'] }];

    expect(isEqualSimpleCounterCfg(a, b)).toBeTrue();
  });
});
