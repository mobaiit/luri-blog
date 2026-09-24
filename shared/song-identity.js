const SHIFT = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const TABLE = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0);
const rotateLeft = (value, amount) => (value << amount) | (value >>> (32 - amount));
const wordHex = (value) => [0, 8, 16, 24].map((shift) => ((value >>> shift) & 0xff).toString(16).padStart(2, '0')).join('');

export function md5(value) {
  const input = new TextEncoder().encode(String(value));
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input); bytes[input.length] = 0x80;
  const bitLength = BigInt(input.length) * 8n;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Number(bitLength & 0xffffffffn), true);
  view.setUint32(paddedLength - 4, Number(bitLength >> 32n & 0xffffffffn), true);

  let a0 = 0x67452301; let b0 = 0xefcdab89; let c0 = 0x98badcfe; let d0 = 0x10325476;
  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => view.getUint32(offset + index * 4, true));
    let a = a0; let b = b0; let c = c0; let d = d0;
    for (let index = 0; index < 64; index += 1) {
      let mixed; let word;
      if (index < 16) { mixed = (b & c) | (~b & d); word = index; }
      else if (index < 32) { mixed = (d & b) | (~d & c); word = (5 * index + 1) % 16; }
      else if (index < 48) { mixed = b ^ c ^ d; word = (3 * index + 5) % 16; }
      else { mixed = c ^ (b | ~d); word = (7 * index) % 16; }
      const previousD = d;
      d = c; c = b;
      b = (b + rotateLeft((a + mixed + TABLE[index] + words[word]) | 0, SHIFT[index])) | 0;
      a = previousD;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  return wordHex(a0) + wordHex(b0) + wordHex(c0) + wordHex(d0);
}

export const songIdentityInput = (title, artist) => JSON.stringify([String(title || ''), String(artist || '')]);
export const songIdFor = (title, artist) => md5(songIdentityInput(title, artist));

