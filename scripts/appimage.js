/* eslint @typescript-eslint/no-require-imports: 0 */
const { openSync, readSync, writeSync, closeSync } = require('fs');

function readAt(fd, position, length) {
  const buffer = Buffer.alloc(length);
  if (readSync(fd, buffer, 0, length, position) !== length) {
    throw new Error('Unexpected end of file while reading the ELF headers');
  }
  return buffer;
}

/**
 * Finds a section in the ELF runtime at the start of an AppImage.
 * @returns {{ offset: number, size: number }}
 */
function findSection(fd, sectionName) {
  const ident = readAt(fd, 0, 16);
  if (ident.readUInt32BE(0) !== 0x7f454c46) throw new Error('The AppImage does not start with an ELF runtime');
  const is64 = ident[4] === 2;
  const le = ident[5] === 1;
  const u16 = (buffer, offset) => le ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const u32 = (buffer, offset) => le ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  const word = (buffer, offset) => is64 ?
    Number(le ? buffer.readBigUInt64LE(offset) : buffer.readBigUInt64BE(offset)) :
    u32(buffer, offset);

  const header = readAt(fd, 0, is64 ? 64 : 52);
  const sectionHeadersOffset = word(header, is64 ? 0x28 : 0x20);
  const sectionHeaderSize = u16(header, is64 ? 0x3a : 0x2e);
  const sectionCount = u16(header, is64 ? 0x3c : 0x30);
  const namesSectionIndex = u16(header, is64 ? 0x3e : 0x32);

  const sectionHeaders = readAt(fd, sectionHeadersOffset, sectionHeaderSize * sectionCount);
  const section = (index) => {
    const start = index * sectionHeaderSize;
    return {
      nameOffset: u32(sectionHeaders, start),
      offset: word(sectionHeaders, start + (is64 ? 0x18 : 0x10)),
      size: word(sectionHeaders, start + (is64 ? 0x20 : 0x14)),
    };
  };

  const namesSection = section(namesSectionIndex);
  const names = readAt(fd, namesSection.offset, namesSection.size);
  for (let index = 0; index < sectionCount; index++) {
    const { nameOffset, offset, size } = section(index);
    const name = names.toString('latin1', nameOffset, names.indexOf(0, nameOffset));
    if (name === sectionName) return { offset, size };
  }
  throw new Error(`The AppImage runtime has no ${sectionName} section`);
}

/**
 * Writes update information into the AppImage runtime's .upd_info section, where AppImageUpdate
 * and similar tools look for it. electron-builder leaves the section empty, and repackaging with
 * `appimagetool -u` would swap out the runtime electron-builder chose.
 * @see https://github.com/AppImage/AppImageSpec/blob/master/draft.md#update-information
 */
function embedUpdateInformation(appImagePath, updateInformation) {
  const fd = openSync(appImagePath, 'r+');
  try {
    const { offset, size } = findSection(fd, '.upd_info');
    // The section is read as a NUL-terminated string, so one byte stays free for the terminator.
    if (Buffer.byteLength(updateInformation) >= size) {
      throw new Error(`The update information does not fit in the ${size}-byte .upd_info section`);
    }
    const data = Buffer.alloc(size);
    data.write(updateInformation);
    writeSync(fd, data, 0, size, offset);
  } finally {
    closeSync(fd);
  }
}

module.exports = { embedUpdateInformation };
