import { SimpleCounterCfgFields } from './simple-counter.model';

const FIELDS_TO_COMPARE: (keyof SimpleCounterCfgFields)[] = [
  'id',
  'title',
  'isEnabled',
  'icon',
  'type',
  'countdownDuration',
  'timeOfDay',
  'accentColor',
  'notificationEnabled',
  'notificationDays',
  'notificationTimes',
  'notificationSound',
];

export const isEqualSimpleCounterCfg = (
  a: SimpleCounterCfgFields[] | unknown,
  b: SimpleCounterCfgFields[] | unknown,
): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        const aa = a as SimpleCounterCfgFields[];
        const bb = b as SimpleCounterCfgFields[];

        const isEqualField = (x: any, y: any): boolean => {
          if (x === y) return true;
          if (Array.isArray(x) && Array.isArray(y)) {
            if (x.length !== y.length) return false;
            for (let k = 0; k < x.length; k++) {
              if (x[k] !== y[k]) return false;
            }
            return true;
          }
          if (x && typeof x === 'object' && y && typeof y === 'object') {
            const xKeys = Object.keys(x);
            const yKeys = Object.keys(y);
            if (xKeys.length !== yKeys.length) return false;
            for (const key of xKeys) {
              if (x[key] !== y[key]) return false;
            }
            return true;
          }
          return false;
        };

        for (let j = 0; j < FIELDS_TO_COMPARE.length; j++) {
          const field = FIELDS_TO_COMPARE[j];
          if (!isEqualField(aa[i][field], bb[i][field])) {
            return false;
          }
        }
      }
    }
    return true;
  } else {
    return a === b;
  }
};
