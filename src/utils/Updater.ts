import { log } from './Log';
import { version } from '../../package.json';
import { app, dialog, shell } from 'electron';
import { readFileSync } from 'fs';
import { win } from './Window';

/**
 * False when the app was started with --disable-updates, which packagers whose package manager
 * handles updates (AUR, Nix) pass so the app neither checks for nor offers updates.
 */
export const updatesEnabled = !app.commandLine.hasSwitch('disable-updates');

function getDistroId() {
  try {
    const release = readFileSync('/etc/os-release', 'utf8');
    return release.match(/^ID="?([^"\n]+)"?$/m)?.[1].toLowerCase();
  } catch {
    return undefined;
  }
}

function getOsAndArch(): { os: string | null; arch: string | null; ext?: string } {
  const os = process.platform;
  const arch = process.arch;
  if (os === 'darwin') {
    return { os: 'mac', arch };
  } else if (os === 'win32') {
    return { os: 'win', arch };
  } else if (os === 'linux') {
    const appImage = { os: 'linux', arch: 'x86_64', ext: 'AppImage' };
    // The AppImage runtime sets APPIMAGE, so its users get an AppImage back whatever their distro.
    if (process.env.APPIMAGE) return appImage;
    const distro = getDistroId();
    if (distro === 'ubuntu' || distro === 'debian') {
      return { os: 'linux', arch: 'amd64', ext: 'deb' };
    } else if (distro === 'fedora' || distro === 'centos' || distro === 'rhel') {
      return { os: 'linux', arch: 'x86_64', ext: 'rpm' };
    }
    return appImage;
  }
  return { os: null, arch: null };
}

export default async function updater(fromStartup: boolean = false) {
  log('Updater', 'Checking for updates...');
  try {
    const release = await getLatestRelease();
    if (release.tag_name !== version) {
      log('Updater', 'The version', release.tag_name, 'is available to download!');
      dialog.showMessageBox({
        type: 'info',
        title: 'Update available',
        buttons: ['Cancel', 'Download'],
        message: `The version ${release.tag_name} is available to download!`,
        defaultId: 1,
      }).then(({ response }) => {
        if (response === 1) {
          const { os, arch, ext } = getOsAndArch();
          const file = release.assets.find(f => {
            if (ext)
              return f.name === `DeezerDiscordRPC-${os}-${arch}.${ext}`;
            return f.name.startsWith(`DeezerDiscordRPC-${os}-${arch}`);
          });
          shell.openExternal(file ? file.browser_download_url : release.html_url);
        }
      });
    } else {
      log('Updater', 'No updates found.');
      if (!fromStartup)
        await dialog.showMessageBox(win, {
          type: 'info',
          title: 'No update available',
          message: 'You are using the latest version.',
        });
    }
  } catch (reason) {
    log('Updater', 'Cannot get the latest release:', reason?.toString() ?? 'Unknown error');
    // Starting offline is expected now that the window has an offline page; only a manual check reports it.
    if (fromStartup) return;
    dialog.showMessageBox(win, {
      type: 'error',
      buttons: ['Close', 'Retry'],
      title: 'Cannot get latest release',
      message: 'Cannot get the latest release.',
      detail: reason?.toString(),
      defaultId: 1
    }).then(async ({ response: response_1 }) => {
      if (response_1 === 1) await updater();
    });
  }
}

export async function getLatestRelease(): Promise<{
  tag_name: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
  html_url: string;
}> {
  const url = 'https://api.github.com/repos/CuteTenshii/deezer-discord-rpc/releases/latest';
  const res = await fetch(url);
  return res.json();
}
