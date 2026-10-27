import * as RPC from '@xhayper/discord-rpc';
import { log } from './Log';
import { clientId } from '../variables';

const RECONNECT_INTERVAL_MS = 5000;

const readyListeners: (() => void)[] = [];
let reconnectTimer: ReturnType<typeof setInterval> | undefined;
let loggingIn = false;
let lastLoginFailed = false;

export let client = createClient();

function createClient() {
  const newClient = new RPC.Client({
    transport: {
      type: 'ipc',
    },
    clientId
  });
  newClient.on('ready', () => {
    log('RPC', `Authed for user @${newClient.user?.username}`);
    readyListeners.forEach((listener) => listener());
  });
  return newClient;
}

/** Runs on every successful connection, including reconnects, which replace {@link client}. */
export function onReady(listener: () => void) {
  readyListeners.push(listener);
}

export function connect() {
  login();
  // The library does not emit `disconnected` when Discord closes the pipe, so the connection is checked instead.
  reconnectTimer = setInterval(() => {
    if (!client.isConnected) login(true);
  }, RECONNECT_INTERVAL_MS);
}

async function login(retry = false) {
  if (loggingIn) return;
  loggingIn = true;
  if (retry) {
    // A client whose pipe Discord closed keeps the dead socket, so retries need a new one.
    await client.destroy().catch(() => undefined);
    client = createClient();
  }
  try {
    await client.login();
    lastLoginFailed = false;
  } catch (e) {
    if (!lastLoginFailed) log('RPC', `Could not connect, retrying every ${RECONNECT_INTERVAL_MS / 1000} seconds:`, String(e));
    lastLoginFailed = true;
  } finally {
    loggingIn = false;
  }
}

export async function disconnect() {
  log('RPC', 'Disconnecting...');
  clearInterval(reconnectTimer);
  reconnectTimer = undefined;
  await client.user?.clearActivity(process.pid);
  await client.destroy().then(() => log('RPC', 'Disconnected'));
}
