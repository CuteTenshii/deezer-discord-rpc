import { join } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { dialog } from 'electron';
import { win } from './Window';

export async function set(app: Electron.App, key: string, value: unknown) {
  const path = getConfigPath(app);
  if (!existsSync(path)) writeFileSync(path, '{}');
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  data[key] = value;
  try {
    writeFileSync(path, JSON.stringify(data));
  } catch (e) {
    dialog.showMessageBox(win, {
      type: 'error',
      buttons: ['Close'],
      title: 'Failed to write config file',
      message: `An error occurred while writing to ${path}`,
      detail: e?.toString(),
      defaultId: 0
    });
  }
}

export function get<T>(app: Electron.App, key?: string): T {
  const path = getConfigPath(app);
  if (!existsSync(path)) writeFileSync(path, '{}');
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  return key ? data[key] : data;
}

function getConfigPath(app: Electron.App) {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'config.json');
}
