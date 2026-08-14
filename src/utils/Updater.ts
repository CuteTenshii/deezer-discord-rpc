import { log } from './Log';
import { version } from '../../package.json';
import { dialog, shell } from 'electron';
import { readFileSync } from 'fs';
import { win } from './Window';

const repository = 'CuteTenshii/deezer-discord-rpc';
const apiUrl = `https://api.github.com/repos/${repository}/releases/latest`;
const allowedApiPaths = new Set([
  '/repos/JustYuuto/deezer-discord-rpc/releases/latest',
  `/repos/${repository}/releases/latest`,
  '/repositories/447222566/releases/latest',
]);

interface GithubRelease {
  tag_name: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
  html_url: string;
}

function getOsAndArch() {
  const os = process.platform;
  const arch = process.arch;
  const release = process.platform === 'linux' ?
    readFileSync('/etc/os-release', 'utf8') :
    undefined;
  if (os === 'darwin') {
    return { os: 'mac', arch, ext: 'dmg' };
  } else if (os === 'win32') {
    return { os: 'win', arch, ext: 'exe' };
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
    }
    // Fallback to AppImage for unknown distros
    return { os: 'linux', arch: 'x86_64', ext: 'AppImage' };
  }
  return { os: null, arch: null, ext: null };
}

function parseVersion(value: string): [number, number, number] | null {
  const match = value.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewerVersion(candidate: string, installed: string): boolean {
  const candidateVersion = parseVersion(candidate);
  const installedVersion = parseVersion(installed);
  if (!candidateVersion || !installedVersion)
    throw new Error('GitHub returned an invalid release version.');

  for (let index = 0; index < candidateVersion.length; index++) {
    if (candidateVersion[index] !== installedVersion[index])
      return candidateVersion[index] > installedVersion[index];
  }
  return false;
}

function parseStrictHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const authority = url.href.slice(url.protocol.length + 2).split('/', 1)[0];
    if (url.protocol !== 'https:' || authority.includes('@') || url.host !== url.hostname)
      return null;
    return url;
  } catch {
    return null;
  }
}

function isAllowedReleaseUrl(value: string, kind: 'download' | 'tag'): boolean {
  const url = parseStrictHttpsUrl(value);
  if (!url || url.hostname !== 'github.com' || url.search || url.hash)
    return false;

  const expectedPrefix = `/${repository}/releases/${kind}/`.toLowerCase();
  return url.pathname.toLowerCase().startsWith(expectedPrefix);
}

function getReleaseUrl(release: GithubRelease): string {
  const { os, arch, ext } = getOsAndArch();
  const expectedName = os && arch && ext ? `DeezerDiscordRPC-${os}-${arch}.${ext}` : null;
  const asset = expectedName ? release.assets.find(({ name }) => name === expectedName) : undefined;
  const candidate = asset?.browser_download_url ?? release.html_url;
  const kind = asset ? 'download' : 'tag';

  if (!isAllowedReleaseUrl(candidate, kind))
    throw new Error('GitHub returned an untrusted release URL.');
  return candidate;
}

function isGithubRelease(value: unknown): value is GithubRelease {
  if (!value || typeof value !== 'object') return false;
  const release = value as Partial<GithubRelease>;
  return typeof release.tag_name === 'string' &&
    typeof release.html_url === 'string' &&
    Array.isArray(release.assets) &&
    release.assets.every(asset => asset && typeof asset.name === 'string' &&
      typeof asset.browser_download_url === 'string');
}

export default async function updater(fromStartup: boolean = false) {
  log('Updater', 'Checking for updates...');
  try {
    const release = await getLatestRelease();
    if (isNewerVersion(release.tag_name, version)) {
      log('Updater', 'The version', release.tag_name, 'is available to download!');
      const { response } = await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Update available',
        buttons: ['Cancel', 'Download'],
        message: `The version ${release.tag_name} is available to download!`,
        defaultId: 1,
        cancelId: 0,
      });
      if (response === 1)
        await shell.openExternal(getReleaseUrl(release));
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
    const error = reason instanceof Error ? reason : new Error(String(reason));
    log('Updater', 'Cannot get the latest release:', error.message);
    // Startup checks stay quiet when offline.
    if (fromStartup) return;
    const { response } = await dialog.showMessageBox(win, {
      type: 'error',
      buttons: ['Close', 'Retry'],
      title: 'Cannot get latest release',
      message: 'Cannot get the latest release.',
      detail: error.message,
      defaultId: 1,
      cancelId: 0,
    });
    if (response === 1) await updater();
  }
}

export async function getLatestRelease(): Promise<GithubRelease> {
  const res = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `DeezerDiscordRPC/${version}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok)
    throw new Error(`GitHub API request failed with status ${res.status}.`);

  const finalUrl = parseStrictHttpsUrl(res.url);
  if (!finalUrl || finalUrl.hostname !== 'api.github.com' || finalUrl.search || finalUrl.hash ||
      !allowedApiPaths.has(finalUrl.pathname))
    throw new Error('GitHub redirected the update request to an untrusted URL.');

  const release: unknown = await res.json();
  if (!isGithubRelease(release))
    throw new Error('GitHub returned an invalid release response.');
  return release;
}
