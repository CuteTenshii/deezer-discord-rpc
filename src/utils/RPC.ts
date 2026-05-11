import * as RPC from '@xhayper/discord-rpc';
import { log } from './Log';
import { clientId } from '../variables';

export const client = new RPC.Client({
  transport: {
    type: 'ipc',
  },
  clientId
});

export function connect() {
  client.on('ready', () => {
    log('RPC', `Authed for user @${client.user?.username}`);
  });

  client.on('disconnected', () => {
    log('RPC', 'Disconnected, trying to reconnect...');
    const attempts = 0;
    const attemptsInterval = setInterval(() => {
      client.login().then(() => {
        clearInterval(attemptsInterval);
      }).catch(console.error);
      log('RPC', `Reconnecting... Attempt ${attempts + 1}`);
      if (attempts >= 5) {
        clearInterval(attemptsInterval);
      }
    }, 8000);
  });

  client.login().catch(console.error);
}

export async function disconnect() {
  log('RPC', 'Disconnecting...');
  await client.user?.clearActivity(process.pid);
  await client.destroy().then(() => log('RPC', 'Disconnected'));
}
