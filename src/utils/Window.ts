import { userAgent } from '../variables';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import * as Config from './Config';
import * as RPC from './RPC';
import { log } from './Log';
import { runJs, wait } from '../functions';
import { BrowserWindow, ipcMain, nativeImage } from 'electron';
import { setActivity } from './Activity';

const deezerUrl = 'https://account.deezer.com/login/';
const offlinePagePath = join(__dirname, '..', 'offline.html');
// Chromium reports this when a navigation is replaced by another one, which is not a connection failure.
const ERR_ABORTED = -3;

// Deezer re-renders the player and silently detaches the MutationObservers, so a poll keeps Discord in sync anyway.
const ACTIVITY_POLL_MS = 1500;
const ACTIVITY_DEBOUNCE_MS = 300;
// Discord allows about 5 SET_ACTIVITY calls per 20 seconds.
const RATE_CAPACITY = 4;
const RATE_REFILL_MS = 5000;
const CLEARED_ACTIVITY = 'cleared';

export let win: BrowserWindow;
let isQuitting = false;
// Incremented on every page load so a watch started for an earlier page stops polling.
let playerWatchId = 0;

let activityPoll: ReturnType<typeof setInterval> | undefined;
let pendingUpdate: ReturnType<typeof setTimeout> | undefined;
let pendingTimeChanged = false;
// A read that resolves after a newer one started is stale and must not overwrite Discord.
let updateSeq = 0;
// What Discord is confirmed to show; it only advances on a successful send, so failed updates get retried.
let sentKey = '';
let sendInFlight = false;
let rateTokens = RATE_CAPACITY;
let rateLastRefill = Date.now();

const deezerDomain = 'deezer.com';
const authenticationDomains = ['facebook.com', 'apple.com'];
const trackerDomains = [
  'doubleclick.net',
  'google-analytics.com',
  'googlesyndication.com',
  'googletagmanager.com',
  'sentry.io',
  'sentry-cdn.com',
];

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

function isHostOrSubdomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isTrustedDeezerUrl(value: string): boolean {
  const url = parseStrictHttpsUrl(value);
  return !!url && isHostOrSubdomain(url.hostname, deezerDomain);
}

function isTrustedAuthenticationUrl(value: string): boolean {
  const url = parseStrictHttpsUrl(value);
  return !!url && (url.hostname === 'accounts.google.com' ||
    authenticationDomains.some(domain => isHostOrSubdomain(url.hostname, domain)));
}

function isBlockedTrackerUrl(value: string): boolean {
  const url = parseStrictHttpsUrl(value);
  return !!url && trackerDomains.some(domain => isHostOrSubdomain(url.hostname, domain));
}

function isTrustedIpcSender(event: Electron.IpcMainEvent): boolean {
  return event.sender === win.webContents && isTrustedDeezerUrl(event.senderFrame?.url ?? '');
}

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
      preload: resolve(__dirname, '..', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
    }
  });
  if (width === 1920 && height === 1080) win.maximize();
  win.focus();
  win.show();
  win.setMenuBarVisibility(process.platform === 'darwin');

  const windowSession = win.webContents.session;
  windowSession.setPermissionCheckHandler(() => false);
  windowSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  windowSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: isBlockedTrackerUrl(details.url) });
  });
  windowSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestUrl = parseStrictHttpsUrl(details.url);
    if (requestUrl && isHostOrSubdomain(requestUrl.hostname, deezerDomain))
      details.requestHeaders['User-Agent'] = userAgent;
    if (requestUrl?.hostname === 'www.deezer.com' && requestUrl.pathname === '/ajax/gw-light.php' &&
        requestUrl.searchParams.get('method') === 'deezer.adConfig')
      return callback({ cancel: true });
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  const guardMainNavigation = (event: { preventDefault: () => void }, url: string) => {
    if (isTrustedDeezerUrl(url)) return;
    event.preventDefault();
    log('Window', 'Blocked navigation outside Deezer.');
  };
  win.webContents.on('will-navigate', guardMainNavigation);
  win.webContents.on('will-redirect', guardMainNavigation);

  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  win.webContents.setWindowOpenHandler((details) => {
    if (isTrustedAuthenticationUrl(details.url)) {
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
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            webviewTag: false,
            navigateOnDragDrop: false,
          },
        }
      };
    } else {
      log('Window', 'Blocked an untrusted popup.');
      return { action: 'deny' };
    }
  });

  win.webContents.on('did-create-window', (childWindow) => {
    const guardAuthenticationNavigation = (event: { preventDefault: () => void }, url: string) => {
      if (isTrustedAuthenticationUrl(url) || isTrustedDeezerUrl(url)) return;
      event.preventDefault();
      log('Window', 'Blocked navigation outside the authentication flow.');
    };
    childWindow.webContents.on('will-navigate', guardAuthenticationNavigation);
    childWindow.webContents.on('will-redirect', guardAuthenticationNavigation);
    childWindow.webContents.setWindowOpenHandler(() => {
      log('Window', 'Blocked a popup from the authentication flow.');
      return { action: 'deny' };
    });
  });

  win.on('resized', () => {
    const [w, h] = win.getSize();
    Config.set(app, 'window_width', w);
    Config.set(app, 'window_height', h);
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
    stopActivityPoll();
    showOfflinePage(errorDescription);
  });

  // The player hooks live in the page, so every full load of Deezer (login redirect, reconnect) needs them again.
  win.webContents.on('did-finish-load', () => {
    playerWatchId++;
    stopActivityPoll();
    if (isTrustedDeezerUrl(win.webContents.getURL())) watchForPlayer(app, playerWatchId);
  });

  // Discord drops the activity when the connection closes, so resend it once the client is back.
  RPC.client.on('ready', () => {
    sentKey = '';
    scheduleActivityUpdate(app);
  });

  // Without this, closing to tray would also veto quits coming from the OS (logout, macOS Cmd+Q).
  app.on('before-quit', () => {
    isQuitting = true;
  });

  // Must stay synchronous: Electron ignores preventDefault() once the handler has yielded.
  win.on('close', (e) => {
    if (isQuitting) return;
    if (Config.get<boolean>(app, 'dont_close_to_tray')) {
      stopActivityPoll();
      RPC.disconnect().catch(console.error);
      return;
    }
    e.preventDefault();
    win.hide();
  });

  ipcMain.on('update_activity', (event, currentTimeChanged) => {
    if (!isTrustedIpcSender(event) || typeof currentTimeChanged !== 'boolean') return;
    scheduleActivityUpdate(app, currentTimeChanged);
  });
  ipcMain.on('nav_back', (event) => {
    if (isTrustedIpcSender(event) && win.webContents.navigationHistory.canGoBack())
      win.webContents.navigationHistory.goBack();
  });
  ipcMain.on('nav_forward', (event) => {
    if (isTrustedIpcSender(event) && win.webContents.navigationHistory.canGoForward())
      win.webContents.navigationHistory.goForward();
  });
  ipcMain.on('retry_load', (event) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return;
    const senderUrl = new URL(event.senderFrame.url);
    senderUrl.search = '';
    senderUrl.hash = '';
    if (senderUrl.href === pathToFileURL(offlinePagePath).href) loadDeezer();
  });

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

async function watchForPlayer(app: Electron.App, watchId: number) {
  while (watchId === playerWatchId && !win.isDestroyed()) {
    // Rejects while the page is navigating; the next tick simply tries again.
    const element = await runJs('document.querySelector(\'[data-testid="item_title"]\')').catch(() => null);
    if (element) {
      await injectPlayerHooks().catch(reason => log('Window', 'Failed to initialize the player:', String(reason)));
      startActivityPoll(app);
      return;
    }
    await wait(50);
  }
}

function startActivityPoll(app: Electron.App) {
  stopActivityPoll();
  activityPoll = setInterval(() => {
    if (win.isDestroyed()) return stopActivityPoll();
    scheduleActivityUpdate(app);
  }, ACTIVITY_POLL_MS);
}

function stopActivityPoll() {
  clearInterval(activityPoll);
  activityPoll = undefined;
}

async function injectPlayerHooks() {
  await runJs(`document.querySelector('[data-testid="miniplayer_container"] .slider').addEventListener('click', () => deezerRpc.updateActivity(true))
         const trackObserver = new MutationObserver(() => deezerRpc.updateActivity(false));
         trackObserver.observe(document.querySelector('.marquee-content > [data-testid="item_title"]'), { childList: true, subtree: true, characterData: true });
         const playObserver = new MutationObserver(() => deezerRpc.updateActivity(false));
         playObserver.observe(document.querySelector('.chakra-button__group > button[data-testid^="play_button_"]'), { attributes: true, childList: false, subtree: false });
         document.querySelector('.chakra-button__group > button[data-testid^="play_button_"]').addEventListener('click', () => deezerRpc.updateActivity(false));`);
  await runJs(`const chakraStack = document.querySelector('#dzr-app > .naboo > div[class*="css-"] > div[class*="css-"] a.chakra-link');
         const navContainer = document.createElement('div');
         navContainer.style.display = 'flex';
         navContainer.style.justifyContent = 'space-around';
         const backButton = document.createElement('button');
         backButton.addEventListener('click', () => deezerRpc.navigateBack());
         backButton.textContent = '<';
         backButton.style.transform = 'scale(2, 4)';
         backButton.style.opacity = '30%';
         const forwardButton = document.createElement('button');
         forwardButton.addEventListener('click', () => deezerRpc.navigateForward());
         forwardButton.textContent = '>';
         forwardButton.style.transform = 'scale(2, 4)';
         forwardButton.style.opacity = '30%';
         navContainer.appendChild(backButton);
         navContainer.appendChild(forwardButton);
         chakraStack.replaceWith(navContainer);`);
  await setThumbarButtons();
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

function takeRateToken(): boolean {
  const refills = Math.floor((Date.now() - rateLastRefill) / RATE_REFILL_MS);
  if (refills > 0) {
    rateTokens = Math.min(RATE_CAPACITY, rateTokens + refills);
    rateLastRefill += refills * RATE_REFILL_MS;
  }
  if (rateTokens < 1) return false;
  rateTokens--;
  return true;
}

// Skipping tracks fires a burst of events; only the state after the burst is worth sending.
function scheduleActivityUpdate(app: Electron.App, currentTimeChanged = false) {
  if (currentTimeChanged) pendingTimeChanged = true;
  clearTimeout(pendingUpdate);
  pendingUpdate = setTimeout(() => {
    pendingUpdate = undefined;
    const timeChanged = pendingTimeChanged;
    pendingTimeChanged = false;
    updateActivity(app, timeChanged);
  }, ACTIVITY_DEBOUNCE_MS);
}

async function updateActivity(app: Electron.App, currentTimeChanged: boolean) {
  const seq = ++updateSeq;
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
  const r = await runJs(code).catch(() => null);
  if (!r || seq !== updateSeq) return;
  const result: JSResult = JSON.parse(r);

  // The duration is part of the key because Deezer reports 0 until the track has loaded.
  const desiredKey = result.playing ? `${result.trackId}|${result.trackName}|${result.songTime}` : CLEARED_ACTIVITY;
  if (desiredKey === sentKey && !currentTimeChanged) return;
  if (sendInFlight || !client.isConnected || !takeRateToken()) {
    if (currentTimeChanged) pendingTimeChanged = true;
    return;
  }

  let reason: string;
  if (!result.playing) reason = UpdateReason.MUSIC_PAUSED;
  else if (sentKey === CLEARED_ACTIVITY) reason = UpdateReason.MUSIC_PLAYED;
  else if (currentTimeChanged) reason = UpdateReason.MUSIC_TIME_CHANGED;
  else if (sentKey.startsWith(`${result.trackId}|${result.trackName}|`)) reason = UpdateReason.MUSIC_NOT_RIGHT_TIME;
  else reason = UpdateReason.MUSIC_CHANGED;
  log('Activity', 'Updating because', reason);
  setThumbarButtons();

  sendInFlight = true;
  const sent = await setActivity({
    client,
    albumId: result.albumId,
    firstArtistId: result.firstArtistId,
    timeLeft: result.timeLeft,
    app,
    trackId: result.trackId,
    trackTitle: result.trackName,
    trackArtists: result.playerType === 'mod' && !result.artists ? 'Unknown' : result.artists || result.playerType.replace(result.playerType[0], result.playerType[0].toUpperCase()),
    albumCover: result.coverUrl || '',
    albumTitle: result.albumName || result.trackName,
    playing: result.playing,
    type: result.mediaType,
    songTime: result.songTime,
  }).then(() => true).catch((reason) => {
    log('Activity', 'Update failed, retrying:', reason?.toString() ?? 'Unknown error');
    return false;
  });
  sendInFlight = false;

  if (sent) {
    sentKey = desiredKey;
    log('Activity', 'Updated');
  } else if (currentTimeChanged) {
    pendingTimeChanged = true;
  }
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
