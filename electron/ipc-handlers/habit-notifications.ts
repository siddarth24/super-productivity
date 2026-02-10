import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC } from '../shared-with-frontend/ipc-events.const';
import { getWin } from '../main-window';
import { log } from 'electron-log/main';

const CONFIG_FILE_NAME = 'habit-notification-config.json';

const getConfigPath = (): string => {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
};

export const initHabitNotificationIpc = (): void => {
  ipcMain.on(IPC.HABIT_NOTIFICATION_SYNC_CONFIG, (_event, config: unknown[]) => {
    try {
      const configPath = getConfigPath();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      log('[Habit Notifications] Config synced to:', configPath);
    } catch (err) {
      log('[Habit Notifications] Failed to sync config:', err);
    }
  });

  ipcMain.on(IPC.HABIT_NOTIFICATION_CLICKED, (_event, counterId: string) => {
    try {
      const mainWindow = getWin();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send(IPC.HABIT_NOTIFICATION_FOCUS, counterId);
    } catch (err) {
      log('[Habit Notifications] Failed to handle notification click:', err);
    }
  });
};
