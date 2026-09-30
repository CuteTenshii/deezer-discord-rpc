<div align="center">
    <h1>Deezer Discord RPC</h1>
    <a href="https://github.com/CuteTenshii/deezer-discord-rpc/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/CuteTenshii/deezer-discord-rpc?style=for-the-badge"></a>
    <a href="https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest"><img alt="GitHub release (latest by date)" src="https://img.shields.io/github/downloads/CuteTenshii/deezer-discord-rpc/latest/total?style=for-the-badge"></a>
    <a href="https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest"><img alt="GitHub release (latest by date including pre-releases)" src="https://img.shields.io/github/v/release/CuteTenshii/deezer-discord-rpc?include_prereleases&label=latest%20release&style=for-the-badge"></a>
    <a href="https://github.com/CuteTenshii/deezer-discord-rpc/commits"><img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/w/CuteTenshii/deezer-discord-rpc?style=for-the-badge"></a>
    <hr />
    <p>A Discord RPC for showing the music you're listening to on Deezer (like the Spotify integration).</p>
    <a href="https://github.com/CuteTenshii/deezer-discord-rpc/wiki/RPC-doesn't-show%3F">RPC doesn't show?</a>
</div>

## Features

* Updates instantly
* Shows the song title, the song artist(s), the album name and cover, and the song duration
* Add links to the song, the artist and the album, on the RPC
* Shows a "Listen on Deezer" button that opens the song on Deezer, if supported. **You cannot see this button on your own profile due to Discord restrictions.**
* Includes an in-app updater
* Hides the activity if no song is playing
* Includes an ad-blocker, so it can block Deezer ads, Google Analytics, Sentry requests...
* Supports songs, radios, personal songs (MP3s), podcasts

<table>
<tr>
<td align="center"><img src=".github/screenshots/rpc.png" alt="RPC on profile"><br /><i>RPC on profile</i></td>
</tr>
<tr>
<td align="center"><img src=".github/screenshots/tray_menu.png" alt="RPC on profile"><br /><i>Tray menu. See below for options explanations</i></td>
</tr>
</table>

## Installation

### Arch Linux (AUR)

You can install the [`deezer-discord-rpc-bin`](https://aur.archlinux.org/packages/deezer-discord-rpc-bin) package from the AUR using your favorite AUR helper, such as `yay` or `paru`:

```bash
yay -S deezer-discord-rpc-bin
```

### Homebrew (macOS)

You can install the app using Homebrew on macOS:

```bash
brew install --cask cutetenshii/stuff/deezer-discord-rpc
```

### NixOS (flake)

Add the flake to your inputs:

```nix
inputs.deezer-discord-rpc.url = "github:CuteTenshii/deezer-discord-rpc";
```

Then install the package in your configuration:

```nix
environment.systemPackages = [
  inputs.deezer-discord-rpc.packages.${pkgs.stdenv.hostPlatform.system}.default
];
```

### Pre-built Binaries

| **Platform**                     | **Download**                                                                                                                                                                                                                                                         |
|----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Windows**                      | [![](https://img.shields.io/github/downloads/CuteTenshii/deezer-discord-rpc/latest/DeezerDiscordRPC-win-x64.exe?style=for-the-badge)](https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-win-x64.exe)                       |
| **Debian/Ubuntu**                | [![](https://img.shields.io/github/downloads/CuteTenshii/deezer-discord-rpc/latest/DeezerDiscordRPC-linux-amd64.deb?style=for-the-badge&logo=debian)](https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-linux-amd64.deb)   |
| **Fedora**                       | [![](https://img.shields.io/github/downloads/CuteTenshii/deezer-discord-rpc/latest/DeezerDiscordRPC-linux-x86_64.rpm?style=for-the-badge&logo=fedora)](https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-linux-x86_64.rpm) |
| `.snap`                          | [![](https://img.shields.io/github/downloads/CuteTenshii/deezer-discord-rpc/latest/DeezerDiscordRPC-linux-amd64.snap?style=for-the-badge)](https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-linux-amd64.snap)             |
| `.AppImage`                      | [![](https://img.shields.io/github/downloads/CuteTenshii/deezer-discord-rpc/latest/DeezerDiscordRPC-linux-x86_64.AppImage?style=for-the-badge)](https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-linux-x86_64.AppImage)   |
| **macOS** (arm64, Apple Silicon) | [![](https://img.shields.io/github/downloads/CuteTenshii/deezer-discord-rpc/latest/DeezerDiscordRPC-mac-arm64.dmg?style=for-the-badge&logo=apple)](https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-mac-arm64.dmg)        |
| **macOS** (x64, Intel)           | [![](https://img.shields.io/github/downloads/CuteTenshii/deezer-discord-rpc/latest/DeezerDiscordRPC-mac-x64.dmg?style=for-the-badge&logo=apple)](https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-mac-x64.dmg)            |

## Building from Source

1. Clone the repository: `git clone https://github.com/CuteTenshii/deezer-discord-rpc`
2. Install the dependencies with bun (package manager): `bun install`
3. To build the app for release, run: `bun run build`
4. If you want to run it in development mode, run: `bun run start`

## Tray Menu Options

- **Status name:** The status that will show on Discord. For comparison, Spotify integration uses the artists.<br />
  ![](.github/screenshots/status_name.png)<br />
  ![](.github/screenshots/status_name_options.png)
- **Tooltip text:** The text that will show when you hover the Deezer tray icon.<br />
  ![](.github/screenshots/tooltip_text.png)<br />
  ![](.github/screenshots/tooltip_text_options.png)
- **Don't close to tray:** when closing the app, should it be completely closed (enabled) or kept running in the background? (default, disabled)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=CuteTenshii/deezer-discord-rpc&type=Date)](https://star-history.com/#CuteTenshii/deezer-discord-rpc&Date)

## Contributors

[![Contributors](https://contrib.rocks/image?repo=CuteTenshii/deezer-discord-rpc)](https://github.com/CuteTenshii/deezer-discord-rpc/graphs/contributors)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
