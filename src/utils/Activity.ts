import * as Config from './Config';
import { tray } from './Tray';
import { version } from '../../package.json';
import { ActivityType } from 'discord-api-types/v10';

export async function setActivity({
  timeLeft, playing, client, albumTitle, albumId, trackArtists, trackTitle, albumCover, app, type, trackId, songTime,
  firstArtistId,
}: ActivityOptions) {
  const tooltipText = Config.get<string>(app, 'tooltip_text');
  const statusName = Config.get<string>(app, 'status_name');
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
  if (!client) return;
  if (!playing) return await client.user.clearActivity();

  const getTrackLink = () => {
    switch (type) {
      case 'song':
        return `https://www.deezer.com/track/${trackId}`;
      case 'episode':
        return `https://www.deezer.com/episode/${trackId}`;
    }
  };

  const getTrackTitle = () => {
    if (trackTitle.length == 1) return trackTitle.concat(' ');
    return trackTitle;
  };

  const getStatusName = () => {
    switch (statusName) {
      case 'song_title':
        return trackTitle;
      case 'artists_song':
        return trackArtists;
      case 'artists_and_title':
        return `${trackArtists} - ${trackTitle}`;
      case 'title_and_artists':
        return `${trackTitle} - ${trackArtists}`;
      default:
        return 'Deezer';
    }
  };

  const trackLink = getTrackLink();
  const button = (trackLink && parseInt(trackId) > 0) && { label: 'Play on Deezer', url: trackLink };
  const isLivestream = (Date.now() + timeLeft) < Date.now();
  const playedTime = Date.now() - songTime + timeLeft;

  client.user.setActivity({
    type: ActivityType.Listening,
    name: getStatusName(),
    details: getTrackTitle(),
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
  }).catch(() => {});
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
