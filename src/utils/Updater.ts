import { log } from './Log';
import { version } from '../../package.json';
import { dialog, shell } from 'electron';
import { readFileSync } from 'fs';
import { win } from './Window';

function getOsAndArch() {
  const os = process.platform;
  const arch = process.arch;
  const release = process.platform === 'linux' ?
    readFileSync('/etc/os-release', 'utf8') :
    undefined;
  if (os === 'darwin') {
    return { os: 'mac', arch };
  } else if (os === 'win32') {
    return { os: 'win', arch };
  } else if (os === 'linux') {
    if (release) {
      const match = release.match(/ID=([a-zA-Z0-9]+)/);
      if (match) {
        const distro = match[1].toLowerCase();
        if (distro === 'ubuntu' || distro === 'debian') {
          return { os: 'linux', arch: 'amd64', ext: 'deb' };
        } else if (distro === 'fedora' || distro === 'centos' || distro === 'rhel') {
          return { os: 'linux', arch: 'x86_64', ext: 'rpm' };
        }
      }
    } else {
      // Fallback to AppImage for unknown distros
      return { os: 'linux', arch: 'x86_64', ext: 'AppImage' };
    }
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
  const url = 'https://api.github.com/repos/JustYuuto/deezer-discord-rpc/releases/latest';
  const res = await fetch(url);
  return res.json();
}
