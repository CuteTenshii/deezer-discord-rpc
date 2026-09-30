import { writeFile } from 'fs/promises';
import { version, description, license } from '../package.json';
import { createHash } from 'crypto';

const downloadUrl = 'https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-linux-amd64.deb';

// Both digests are computed from one download so they always describe the same file.
async function getChecksums() {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`);
  if (!res.body) throw new Error('No response body');
  const md5 = createHash('md5');
  const sha256 = createHash('sha256');
  for await (const chunk of res.body) {
    md5.update(chunk);
    sha256.update(chunk);
  }
  return { md5: md5.digest('hex'), sha256: sha256.digest('hex') };
}

(async () => {
  const { md5, sha256 } = await getChecksums();
  const file = `
# Maintainer: Tenshii <tenshii@miwa.lol>
pkgname=deezer-discord-rpc-bin
pkgver=${version}
pkgrel=1
pkgdesc="${description}"
arch=('x86_64')
url="https://github.com/CuteTenshii/deezer-discord-rpc"
license=('${license}')
depends=('gtk3' 'nss' 'alsa-lib' 'mesa' 'xdg-utils')
source=("${downloadUrl}")
md5sums=("${md5}")
sha256sums=("${sha256}")

package() {
    # Extract the .deb file
    bsdtar -xf "DeezerDiscordRPC-linux-amd64.deb" -C "$srcdir"

    # Extract the data tarball
    bsdtar -xf "$srcdir/data.tar.xz" -C "$pkgdir"

    # pacman handles updates, so the app's own update check is turned off.
    # The .desktop entry is the only launcher, as the .deb's postinst symlink is not recreated.
    sed -Ei 's#^Exec=("[^"]*"|[^ ]*)#& --disable-updates#' "$pkgdir/usr/share/applications/deezer-discord-rpc.desktop"
}
`;
  await writeFile('PKGBUILD', file.trim());
})();
