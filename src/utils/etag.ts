import { createHash } from 'crypto';
import { Document } from '../types/document';

export function generateETag(doc: Document): string {
  const hash = createHash('md5')
    .update(`${doc.id}-${doc.version}-${doc.updatedAt}`)
    .digest('hex')
    .substring(0, 8);
  return `"v${doc.version}-${hash}"`;
}

export function parseETagVersion(etag: string): number | null {
  const cleaned = etag.replace(/^W\//, '').replace(/"/g, '');
  const match = cleaned.match(/^v(\d+)-/);
  return match ? parseInt(match[1], 10) : null;
}

export function validateIfMatch(ifMatch: string | undefined, doc: Document): boolean {
  if (!ifMatch) {
    return true;
  }

  if (ifMatch === '*') {
    return true;
  }

  const currentETag = generateETag(doc);
  const requestedETags = ifMatch.split(',').map((e) => e.trim());

  return requestedETags.some((requestedETag) => {
    const normalizedRequested = requestedETag.replace(/^W\//, '');
    const normalizedCurrent = currentETag.replace(/^W\//, '');
    return normalizedRequested === normalizedCurrent;
  });
}
