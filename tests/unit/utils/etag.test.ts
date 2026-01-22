import { describe, it, expect } from 'vitest';
import { generateETag, parseETagVersion, validateIfMatch } from '../../../src/utils/etag';
import { Document } from '../../../src/types/document';

describe('ETag Utilities', () => {
  const mockDocument: Document = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Document',
    content: 'Test content',
    metadata: { wordCount: 2, characterCount: 12 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    version: 1,
  };

  describe('generateETag', () => {
    it('should generate an ETag with version prefix', () => {
      const etag = generateETag(mockDocument);
      expect(etag).toMatch(/^"v1-[a-f0-9]{8}"$/);
    });

    it('should generate different ETags for different versions', () => {
      const doc1 = { ...mockDocument, version: 1 };
      const doc2 = { ...mockDocument, version: 2 };

      const etag1 = generateETag(doc1);
      const etag2 = generateETag(doc2);

      expect(etag1).not.toBe(etag2);
    });

    it('should generate different ETags for different timestamps', () => {
      const doc1 = { ...mockDocument, updatedAt: '2024-01-01T00:00:00.000Z' };
      const doc2 = { ...mockDocument, updatedAt: '2024-01-02T00:00:00.000Z' };

      const etag1 = generateETag(doc1);
      const etag2 = generateETag(doc2);

      expect(etag1).not.toBe(etag2);
    });
  });

  describe('parseETagVersion', () => {
    it('should parse version from valid ETag', () => {
      expect(parseETagVersion('"v1-abc12345"')).toBe(1);
      expect(parseETagVersion('"v42-xyz98765"')).toBe(42);
    });

    it('should handle weak ETags', () => {
      expect(parseETagVersion('W/"v5-abc12345"')).toBe(5);
    });

    it('should return null for invalid ETag', () => {
      expect(parseETagVersion('invalid')).toBeNull();
      expect(parseETagVersion('"invalid"')).toBeNull();
    });
  });

  describe('validateIfMatch', () => {
    it('should return true when no If-Match header', () => {
      expect(validateIfMatch(undefined, mockDocument)).toBe(true);
    });

    it('should return true for wildcard', () => {
      expect(validateIfMatch('*', mockDocument)).toBe(true);
    });

    it('should return true for matching ETag', () => {
      const etag = generateETag(mockDocument);
      expect(validateIfMatch(etag, mockDocument)).toBe(true);
    });

    it('should return false for non-matching ETag', () => {
      expect(validateIfMatch('"v99-invalid1"', mockDocument)).toBe(false);
    });

    it('should handle comma-separated ETags', () => {
      const etag = generateETag(mockDocument);
      expect(validateIfMatch(`"v99-other123", ${etag}`, mockDocument)).toBe(true);
    });

    it('should handle weak ETags in comparison', () => {
      const etag = generateETag(mockDocument);
      const weakEtag = `W/${etag}`;
      expect(validateIfMatch(weakEtag, mockDocument)).toBe(true);
    });
  });
});
