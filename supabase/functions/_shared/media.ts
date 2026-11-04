/** Identifies a file from its first bytes. Returns null for formats Claude cannot read (e.g. HEIC). */
export type SupportedMedia = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export function sniffMediaType(b: Uint8Array): SupportedMedia | null {
  const at = (i: number, ...xs: number[]) => xs.every((x, j) => b[i + j] === x);
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return 'application/pdf'; // %PDF
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'; // RIFF....WEBP
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif'; // GIF8
  return null;
}
