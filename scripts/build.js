/* eslint @typescript-eslint/no-require-imports: 0 */
const { build } = require('electron-builder');
const { existsSync, rmSync } = require('fs');
const { resolve, join, basename } = require('path');
const { embedUpdateInformation } = require('./appimage');
const { repository } = require('../package.json');

// If the Electron app build folder exists, we need to delete it
if (existsSync(resolve('dist'))) {
  rmSync(resolve('dist'), { recursive: true });
  console.log('Removed "dist" directory');
}

// App build
console.log('Building setup...');
/**
 * @type {import('electron-builder').Configuration} Configuration
 */
const config = {
  appId: 'com.github.yuuto.deezerdiscordrpc',
  productName: 'Deezer Discord RPC',
  mac: {
    category: 'public.app-category.music',
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    icon: join(__dirname, '..', 'src', 'img', 'app.icns'),
  },
  win: {
    target: 'nsis',
    icon: join(__dirname, '..', 'src', 'img', 'app.ico'),
  },
  linux: {
    category: 'Audio;AudioVideo',
    syncDesktopName: true,
    target: ['snap', 'deb', 'AppImage', 'rpm'],
    publish: null,
    icon: join(__dirname, '..', 'src', 'img', 'app.png'),
  },
  toolsets: {
    // The legacy runtime links against the host glibc and needs libfuse2;
    // 1.0.3 ships the static type-2 runtime so the AppImage runs without them.
    appimage: '1.0.3',
  },
  artifactName: 'DeezerDiscordRPC-${os}-${arch}.${ext}',
  files: [
    '!src/*',
    '!src/**/*',
    'build/package.json',
    'build/src/*',
    'build/src/**/*'
  ]
};

const lastArg = process.argv.pop();
const specifiedOS = ['windows', 'macos', 'linux'].includes(lastArg) ? lastArg : undefined;
if (specifiedOS) {
  console.log(`Building for ${specifiedOS}...`);
  if (specifiedOS === 'windows') {
    // @ts-expect-error Readonly property
    config.mac = undefined;
    // @ts-expect-error Readonly property
    config.linux = undefined;
  } else if (specifiedOS === 'macos') {
    // @ts-expect-error Readonly property
    config.linux = undefined;
    // @ts-expect-error Readonly property
    config.win = undefined;
  } else if (specifiedOS === 'linux') {
    // @ts-expect-error Readonly property
    config.mac = undefined;
    // @ts-expect-error Readonly property
    config.win = undefined;
  }
} else if (process.platform === 'win32') {
  // @ts-expect-error Readonly property
  config.mac = undefined;
  // @ts-expect-error Readonly property
  config.linux = undefined;
}

const [, owner, repo] = repository.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);

build({
  config,
  publish: 'never'
}).then((artifacts) => {
  // Points AppImage update tools at the .zsync file CI publishes next to the AppImage on each release.
  for (const appImage of artifacts.filter((artifact) => artifact.endsWith('.AppImage'))) {
    embedUpdateInformation(appImage, `gh-releases-zsync|${owner}|${repo}|latest|${basename(appImage)}.zsync`);
    console.log(`Embedded update information in ${basename(appImage)}`);
  }
  console.log('\nSetup built in the "dist" folder.');
});
