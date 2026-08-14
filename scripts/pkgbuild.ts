import { writeFile } from 'fs/promises';
import { version, description, license } from '../package.json';
import { createHash } from 'crypto';

const downloadUrl = 'https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-linux-amd64.deb';

// Compute the SHA-256 digest from the downloaded release.
async function getChecksums() {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`);
  if (!res.body) throw new Error('No response body');
  const sha256 = createHash('sha256');
  for await (const chunk of res.body) {
    sha256.update(chunk);
  }
  return { sha256: sha256.digest('hex') };
}

(async () => {
  const { sha256 } = await getChecksums();
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
sha256sums=("${sha256}")

package() {
    # Extract the .deb file
    bsdtar -xf "DeezerDiscordRPC-linux-amd64.deb" -C "$srcdir"

    # Extract the data tarball
    bsdtar -xf "$srcdir/data.tar.xz" -C "$pkgdir"
}
`;
  await writeFile('PKGBUILD', file.trim());
})();
