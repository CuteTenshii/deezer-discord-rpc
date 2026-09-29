import { writeFile } from 'fs/promises';
import { version, description, license } from '../package.json';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { createHash } from 'crypto';

const pipelineAsync = promisify(pipeline);
const downloadUrl = 'https://github.com/CuteTenshii/deezer-discord-rpc/releases/latest/download/DeezerDiscordRPC-linux-amd64.deb';
async function getMD5() {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`);
  if (!res.body) throw new Error('No response body');
  const body = res.body;
  const hash = createHash('md5');
  // @ts-expect-error Types
  await pipelineAsync(body, hash);
  return hash.digest('hex');
}

(async () => {
  const md5 = await getMD5();
  const file = `
# Maintainer: Yuuto <notyuuto@outlook.com>
pkgname=deezer-discord-rpc-bin
pkgver=${version}
pkgrel=1
pkgdesc="${description}"
arch=('x86_64')
url="https://github.com/CuteTenshii/deezer-discord-rpc"
license=('${license}')
depends=('electron')
source=("${downloadUrl}")
md5sums=("${md5}")

package() {
    # Extract the .deb file
    bsdtar -xf "DeezerDiscordRPC-linux-amd64.deb" -C "$srcdir"

    # Extract the data tarball
    bsdtar -xf "$srcdir/data.tar.xz" -C "$pkgdir"
}
`;
  await writeFile('PKGBUILD', file.trim());
})();