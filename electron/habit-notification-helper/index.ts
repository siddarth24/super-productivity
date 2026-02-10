#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as schedule from 'node-schedule';
import notifier from 'node-notifier';

const APP_NAME = 'Super Productivity';
const CONFIG_FILE_NAME = 'habit-notification-config.json';

interface HabitConfig {
  id: string;
  title: string;
  days: { [key: number]: boolean };
  times: string[];
  sound?: string;
}

const getConfigPath = (): string => {
  const platform = process.platform;
  if (platform === 'linux') {
    return path.join(os.homedir(), '.config', 'superProductivity', CONFIG_FILE_NAME);
  } else if (platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'superProductivity',
      CONFIG_FILE_NAME,
    );
  } else {
    return path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'superProductivity',
      CONFIG_FILE_NAME,
    );
  }
};

const readConfig = (): HabitConfig[] => {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return [];
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[Habit Helper] Failed to read config:', err);
    return [];
  }
};

const isMainAppRunning = (): boolean => {
  const lockPath = path.join(path.dirname(getConfigPath()), 'app.lock');
  return fs.existsSync(lockPath);
};

const scheduleNotifications = (configs: HabitConfig[]): void => {
  // Cancel all existing jobs
  for (const jobName of Object.keys(schedule.scheduledJobs)) {
    schedule.cancelJob(jobName);
  }

  for (const config of configs) {
    if (!config.times?.length) continue;

    for (const timeStr of config.times) {
      const [hour, minute] = timeStr.split(':').map(Number);

      const enabledDays = Object.entries(config.days || {})
        .filter(([_, enabled]) => enabled)
        .map(([day]) => parseInt(day));

      if (enabledDays.length === 0) continue;

      const jobName = `${config.id}-${timeStr}`;

      schedule.scheduleJob(jobName, { hour, minute, dayOfWeek: enabledDays }, () => {
        if (!isMainAppRunning()) {
          notifier.notify({
            title: APP_NAME,
            message: `Habit Reminder: ${config.title}`,
            icon: path.join(__dirname, 'icon.png'),
            wait: true,
          });
        }
      });
    }
  }

  console.log(
    `[Habit Helper] Scheduled ${Object.keys(schedule.scheduledJobs).length} notification jobs`,
  );
};

const watchConfig = (): void => {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.watch(configDir, (eventType, filename) => {
    if (filename === CONFIG_FILE_NAME) {
      console.log('[Habit Helper] Config changed, rescheduling...');
      const configs = readConfig();
      scheduleNotifications(configs);
    }
  });
};

// Main
console.log('[Habit Helper] Starting...');
const configs = readConfig();
scheduleNotifications(configs);
watchConfig();

// Keep process alive
setInterval(() => {}, 1 << 30);
