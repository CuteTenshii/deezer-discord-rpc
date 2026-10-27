import { join } from 'path';
import updater, { updatesEnabled } from './Updater';
import * as Config from './Config';
import * as RPC from './RPC';
import { Menu, Tray } from 'electron';
import { version } from '../../package.json';
import { refreshPlayerControls, resendActivity, win } from './Window';
import { runJs } from '../functions';
import MenuItemConstructorOptions = Electron.MenuItemConstructorOptions;

const iconPath = join(__dirname, '..', 'img', 'tray.png');

/** Deezer's repeat modes, as used by `dzPlayer.getRepeat()` and `dzPlayer.control.setRepeat()`. */
export enum RepeatMode {
  Off = 0,
  All = 1,
  One = 2,
}

export interface PlayerState {
  playing: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  shuffle: boolean;
  canShuffle: boolean;
  repeat: RepeatMode;
  canRepeat: boolean;
}

export let tray: Tray | null = null;
let trayApp: Electron.App;
let playerState: PlayerState | null = null;

export async function init(app: Electron.App) {
  trayApp = app;
  app?.whenReady().then(async () => {
    tray = new Tray(iconPath);
    tray.setToolTip('Deezer Discord RPC');
    tray.setContextMenu(buildMenu());
    tray.on('click', () => {
      if (!win.isVisible()) win.show();
    });
  });
}

/** Rebuilds the menu when the player changed, since Linux trays ignore edits to an already set menu. */
export function setPlayerState(state: PlayerState | null) {
  if (JSON.stringify(state) === JSON.stringify(playerState)) return;
  playerState = state;
  tray?.setContextMenu(buildMenu());
}

function controlPlayer(code: string) {
  runJs(code).then(() => refreshPlayerControls()).catch(console.error);
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'Deezer Discord RPC', type: 'normal', click: () => win.show() },
    { label: `Version: ${version}${process.argv0.includes('node') ? ' (debug)' : ''}`, type: 'normal', enabled: false },
    { label: 'Check for updates', type: 'normal', visible: updatesEnabled, click: () => updater() },
    { type: 'separator' },
    {
      label: 'Previous', type: 'normal', enabled: !!playerState?.hasPrevious,
      click: () => controlPlayer('dzPlayer.control.prevSong()'),
    },
    {
      label: playerState?.playing ? 'Pause' : 'Play', type: 'normal', enabled: !!playerState,
      click: () => controlPlayer('dzPlayer.control.togglePause()'),
    },
    {
      label: 'Next', type: 'normal', enabled: !!playerState?.hasNext,
      click: () => controlPlayer('dzPlayer.control.nextSong()'),
    },
    {
      label: 'Shuffle', type: 'checkbox', enabled: !!playerState?.canShuffle, checked: !!playerState?.shuffle,
      click: (menuItem) => controlPlayer(`dzPlayer.control.setShuffle(${menuItem.checked})`),
    },
    {
      label: 'Repeat', type: 'submenu', enabled: !!playerState?.canRepeat, submenu: [
        ['Off', RepeatMode.Off],
        ['All', RepeatMode.All],
        ['One', RepeatMode.One],
      ].map(([label, mode]): MenuItemConstructorOptions => ({
        label: label as string, type: 'radio', checked: (playerState?.repeat ?? RepeatMode.Off) === mode,
        click: () => controlPlayer(`dzPlayer.control.setRepeat(${mode})`),
      })),
    },
    { type: 'separator' },
    {
      label: 'Status name', type: 'submenu', submenu: [
        ['Deezer', 'app_name'],
        ['Song title', 'song_title'],
        ['Artists song', 'artists_song'],
        ['Artists song - Song title', 'artists_and_title'],
        ['Song title - Artists song', 'title_and_artists'],
      ].map((v): MenuItemConstructorOptions => ({
        label: v[0], type: 'radio', id: v[1], checked: (Config.get(trayApp, 'status_name') ?? 'app_name') === v[1],
        click: async (menuItem) => {
          await Config.set(trayApp, 'status_name', menuItem.id);
          resendActivity(trayApp);
        },
      }))
    },
    {
      label: 'Tooltip text', type: 'submenu', submenu: [
        ['App name', 'app_name'],
        ['App version', 'app_version'],
        ['App name and version', 'app_name_and_version'],
        ['Artists song - Song title', 'artists_and_title'],
        ['Song title - Artists song', 'title_and_artists'],
      ].map((v): MenuItemConstructorOptions => ({
        label: v[0], type: 'radio', id: v[1], checked: (Config.get(trayApp, 'tooltip_text') ?? 'app_name') === v[1],
        click: (menuItem) => Config.set(trayApp, 'tooltip_text', menuItem.id),
      }))
    },
    {
      label: 'Don\'t close to tray', type: 'checkbox', checked: Config.get(trayApp, 'dont_close_to_tray'),
      click: (menuItem) => Config.set(trayApp, 'dont_close_to_tray', menuItem.checked)
    },
    { type: 'separator' },
    {
      label: 'Quit', type: 'normal', click: async () => {
        RPC.disconnect().catch(console.error);
        win.close();
        trayApp.quit();
        process.exit(0);
      }
    }
  ]);
}
