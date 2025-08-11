// lib/file-validation.ts
// Centralized file-type whitelist and validation helpers

export type ValidationResult = {
  ok: boolean;
  detectedMime?: string | null;
  reason?: string;
};

const DEFAULT_ALLOWED_MIME_TYPES: string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const DEFAULT_ALLOWED_EXTENSIONS: string[] = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
];

export function getAllowedMimeTypes(): Set<string> {
  const env = process.env.ALLOWED_UPLOAD_MIME_TYPES;
  if (env && env.trim().length > 0) {
    return new Set(
      env
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  return new Set(DEFAULT_ALLOWED_MIME_TYPES);
}

export function getAllowedExtensions(): Set<string> {
  const env = process.env.ALLOWED_UPLOAD_EXTENSIONS;
  if (env && env.trim().length > 0) {
    return new Set(
      env
        .split(',')
        .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean)
    );
  }
  return new Set(DEFAULT_ALLOWED_EXTENSIONS);
}

export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  return filename.slice(lastDotIndex + 1).toLowerCase();
}

// Very small set of magic-byte sniffs to avoid trusting only client-provided MIME
export function sniffMimeFromMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;

  // PDF: %PDF-
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  return null;
}

export function validateFile(
  buffer: Buffer,
  filename: string,
  clientProvidedMime?: string | null
): ValidationResult {
  const allowedMimes = getAllowedMimeTypes();
  const allowedExts = getAllowedExtensions();

  const ext = getFileExtension(filename);
  const clientMime = (clientProvidedMime || '').toLowerCase();

  const detectedMime = sniffMimeFromMagicBytes(buffer);

  // If we can detect a signature, trust it over client-provided MIME
  if (detectedMime) {
    if (!allowedMimes.has(detectedMime)) {
      return {
        ok: false,
        detectedMime,
        reason: `Disallowed file signature: ${detectedMime}`,
      };
    }
    // If signature is allowed, we accept. Extension mismatch is tolerated but can be logged by caller.
    return { ok: true, detectedMime };
  }

  // Fallback: require both MIME and extension to be on the allowed list
  const extAllowed = ext ? allowedExts.has(ext) : false;
  const mimeAllowed = clientMime ? allowedMimes.has(clientMime) : false;

  if (extAllowed && mimeAllowed) {
    return { ok: true, detectedMime: clientMime || null };
  }

  // Unsupported
  let reason = 'Unsupported file type';
  if (!extAllowed && !mimeAllowed) {
    reason = 'File extension and MIME type are not allowed';
  } else if (!extAllowed) {
    reason = 'File extension is not allowed';
  } else if (!mimeAllowed) {
    reason = 'MIME type is not allowed';
  }

  return {
    ok: false,
    detectedMime: clientMime || null,
    reason,
  };
}


