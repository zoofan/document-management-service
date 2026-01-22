/**
 * Search Service - Full-Text Search Operations
 *
 * Performance Characteristics:
 * - Time Complexity: O(n) where n = total content length of searched documents
 * - Space Complexity: O(m) where m = maxResults (bounded output)
 *
 * Optimizations:
 * 1. Inverted word index for O(1) candidate document lookup (single-word queries)
 * 2. Early termination when maxResults is reached
 * 3. Native V8 RegExp for linear-time pattern matching
 * 4. Context extraction via String.slice() (O(1) pointer arithmetic)
 *
 * ReDoS Prevention: User input is escaped to prevent regex injection.
 */

import { Document, SearchQuery, SearchMatch, SearchResponse } from '../types/document';
import { getAllDocuments, getDocumentsByIds, findDocumentsByWord, findDocumentsByWords } from './storage';

/**
 * Escape special regex characters for safe literal matching.
 * Time: O(n) where n = string length
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract context around a match using String.slice().
 * Time: O(1) - slice is pointer arithmetic in V8 until materialized
 */
function extractContext(
  content: string,
  matchStart: number,
  matchEnd: number,
  contextSize: number
): string {
  const start = Math.max(0, matchStart - contextSize);
  const end = Math.min(content.length, matchEnd + contextSize);

  let context = content.slice(start, end);

  // Add ellipsis if truncated
  if (start > 0) {
    context = '...' + context;
  }
  if (end < content.length) {
    context = context + '...';
  }

  return context;
}

/**
 * Search within a single document using RegExp.exec() iteration.
 * Time: O(n) where n = document content length (single pass)
 * Space: O(m) where m = matches found (capped by maxResults)
 *
 * Uses native V8 regex engine which is optimized for linear-time matching.
 * Early termination when maxResults is reached prevents unbounded memory usage.
 */
function searchInDocument(
  doc: Document,
  pattern: RegExp,
  contextSize: number,
  maxResults: number,
  currentResults: SearchMatch[]
): SearchMatch[] {
  const results: SearchMatch[] = [...currentResults];

  // Search in content
  let match;
  const searchPattern = new RegExp(pattern.source, pattern.flags);

  while ((match = searchPattern.exec(doc.content)) !== null) {
    if (results.length >= maxResults) break;

    results.push({
      documentId: doc.id,
      documentTitle: doc.title,
      position: match.index,
      context: extractContext(doc.content, match.index, match.index + match[0].length, contextSize),
      matchedText: match[0],
    });

    // Prevent infinite loop for zero-length matches
    if (match[0].length === 0) {
      searchPattern.lastIndex++;
    }
  }

  return results;
}

/**
 * Get candidate documents using inverted word index.
 * Time: O(1) for single-word queries (index lookup)
 * Time: O(w × min_posting_size) for multi-word queries (intersection)
 *
 * The inverted index maps words to document IDs, enabling fast
 * filtering before full-text search. For multi-word queries,
 * we intersect posting lists to find documents containing ALL words.
 *
 * Example: "hello world" query
 *   1. Find docs with "hello": ["doc-1", "doc-5"]
 *   2. Find docs with "world": ["doc-1", "doc-3"]
 *   3. Intersect: ["doc-1"] - only scan this document
 */
function getCandidateDocuments(query: string, documentIds?: string[]): Document[] {
  // Extract words from query for index lookup
  const queryWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);

  // If we have specific document IDs, use those
  if (documentIds && documentIds.length > 0) {
    return getDocumentsByIds(documentIds);
  }

  // No words to search
  if (queryWords.length === 0) {
    return [];
  }

  // Single word: O(1) lookup
  if (queryWords.length === 1) {
    const candidateIds = findDocumentsByWord(queryWords[0]);
    if (candidateIds.length > 0) {
      return getDocumentsByIds(candidateIds);
    }
    // No index hits - fall through to return empty (word not in any doc)
    return [];
  }

  // Multi-word: intersect posting lists for documents containing ALL words
  const candidateIds = findDocumentsByWords(queryWords);
  if (candidateIds.length > 0) {
    return getDocumentsByIds(candidateIds);
  }

  // If intersection is empty but query has multiple words,
  // it means no document contains all words - return empty
  // This is more efficient than scanning all documents
  return [];
}

/**
 * Main search function - searches across documents with context snippets.
 * Time: O(c + n) where c = candidate lookup, n = content of candidate docs
 * Space: O(maxResults) for bounded output
 *
 * Flow:
 * 1. Use inverted index to find candidate documents (O(1) for single words)
 * 2. Search each candidate with RegExp (O(n) per document)
 * 3. Extract context around matches (O(1) per match)
 * 4. Return when maxResults reached (early termination)
 */
export function search(query: SearchQuery): SearchResponse {
  const {
    query: searchText,
    documentIds,
    caseSensitive = false,
    contextSize = 50,
    maxResults = 100,
  } = query;

  // Build search pattern
  const escapedQuery = escapeRegex(searchText);
  const flags = caseSensitive ? 'g' : 'gi';
  const pattern = new RegExp(escapedQuery, flags);

  // Get candidate documents
  const candidates = getCandidateDocuments(searchText, documentIds);

  let results: SearchMatch[] = [];

  // Search each document
  for (const doc of candidates) {
    if (results.length >= maxResults) break;
    results = searchInDocument(doc, pattern, contextSize, maxResults, results);
  }

  return {
    query: searchText,
    totalMatches: results.length,
    documentsSearched: candidates.length,
    results,
  };
}
