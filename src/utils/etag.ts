import { createHash } from 'crypto';
import { Document } from '../types/document';

/**
 * Generate an ETag for a document.
 * Uses version number and updatedAt timestamp for fast generation.
 * Format: "v{version}-{timestamp-hash}"
 */
export function generateETag(doc: Document): string {
  const hash = createHash('md5')
    .update(`${doc.id}-${doc.version}-${doc.updatedAt}`)
    .digest('hex')
    .substring(0, 8);
  return `"v${doc.version}-${hash}"`;
}

/**
 * Parse version from ETag string.
 * Returns null if ETag is invalid.
 */
export function parseETagVersion(etag: string): number | null {
  // Remove quotes and weak prefix if present
  const cleaned = etag.replace(/^W\//, '').replace(/"/g, '');
  const match = cleaned.match(/^v(\d+)-/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Validate If-Match header against document.
 * Returns true if the request should proceed, false if there's a conflict.
 *
 * @param ifMatch - Value of If-Match header (may be "*" or ETag value)
 * @param doc - Current document state
 * @returns true if ETags match or If-Match is "*"
 */
export function validateIfMatch(ifMatch: string | undefined, doc: Document): boolean {
  // No If-Match header means no concurrency check
  if (!ifMatch) {
    return true;
  }

  // "*" matches any resource
  if (ifMatch === '*') {
    return true;
  }

  // Compare ETags (may be comma-separated list)
  const currentETag = generateETag(doc);
  const requestedETags = ifMatch.split(',').map((e) => e.trim());

  return requestedETags.some((requestedETag) => {
    // Normalize for comparison (remove weak prefix, compare values)
    const normalizedRequested = requestedETag.replace(/^W\//, '');
    const normalizedCurrent = currentETag.replace(/^W\//, '');
    return normalizedRequested === normalizedCurrent;
  });
}
