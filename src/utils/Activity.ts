import * as Config from './Config';
import { tray } from './Tray';
import { version } from '../../package.json';
import { ActivityType, StatusDisplayType } from 'discord-api-types/v10';

const getTrackLink = (type: string, trackId: string) => {
  switch (type) {
    case 'song':
      return `https://www.deezer.com/track/${trackId}`;
    case 'episode':
      return `https://www.deezer.com/episode/${trackId}`;
  }
};

const getTrackTitle = (trackTitle: string) => {
  if (trackTitle.length === 1) return trackTitle.concat(' ');
  return trackTitle;
};

export async function setActivity({
  timeLeft, playing, client, albumTitle, albumId, trackArtists, trackTitle, albumCover, app, type, trackId, songTime,
  firstArtistId,
}: ActivityOptions) {
  if (!client?.user || !client.isConnected) throw new Error('Not connected to Discord');
  const statusName = Config.get<string>(app, 'status_name');

  if (tray) {
    const tooltipText = Config.get<string>(app, 'tooltip_text');
    switch (tooltipText) {
      case 'app_name':
        tray.setToolTip('Deezer Discord RPC');
        break;
      case 'app_version':
        tray.setToolTip(`Version ${version}`);
        break;
      case 'app_name_and_version':
        tray.setToolTip(`Deezer Discord RPC version ${version}`);
        break;
      case 'artists_and_title':
        tray.setToolTip(`${trackArtists} - ${trackTitle}`);
        break;
      case 'title_and_artists':
        tray.setToolTip(`${trackTitle} - ${trackArtists}`);
        break;
    }
  }
  if (!playing) return client.user.clearActivity();

  const trackLink = getTrackLink(type, trackId);
  const button = (trackLink && Number.parseInt(trackId) > 0) ?
    { label: 'Play on Deezer', url: trackLink } :
    undefined;
  const isLivestream = (Date.now() + timeLeft) < Date.now();
  const playedTime = Date.now() - songTime + timeLeft;

  // The name is also the app name on the activity card, so only statuses no other field holds replace it.
  const getStatus = (): { name: string, statusDisplayType: StatusDisplayType } => {
    switch (statusName) {
      case 'song_title':
        return { name: 'Deezer', statusDisplayType: StatusDisplayType.Details };
      case 'artists_song':
        return { name: 'Deezer', statusDisplayType: StatusDisplayType.State };
      case 'artists_and_title':
        return { name: `${trackArtists} - ${trackTitle}`, statusDisplayType: StatusDisplayType.Name };
      case 'title_and_artists':
        return { name: `${trackTitle} - ${trackArtists}`, statusDisplayType: StatusDisplayType.Name };
      default:
        return { name: 'Deezer', statusDisplayType: StatusDisplayType.Name };
    }
  };

  // Rejections (e.g. Discord's rate limit) reach the caller so it can retry instead of assuming the update landed.
  return client.user.setActivity({
    type: ActivityType.Listening,
    ...getStatus(),
    details: getTrackTitle(trackTitle),
    detailsUrl: trackLink,
    state: trackArtists,
    stateUrl: firstArtistId ? `https://www.deezer.com/artist/${firstArtistId}` : undefined,
    largeImageKey: albumCover,
    largeImageText: albumTitle,
    largeImageUrl: albumId ? `https://www.deezer.com/album/${albumId}` : undefined,
    instance: false,
    startTimestamp: playedTime,
    [isLivestream ? 'startTimestamp' : 'endTimestamp']: Date.now() + timeLeft,
    buttons: button ? [button] : undefined,
  });
}

interface ActivityOptions {
  client: import('@xhayper/discord-rpc').Client;
  albumId: number;
  trackId: string;
  playing: boolean;
  timeLeft: number,
  trackTitle: string;
  trackArtists: string;
  albumCover: string;
  albumTitle: string;
  app: Electron.App;
  type: string,
  songTime: number;
  firstArtistId: string;
}
