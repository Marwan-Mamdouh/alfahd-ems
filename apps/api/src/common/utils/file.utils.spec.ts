import { describe, it, expect } from 'vitest';
import { getImageMimeTypeFromBuffer, isValidImageBuffer } from './file.utils.js';

describe('file.utils (Magic Bytes Validation)', () => {
  it('correctly identifies valid JPEG buffers', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(getImageMimeTypeFromBuffer(jpegBuffer)).toBe('image/jpeg');
    expect(isValidImageBuffer(jpegBuffer)).toBe(true);
  });

  it('correctly identifies valid PNG buffers', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(getImageMimeTypeFromBuffer(pngBuffer)).toBe('image/png');
    expect(isValidImageBuffer(pngBuffer)).toBe(true);
  });

  it('rejects buffers with invalid or spoofed magic bytes', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4');
    expect(getImageMimeTypeFromBuffer(pdfBuffer)).toBeNull();
    expect(isValidImageBuffer(pdfBuffer)).toBe(false);

    const textBuffer = Buffer.from('image/jpeg Fake payload');
    expect(getImageMimeTypeFromBuffer(textBuffer)).toBeNull();
    expect(isValidImageBuffer(textBuffer)).toBe(false);

    const emptyBuffer = Buffer.alloc(0);
    expect(getImageMimeTypeFromBuffer(emptyBuffer)).toBeNull();
    expect(isValidImageBuffer(emptyBuffer)).toBe(false);

    const shortBuffer = Buffer.from([0xff, 0xd8]);
    expect(getImageMimeTypeFromBuffer(shortBuffer)).toBeNull();
    expect(isValidImageBuffer(shortBuffer)).toBe(false);
  });
});
