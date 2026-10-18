export type AllowedImageMimeType = 'image/jpeg' | 'image/png';

/**
 * Inspects buffer magic bytes to determine if the file is a valid JPEG or PNG image.
 * Returns the MIME type if valid, or null if invalid or unknown.
 */
export function getImageMimeTypeFromBuffer(buffer: Buffer): AllowedImageMimeType | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG magic bytes: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  return null;
}

/**
 * Validates that the buffer begins with JPEG or PNG magic bytes.
 */
export function isValidImageBuffer(buffer: Buffer): boolean {
  return getImageMimeTypeFromBuffer(buffer) !== null;
}
