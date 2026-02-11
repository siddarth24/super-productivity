import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { app } from 'electron';
import { log } from 'electron-log/main';

const SERVICE_NAME = 'sp-habit-helper.service';
const HELPER_DIR_NAME = 'habit-notification-helper';

export const installSystemdService = (): void => {
  if (process.platform !== 'linux') {
    log('[Habit Helper Installer] Not Linux, skipping systemd install');
    return;
  }

  try {
    const userConfigDir = path.join(os.homedir(), '.config', 'systemd', 'user');
    const servicePath = path.join(userConfigDir, SERVICE_NAME);

    // Check if already installed
    if (fs.existsSync(servicePath)) {
      log('[Habit Helper Installer] Service already installed');
      return;
    }

    // Create directories
    fs.mkdirSync(userConfigDir, { recursive: true });

    const helperTargetDir = path.join(app.getPath('userData'), HELPER_DIR_NAME);
    fs.mkdirSync(helperTargetDir, { recursive: true });

    // Copy helper files
    // __dirname already points to habit-notification-helper directory
    const helperSourceDir = __dirname;
    const filesToCopy = ['index.js', 'package.json'];
    for (const file of filesToCopy) {
      fs.copyFileSync(path.join(helperSourceDir, file), path.join(helperTargetDir, file));
    }

    // Install npm dependencies
    execSync('npm install --production', { cwd: helperTargetDir });

    // Generate service file with correct paths
    const serviceContent = `[Unit]
Description=Super Productivity Habit Notification Helper
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/node ${helperTargetDir}/index.js
Restart=on-failure
RestartSec=10
Environment=DISPLAY=:0
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${process.getuid!()}/bus

[Install]
WantedBy=default.target
`;

    fs.writeFileSync(servicePath, serviceContent);

    // Enable and start service
    execSync('systemctl --user daemon-reload');
    execSync(`systemctl --user enable ${SERVICE_NAME}`);
    execSync(`systemctl --user start ${SERVICE_NAME}`);

    log('[Habit Helper Installer] Service installed and started');
  } catch (err) {
    log('[Habit Helper Installer] Failed to install:', err);
  }
};
