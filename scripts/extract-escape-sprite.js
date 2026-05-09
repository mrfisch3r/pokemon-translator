const fs = require('fs');
const zlib = require('zlib');

const inputPath = process.argv[2] ?? '8142.png';
const outputPath = process.argv[3] ?? 'src/escape-sprite.png';

const SPRITE_X = 7;
const SPRITE_Y = 67;
const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 24;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
};

const parsePng = (buffer) => {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (colorType !== 2) {
    throw new Error(`Expected RGB PNG, received color type ${colorType}.`);
  }

  return {
    width,
    height,
    data: zlib.inflateSync(Buffer.concat(idatChunks))
  };
};

const paeth = (left, up, upLeft) => {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
};

const unfilterRgb = ({ width, height, data }) => {
  const bytesPerPixel = 3;
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = data[sourceOffset];
    sourceOffset += 1;

    for (let x = 0; x < stride; x += 1) {
      const current = data[sourceOffset + x];
      const left = x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * stride + x - bytesPerPixel] : 0;
      let value = current;

      if (filter === 1) value = current + left;
      if (filter === 2) value = current + up;
      if (filter === 3) value = current + Math.floor((left + up) / 2);
      if (filter === 4) value = current + paeth(left, up, upLeft);

      pixels[y * stride + x] = value & 0xff;
    }

    sourceOffset += stride;
  }

  return pixels;
};

const writeChunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
};

const createPng = (width, height, rgba) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const targetOffset = y * (stride + 1);
    scanlines[targetOffset] = 0;
    rgba.copy(scanlines, targetOffset + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    writeChunk('IHDR', header),
    writeChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    writeChunk('IEND', Buffer.alloc(0))
  ]);
};

const source = parsePng(fs.readFileSync(inputPath));
const pixels = unfilterRgb(source);
const background = pixels.subarray(0, 3);
const output = Buffer.alloc(SPRITE_WIDTH * SPRITE_HEIGHT * 4);

for (let y = 0; y < SPRITE_HEIGHT; y += 1) {
  for (let x = 0; x < SPRITE_WIDTH; x += 1) {
    const sourceOffset = ((SPRITE_Y + y) * source.width + SPRITE_X + x) * 3;
    const targetOffset = (y * SPRITE_WIDTH + x) * 4;
    const red = pixels[sourceOffset];
    const green = pixels[sourceOffset + 1];
    const blue = pixels[sourceOffset + 2];
    const isBackground = red === background[0] && green === background[1] && blue === background[2];

    output[targetOffset] = red;
    output[targetOffset + 1] = green;
    output[targetOffset + 2] = blue;
    output[targetOffset + 3] = isBackground ? 0 : 255;
  }
}

fs.writeFileSync(outputPath, createPng(SPRITE_WIDTH, SPRITE_HEIGHT, output));
console.log(`Extracted ${SPRITE_WIDTH}x${SPRITE_HEIGHT} sprite to ${outputPath}`);
