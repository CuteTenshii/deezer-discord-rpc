import { app, BrowserWindow } from 'electron';
import { log } from './utils/Log';
import * as Tray from './utils/Tray';
import updater, { updatesEnabled } from './utils/Updater';
import * as RPC from './utils/RPC';
import * as Window from './utils/Window';
import { version } from '../package.json';
import { showWindow } from './utils/Window';

log('App', 'Deezer Discord RPC version', version, process.argv0.includes('node') ? '(debug)' : '');

app.whenReady().then(async () => {
  const gotTheLock = app.requestSingleInstanceLock();

  // app.quit() only schedules the quit, so returning keeps this instance from starting its own tray, window and RPC.
  if (!gotTheLock) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    // If someone opens a second instance we show our windows after the new instance closes
    showWindow();
  });

  await Tray.init(app);
  await Window.load(app);
  if (updatesEnabled) await updater(true);

  RPC.connect();

  app.on('quit', () => {
    RPC.disconnect();
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length > 0) {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window.isVisible()) window.show();
      if (window.isMinimized()) window.maximize();
    } else {
      await Window.load(app);
    }
  });

  app.on('second-instance', (e) => {
    e.preventDefault();

    const window = BrowserWindow.getAllWindows()[0];
    if (!window.isVisible()) window.show();
    if (window.isMinimized()) window.maximize();
  });
});
