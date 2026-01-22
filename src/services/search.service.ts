import { Document, SearchQuery, SearchMatch, SearchResponse } from '../types/document';
import { getAllDocuments, getDocumentsByIds, findDocumentsByWord, findDocumentsByWords } from './storage';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractContext(
  content: string,
  matchStart: number,
  matchEnd: number,
  contextSize: number
): string {
  const start = Math.max(0, matchStart - contextSize);
  const end = Math.min(content.length, matchEnd + contextSize);

  let context = content.slice(start, end);

  if (start > 0) {
    context = '...' + context;
  }
  if (end < content.length) {
    context = context + '...';
  }

  return context;
}

function searchInDocument(
  doc: Document,
  pattern: RegExp,
  contextSize: number,
  maxResults: number,
  currentResults: SearchMatch[]
): SearchMatch[] {
  const results: SearchMatch[] = [...currentResults];

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

    if (match[0].length === 0) {
      searchPattern.lastIndex++;
    }
  }

  return results;
}

function getCandidateDocuments(query: string, documentIds?: string[]): Document[] {
  const queryWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (documentIds && documentIds.length > 0) {
    return getDocumentsByIds(documentIds);
  }

  if (queryWords.length === 0) {
    return [];
  }

  if (queryWords.length === 1) {
    const candidateIds = findDocumentsByWord(queryWords[0]);
    if (candidateIds.length > 0) {
      return getDocumentsByIds(candidateIds);
    }
    return [];
  }

  const candidateIds = findDocumentsByWords(queryWords);
  if (candidateIds.length > 0) {
    return getDocumentsByIds(candidateIds);
  }

  return [];
}

export function search(query: SearchQuery): SearchResponse {
  const {
    query: searchText,
    documentIds,
    caseSensitive = false,
    contextSize = 50,
    maxResults = 100,
  } = query;

  const escapedQuery = escapeRegex(searchText);
  const flags = caseSensitive ? 'g' : 'gi';
  const pattern = new RegExp(escapedQuery, flags);

  const candidates = getCandidateDocuments(searchText, documentIds);

  let results: SearchMatch[] = [];

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
