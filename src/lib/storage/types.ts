export interface StoredObject {
  key: string;
  url: string;
}

export interface StorageDriver {
  /** Persist a buffer under `key` (e.g. "portfolio/<id>/<filename>") and return its public URL. */
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

export class UploadValidationError extends Error {}

export function assertValidUpload(contentType: string, size: number) {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new UploadValidationError(`Unsupported file type: ${contentType}`);
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(
      `File too large (${size} bytes): max ${MAX_UPLOAD_BYTES} bytes`,
    );
  }
}
