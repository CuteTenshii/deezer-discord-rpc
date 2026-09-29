import { userAgent } from '../variables';
import { join, resolve } from 'path';
import * as Config from './Config';
import * as RPC from './RPC';
import { log } from './Log';
import { runJs, wait } from '../functions';
import { BrowserWindow, ipcMain, shell, nativeImage, session } from 'electron';
import { setActivity } from './Activity';

const deezerUrl = 'https://account.deezer.com/login/';
const offlinePagePath = join(__dirname, '..', 'offline.html');
// Chromium reports this when a navigation is replaced by another one, which is not a connection failure.
const ERR_ABORTED = -3;

export let win: BrowserWindow;
let currentTrack: CurrentTrack;
let isQuitting = false;
// Incremented on every page load so a watch started for an earlier page stops polling.
let playerWatchId = 0;

export async function load(app: Electron.App) {
  const width = parseInt(await Config.get(app, 'window_width')) || 1920;
  const height = parseInt(await Config.get(app, 'window_height')) || 1080;
  win = new BrowserWindow({
    width, height,
    minimizable: true,
    maximizable: true,
    closable: true,
    resizable: true,
    center: true,
    title: 'Deezer Discord RPC',
    icon: join(__dirname, '..', 'img', 'app.png'),
    webPreferences: {
      preload: resolve(__dirname, '..', 'preload.js')
    }
  });
  if (width === 1920 && height === 1080) win.maximize();
  win.focus();
  win.show();
  win.setMenuBarVisibility(process.platform === 'darwin');

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('deezer.com'))
      details.requestHeaders['User-Agent'] = userAgent;
    if (details.url.startsWith('https://www.deezer.com/ajax/gw-light.php?method=deezer.adConfig')) // Remove ads
      return callback({ cancel: true });
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  win.on('resized', () => {
    const [w, h] = win.getSize();
    Config.set(app, 'window_width', w);
    Config.set(app, 'window_height', h);
  });

  win.webContents.setWindowOpenHandler((details) => {
    if (details.url.includes('facebook.com') || details.url.includes('apple.com') || details.url.includes('accounts.google.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          center: true,
          maximizable: true,
          minimizable: true,
          closable: true,
          autoHideMenuBar: true,
          fullscreenable: false,
          resizable: true,
          title: 'Deezer Discord RPC',
          icon: join(__dirname, '..', 'img', 'app.ico'),
        }
      };
    } else {
      shell.openExternal(details.url);
      return { action: 'deny' };
    }
  });

  win.webContents.once('did-stop-loading', async () => {
    if (await runJs('typeof backButton !== \'undefined\'')) {
      if (win.webContents.navigationHistory.canGoBack()) {
        runJs('backButton.style.opacity = \'100%\';');
      } else {
        runJs('backButton.style.opacity = \'30%\';');
      }
      if (win.webContents.navigationHistory.canGoForward()) {
        runJs('forwardButton.style.opacity = \'100%\';');
      } else {
        runJs('forwardButton.style.opacity = \'30%\';');
      }
    }
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === ERR_ABORTED || validatedURL.startsWith('file:')) return;
    log('Window', 'Could not load', validatedURL, `(${errorDescription}), showing the offline page`);
    showOfflinePage(errorDescription);
  });

  // The player hooks live in the page, so every full load of Deezer (login redirect, reconnect) needs them again.
  win.webContents.on('did-finish-load', () => {
    playerWatchId++;
    if (new URL(win.webContents.getURL()).hostname.endsWith('deezer.com')) watchForPlayer(playerWatchId);
  });

  // Without this, closing to tray would also veto quits coming from the OS (logout, macOS Cmd+Q).
  app.on('before-quit', () => {
    isQuitting = true;
  });

  // Must stay synchronous: Electron ignores preventDefault() once the handler has yielded.
  win.on('close', (e) => {
    if (isQuitting) return;
    if (Config.get<boolean>(app, 'dont_close_to_tray')) {
      RPC.disconnect().catch(console.error);
      return;
    }
    e.preventDefault();
    win.hide();
  });

  ipcMain.on('update_activity', (_, currentTimeChanged) => {
    updateActivity(app, currentTimeChanged);
  });
  ipcMain.on('nav_back', () => win.webContents.navigationHistory.goBack());
  ipcMain.on('nav_forward', () => win.webContents.navigationHistory.goForward());
  ipcMain.on('retry_load', () => loadDeezer());

  await loadDeezer();
}

async function loadDeezer() {
  // A failed load also rejects here; the did-fail-load listener already swaps in the offline page.
  await win.loadURL(deezerUrl, {
    // The default user agent does not work with Deezer (the player does not update by itself)
    userAgent,
  }).catch(() => undefined);
}

function showOfflinePage(reason: string) {
  win.loadFile(offlinePagePath, { query: { reason } }).catch(console.error);
}

async function watchForPlayer(watchId: number) {
  while (watchId === playerWatchId && !win.isDestroyed()) {
    // Rejects while the page is navigating; the next tick simply tries again.
    const element = await runJs('document.querySelector(\'[data-testid="item_title"]\')').catch(() => null);
    if (element) {
      injectPlayerHooks();
      return;
    }
    await wait(50);
  }
}

function injectPlayerHooks() {
  runJs(`document.querySelector('[data-testid="miniplayer_container"] .slider').addEventListener('click', () => ipcRenderer.send('update_activity', true))
         const trackObserver = new MutationObserver(() => ipcRenderer.send('update_activity', false));
         trackObserver.observe(document.querySelector('.marquee-content > [data-testid="item_title"]'), { childList: true, subtree: true, characterData: true });
         const playObserver = new MutationObserver(() => ipcRenderer.send('update_activity', false));
         playObserver.observe(document.querySelector('.chakra-button__group > button[data-testid^="play_button_"]'), { attributes: true, childList: false, subtree: false });
         document.querySelector('.chakra-button__group > button[data-testid^="play_button_"]').addEventListener('click', () => ipcRenderer.send('update_activity', false));`);
  runJs(`const chakraStack = document.querySelector('#dzr-app > .naboo > div[class*="css-"] > div[class*="css-"] a.chakra-link');
         const navContainer = document.createElement('div');
         navContainer.style.display = 'flex';
         navContainer.style.justifyContent = 'space-around';
         const backButton = document.createElement('button');
         backButton.addEventListener('click', () => ipcRenderer.send('nav_back'));
         backButton.textContent = '<';
         backButton.style.transform = 'scale(2, 4)';
         backButton.style.opacity = '30%';
         const forwardButton = document.createElement('button');
         forwardButton.addEventListener('click', () => ipcRenderer.send('nav_forward'));
         forwardButton.textContent = '>';
         forwardButton.style.transform = 'scale(2, 4)';
         forwardButton.style.opacity = '30%';
         navContainer.appendChild(backButton);
         navContainer.appendChild(forwardButton);
         chakraStack.replaceWith(navContainer);`);
  setThumbarButtons();
}

export async function showWindow() {
  win.show();
}

export async function setThumbarButtons() {
  const hasPreviousSong = await runJs('dzPlayer && !!dzPlayer.getPrevSong()');
  const hasNextSong = await runJs('dzPlayer && !!dzPlayer.getNextSong()');
  const isPlaying = await runJs('dzPlayer && dzPlayer.isPlaying()');

  const updated = win.setThumbarButtons([
    {
      icon: nativeImage.createFromPath(join(__dirname, '..', 'img', `previous${hasPreviousSong ? '' : '_inactive'}.png`)),
      click(){ runJs('dzPlayer.control.prevSong()'); }
    }, {
      icon: nativeImage.createFromPath(join(__dirname, '..', 'img', `${isPlaying ? 'pause' : 'play'}.png`)),
      click(){ runJs('dzPlayer.control.togglePause()'); }
    }, {
      icon: nativeImage.createFromPath(join(__dirname, '..', 'img', `next${hasNextSong ? '' : '_inactive'}.png`)),
      click(){ runJs('dzPlayer.control.nextSong()'); }
    }
  ]);
  if (updated) {
    log('Thumbnail Buttons', 'Updated buttons');
  } else {
    log('Thumbnail Buttons', 'Failed to update buttons');
  }
}

const UpdateReason = {
  MUSIC_CHANGED: 'music got changed',
  MUSIC_PAUSED: 'music got paused',
  MUSIC_PLAYED: 'music got played',
  MUSIC_TIME_CHANGED: 'current song time changed',
  MUSIC_NOT_RIGHT_TIME: 'song time wasn\'t the right one'
};

async function updateActivity(app: Electron.App, currentTimeChanged?: boolean) {
  setThumbarButtons();

  const client = RPC.client;
  // language=JavaScript
  const code = `(() => {
      const currentSong = dzPlayer.getCurrentSong();
      const albumId = currentSong?.ALB_ID;
      const trackId = dzPlayer.getSongId() || dzPlayer.getRadioId();
      const radioType = dzPlayer.getRadioType();
      const playerType = dzPlayer.getPlayerType();
      const mediaType = dzPlayer.getMediaType();
      const isLivestreamRadio = playerType === 'radio' && radioType === 'livestream';
      const playerInfo = document.querySelector('[data-testid="miniplayer_container"] .marquee-content')?.textContent;
      const trackName = dzPlayer.getSongTitle() + (currentSong?.VERSION ? ' ' + currentSong?.VERSION : '') ||
                        currentSong?.LIVESTREAM_TITLE || currentSong?.EPISODE_TITLE || playerInfo;
      const albumName = (!isLivestreamRadio ? dzPlayer.getAlbumTitle() : currentSong.LIVESTREAM_TITLE) ||
                        currentSong?.SHOW_NAME || playerInfo;
      const artists = currentSong?.ARTISTS?.map(art => art.ART_NAME)?.join(', ') || dzPlayer.getArtistName() ||
                      currentSong?.SHOW_NAME || playerInfo?.split(' · ')?.[1];
      const firstArtistId = currentSong?.ART_ID;
      const playing = dzPlayer.isPlaying();
      const songTime = Math.floor(dzPlayer.getDuration() * 1000);
      const timeLeft = Math.floor(dzPlayer.getRemainingTime() * 1000);
      const cover = currentSong?.LIVESTREAM_IMAGE_MD5 || currentSong?.EPISODE_IMAGE_MD5 ||
                    currentSong?.SHOW_ART_MD5 || dzPlayer.getCover();
      let coverType = 'misc';
      if (mediaType === 'song') coverType = 'cover';
      if (mediaType === 'episode') coverType = 'talk';
      const coverUrl = \`https://e-cdns-images.dzcdn.net/images/\${coverType}/\${cover}/256x256-000000-80-0-0.jpg\`;
      return JSON.stringify({
        albumId, trackId, mediaType, playerType, trackName, albumName, artists, playing, songTime, timeLeft, coverUrl,
        isLivestreamRadio, firstArtistId
      });
    })()`;
  runJs(code).then(async (r) => {
    const result: JSResult = JSON.parse(r);
    const realSongTime = result.songTime;
    if (currentTrack && !currentTrack?.songTime) currentTrack.songTime = realSongTime;

    if (
      currentTrack?.trackTitle !== result.trackName || currentTrack?.playing !== result.playing || currentTimeChanged === true ||
      currentTrack?.songTime !== realSongTime
    ) {
      let reason = '';
      if (currentTrack?.trackTitle !== result.trackName)
        reason = UpdateReason.MUSIC_CHANGED;
      else if (currentTrack?.playing !== result.playing)
        reason = result.playing ? UpdateReason.MUSIC_PLAYED : UpdateReason.MUSIC_PAUSED;
      else if (currentTimeChanged) reason = UpdateReason.MUSIC_TIME_CHANGED;
      else if (currentTrack?.songTime !== realSongTime) reason = UpdateReason.MUSIC_NOT_RIGHT_TIME;
      log('Activity', 'Updating because', reason);

      // @ts-expect-error Wrong type
      currentTrack = {
        trackId: result.trackId,
        trackTitle: result.trackName,
        trackArtists: result.playerType === 'mod' && !result.artists ? 'Unknown' : result.artists || result.playerType.replace(result.playerType[0], result.playerType[0].toUpperCase()),
        albumCover: result.coverUrl || '',
        albumTitle: result.albumName || result.trackName,
        playing: result.playing,
      };

      await setActivity({
        client,
        albumId: result.albumId,
        firstArtistId: result.firstArtistId,
        timeLeft: result.timeLeft,
        app,
        ...currentTrack,
        type: result.mediaType,
        songTime: realSongTime
      }).then(() => log('Activity', 'Updated'));
    }
    currentTrack.songTime = realSongTime;
    currentTrack.trackTitle = result.trackName;
    currentTrack.playing = result.playing;
  });
}

interface CurrentTrack {
  songTime: number,
  trackId: string,
  trackTitle: string,
  trackArtists: string,
  albumTitle: string,
  albumCover: string,
  playing: boolean,
  radioCover: string,
}

interface JSResult {
  songTime: number,
  timeLeft: number,
  trackName: string,
  albumId: number,
  playing: boolean,
  coverUrl?: string,
  playerType: 'track' | 'radio' | 'ad' | 'mod',
  artists: string,
  albumName: string,
  isLivestreamRadio: boolean,
  mediaType: string,
  trackId: string,
  firstArtistId: string;
}
