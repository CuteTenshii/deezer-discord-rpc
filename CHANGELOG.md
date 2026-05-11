# Changelog

## 1.3.8

* Removed adblocker which seemed to make login impossible. FYI audio ads should be still blocked.

## 1.3.7

* Add links on the RPC to the artist, track and album

## 1.3.6

* Upgraded packages
* Icon should now be shown on Linux
* Add support for customizable status name display (https://github.com/CuteTenshii/deezer-discord-rpc/pull/123)
* Fixed some CSS classes

## 1.3.5

* Fixed the RPC (well, this time it should be fixed [I hope])

## 1.3.4

* Fixed the updater downloading the wrong file

## 1.3.3

* Package should now be available on the AUR repository
* Fixed the tray icon not showing on Linux
* Fixed the RPC not showing at all (sorry 😭😭)

## 1.3.2

- Upgraded packages
- Fixed the RPC not updating in some cases
- Fixed MP3s not showing on the RPC

## 1.3.1

* Fixed some changes on the app

## 1.3.0

* Removed the "Playing" status, now it will always show "Listening to"
* Removed the "Only show if playing" option
* Updated Chrome user agent to version 133
* Updated packages
* Fixed some things

## 1.2.8

* Fixed the app not working because of Deezer and Discord changes
* Made the "Listening to" mode not needing your token anymore
* Fixed the "Don't close to tray" option not making the RPC disconnect when closing the app

## 1.2.7

* Added back and forward buttons (#53)
* Added option to not close to tray (#52)

## 1.2.6

* Fixed Google login (#44)
* Lock to single instance (#45)

## 1.2.5

* Fixed the tray icon not showing (#34)
* Upgraded packages
* Updated build script

## 1.2.4

* Fixed the RPC not working (yes, again.)

## 1.2.3

* Fixed the RPC not working
* Upgraded packages

## 1.2.2

* Upgraded packages
* Fixed macOS and Linux builds
* Added window size saver (the window will be the same size as the last time you closed it) (#18)

## 1.2.1

* Fixed some things
* Updated Electron to version ``28.1.0``

## 1.2.0

* Added thumbar buttons
* Fixed observers (new Deezer UI)
* Fixed OAuth2 login (Google, Facebook and Apple login)
* Updated Deezer logo

## 1.1.19

* Added start and end timestamp (your music will appear in the "Active Now" section)
* Changed the actual logo by the Deezer one and finally added an icon for the app
* Changed the way to check for music change
* Removed menu bar

## 1.1.18

* Removed local WS server
* Now using a 3rd-party library for Discord WS
* Spotify is now no longer used in the app for covers
* Radios covers are now re-working
* Optimized code and removed unused code

## 1.1.17

* Added support for radios, podcasts, and personal songs
* Fixed WebSocket disconnection error message which pops every 30 minutes
* Removed some Deezer API requests

## 1.1.16

* No more need to authenticate with a Spotify account for showing covers on "Listening to" mode
* Fixed startup error on macOS
* Removed protocol
* Edited RPC buttons
* Added support for radios
* Window will now be maximized on startup
* Menu bar is now visible only if you're on macOS

## 1.1.15

* Refactored the "Listening to" mode setup HTML
* Added buttons to the "Listening to" mode
* Fixed track info not showing on certain titles
* Removed small image
* Added React DevTools

## 1.1.14

* Fixed the "Listening to" mode not working
* When you quit the app, the WebSocket connection will be stopped

## 1.1.13

* Added start and end timestamps
* If a second instance is launched, the main window will be showed
* Added session resuming to the WebSocket
* Updated capabilities bitfield (fixes the "Listening to" mode not working)
* Updated the reconnect option in the tray menu, now there's the option for the RPC and the WebSocket

## 1.1.12

* Created a local WebSocket server (ws://localhost:5432)
  > tip: you can use this to create Discord mods plugins for controlling Deezer player
* Optimized code using ``window.dzPlayer`` property
* Added some types
## 1.1.11

* The "Listening to" status works perfectly now

## 1.1.10

* Fixed app not loading anything on Windows and Linux (I was on macOS when I ran the build, so I didn't have any problems, sorry)

## 1.1.9

* Fixed small icon not showing
* Window will now show at the center of the screen at launch
* FIxed song time not being the right one sometimes
* You can re-open window if an instance is already launched
* Updated "Player > Play/Pause" menu item shortcut to "Shift+Space"

## 1.1.8

* The RPC now updates when the song time changes
* Added a preload script
* Added a menu

## 1.1.7

* **Added support for macOS and Linux!!**
* Added a build CLI
* Added icons sizes
* Updated updater to support new files

## 1.1.6

* Tries to resume WebSocket connection if you got disconnected from it
* Inits tray icon before the window (before it was the opposite)

## 1.1.5

* Added an ad-blocker, this means you can listen to Deezer without ads if you have Deezer Free!
* Added a debug indicator
* Updated user agents

## 1.1.4

* Retry with track instead of album ([``ba88160``](https://github.com/JustYuuto/deezer-discord-rpc/commit/ba881603405bb9117e98616d5ae021e85eef99e8) and [``c96f7ae``](https://github.com/JustYuuto/deezer-discord-rpc/commit/c96f7ae10d8963ddb9f57518082f904bdfb43ce5))

## 1.1.3

* Use album title instead of track title ([``a3d6e2f``](https://github.com/JustYuuto/deezer-discord-rpc/commit/a3d6e2fe44e5185e7fa00fc5fcfa1a998eeeec79))

## 1.1.2

* Fixed "Object has been destroyed" error when exiting the app and the window was open ([``3949012``](https://github.com/JustYuuto/deezer-discord-rpc/commit/39490125c850070dd080f06633de8e60acf44427))
* Added a small image on the "Listening to" status ([``65089b9``](https://github.com/JustYuuto/deezer-discord-rpc/commit/65089b905569b04cd7bd195e39291df28d3b8345))
* Now updates RPC if music is playing/paused ([``b9ecb67``](https://github.com/JustYuuto/deezer-discord-rpc/commit/b9ecb678235b92bb266647511bcd68292ba229ef))

## 1.1.1

* Automatically updating the Spotify access token

## 1.1.0: WebSocket Update

* We are now using Electron Builder for building the app; you can uninstall the old one
* You can now use a "Listening to" status (like Spotify) on your profile!
* Added tray tooltip options to change the text
* Added a tray menu option to reconnect the RPC
* Optimized the code **a lot** so now it is more readable

## 1.0.9

* Added a tray menu submenu to select the tray icon tooltip text ([``ca6401b``](https://github.com/JustYuuto/deezer-discord-rpc/commit/ca6401b6fe28bdf7caabe9b01c0b2356b1d5e0fa))

## 1.0.8

* Update checking on startup

## 1.0.7

* Updated Electron to version `23.1.0`
* The tray tooltip now updates and shows the current song playing
* Added a tray menu option to reconnect the RPC if it disconnected 

## 1.0.6

* That was for testing the updater ^^" ([``9018e05``](https://github.com/JustYuuto/deezer-discord-rpc/commit/9018e05acfef496928ab8fe64f71b023227a90b2))

## 1.0.5

* Fixed app not exiting when clicking on "Quit" in the tray menu ([``60ae06b``](https://github.com/JustYuuto/deezer-discord-rpc/commit/60ae06b9e430fa083376be4899806973c01adacb))
* Added an update checker when app starts ([``11f72f1``](https://github.com/JustYuuto/deezer-discord-rpc/commit/11f72f1b90a4997cabaec09bcfaabe3afc48c40e))

## 1.0.4

* Updated custom user-agent to Chrome 110 ([``1d1e24c``#diff-bf8986a545cc729a5e76191a9d4afa2f63cf28a132f238413ce8349b7da44813L27-R27](https://github.com/JustYuuto/deezer-discord-rpc/commit/1d1e24cc87d90026b03fff24515656c40830a22d#diff-bf8986a545cc729a5e76191a9d4afa2f63cf28a132f238413ce8349b7da44813L27-R27))
* Made in-app updater working when clicking on the notification ([``1d1e24c``#diff-bf8986a545cc729a5e76191a9d4afa2f63cf28a132f238413ce8349b7da44813R55-R57](https://github.com/JustYuuto/deezer-discord-rpc/commit/1d1e24cc87d90026b03fff24515656c40830a22d#diff-bf8986a545cc729a5e76191a9d4afa2f63cf28a132f238413ce8349b7da44813R55-R57))
* Added a config file ([``4e6945d``](https://github.com/JustYuuto/deezer-discord-rpc/commit/4e6945d8c3c14ab8ac2678d28c53ee78885a66ea))
* Made the RPC not visible if the music is not playing ([``e9a8332``](https://github.com/JustYuuto/deezer-discord-rpc/commit/e9a83327dfe791fbc86c602116416a3407567ca8))

## 1.0.3

The tray icon wasn't loaded

## 1.0.2

Added a setup for installing the app (finally)

## 1.0.1

A lot of changes :p

## 1.0.0

First release
