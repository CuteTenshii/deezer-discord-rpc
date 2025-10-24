import * as RPC from '@xhayper/discord-rpc';
import { log } from './Log';
import { clientId } from '../variables';

export const client = new RPC.Client({
  transport: {
    type: 'ipc',
  },
  clientId
});

let reconnecting = false;

export function connect() {
  client.on('ready', () => {
    log('RPC', `Authed for user @${client.user?.username}`);
    reconnecting = false;
  });

  client.on('disconnected', () => {
    log('RPC', 'Disconnected, trying to reconnect...');
    if (reconnecting) return;
    reconnecting = true;
    let attempts = 0;
    const attemptsInterval = setInterval(() => {
      client.login().then(() => {
        clearInterval(attemptsInterval);
        reconnecting = false;
      }).catch(console.error);
      attempts++;
      log('RPC', `Reconnecting... Attempt ${attempts}`);
      if (attempts >= 5) {
        clearInterval(attemptsInterval);
        reconnecting = false;
      }
    }, 8000);
  });

  client.login().catch(console.error);
}

export async function disconnect() {
  log('RPC', 'Disconnecting...');
  await client.user.clearActivity(process.pid);
  await client.destroy().then(() => log('RPC', 'Disconnected'));
}
