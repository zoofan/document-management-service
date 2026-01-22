/**
 * Storage Service - In-Memory Document Store with Inverted Index
 *
 * Performance Characteristics:
 * - Document lookup by ID: O(1) via Map
 * - Word-based candidate lookup: O(1) via inverted index
 * - Document creation: O(w) where w = unique words (for indexing)
 * - Document update: O(w) for re-indexing
 *
 * Indexing Strategy:
 * An inverted word index maps each unique word to the set of documents
 * containing that word. This enables O(1) candidate filtering for search
 * queries, dramatically reducing the content that needs to be scanned.
 *
 * Memory Usage:
 * - Documents: O(total content size)
 * - Word Index: O(unique words × avg documents per word)
 *
 * For production use, consider SQLite with FTS5 or Elasticsearch.
 */

import { randomUUID } from 'crypto';
import {
  Document,
  CreateDocumentInput,
  ListDocumentsQuery,
  PaginatedResponse,
  PatchDocumentInput,
} from '../types/document';

/**
 * Primary document store: ID → Document
 * Time: O(1) for get/set/delete
 */
const documents: Map<string, Document> = new Map();

/**
 * Inverted word index: word → Set of document IDs
 * Enables O(1) lookup for "which documents contain word X?"
 *
 * Example:
 *   "hello" → Set(["doc-1", "doc-5"])
 *   "world" → Set(["doc-1", "doc-3"])
 */
const wordIndex: Map<string, Set<string>> = new Map();

/**
 * Extract words from text for indexing.
 * Time: O(n) where n = text length
 * Normalizes to lowercase and splits on word boundaries.
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

// Helper: Calculate word count
function countWords(text: string): number {
  return extractWords(text).length;
}

/**
 * Add document to inverted word index.
 * Time: O(w) where w = unique words in document
 * Each word gets the document ID added to its posting list.
 */
function indexDocument(doc: Document): void {
  const words = new Set([
    ...extractWords(doc.title),
    ...extractWords(doc.content),
  ]);

  for (const word of words) {
    if (!wordIndex.has(word)) {
      wordIndex.set(word, new Set());
    }
    wordIndex.get(word)!.add(doc.id);
  }
}

/**
 * Remove document from inverted word index.
 * Time: O(w) where w = unique words in document
 * Called before update/delete to maintain index consistency.
 */
function removeFromIndex(doc: Document): void {
  const words = new Set([
    ...extractWords(doc.title),
    ...extractWords(doc.content),
  ]);

  for (const word of words) {
    const docIds = wordIndex.get(word);
    if (docIds) {
      docIds.delete(doc.id);
      if (docIds.size === 0) {
        wordIndex.delete(word);
      }
    }
  }
}

// Create a new document
export function createDocument(input: CreateDocumentInput): Document {
  const now = new Date().toISOString();
  const doc: Document = {
    id: randomUUID(),
    title: input.title,
    content: input.content,
    metadata: {
      author: input.author,
      tags: input.tags,
      wordCount: countWords(input.content),
      characterCount: input.content.length,
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  documents.set(doc.id, doc);
  indexDocument(doc);

  return doc;
}

// Get document by ID
export function getDocument(id: string): Document | undefined {
  return documents.get(id);
}

// List documents with pagination
export function listDocuments(
  query: ListDocumentsQuery = {}
): PaginatedResponse<Document> {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  let docs = Array.from(documents.values());

  // Sort
  docs.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === 'updatedAt') {
      comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Paginate
  const total = docs.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paginatedDocs = docs.slice(start, start + limit);

  return {
    data: paginatedDocs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

// Update a document (used by change service)
export function updateDocument(
  id: string,
  updates: Partial<Pick<Document, 'title' | 'content'>>
): Document | undefined {
  const doc = documents.get(id);
  if (!doc) return undefined;

  // Remove old index entries
  removeFromIndex(doc);

  // Update document
  if (updates.title !== undefined) {
    doc.title = updates.title;
  }
  if (updates.content !== undefined) {
    doc.content = updates.content;
    doc.metadata.wordCount = countWords(updates.content);
    doc.metadata.characterCount = updates.content.length;
  }

  doc.updatedAt = new Date().toISOString();
  doc.version += 1;

  // Re-index
  indexDocument(doc);

  return doc;
}

// Delete a document
export function deleteDocument(id: string): boolean {
  const doc = documents.get(id);
  if (!doc) return false;

  removeFromIndex(doc);
  documents.delete(id);
  return true;
}

/**
 * Patch document metadata (title, author, tags).
 * Does NOT change content - use updateDocument for content changes.
 * Re-indexes if title changes (title words are indexed).
 */
export function patchDocument(
  id: string,
  patch: PatchDocumentInput
): Document | undefined {
  const doc = documents.get(id);
  if (!doc) return undefined;

  const titleChanged = patch.title !== undefined && patch.title !== doc.title;

  // Remove from index if title is changing
  if (titleChanged) {
    removeFromIndex(doc);
  }

  // Apply patches
  if (patch.title !== undefined) {
    doc.title = patch.title;
  }
  if (patch.author !== undefined) {
    doc.metadata.author = patch.author;
  }
  if (patch.tags !== undefined) {
    doc.metadata.tags = patch.tags;
  }

  doc.updatedAt = new Date().toISOString();
  doc.version += 1;

  // Re-index if title changed
  if (titleChanged) {
    indexDocument(doc);
  }

  return doc;
}

// Get documents by IDs (for search filtering)
export function getDocumentsByIds(ids: string[]): Document[] {
  return ids
    .map((id) => documents.get(id))
    .filter((doc): doc is Document => doc !== undefined);
}

// Get all documents (for search)
export function getAllDocuments(): Document[] {
  return Array.from(documents.values());
}

// Find candidate documents containing a word (uses inverted index)
export function findDocumentsByWord(word: string): string[] {
  const docIds = wordIndex.get(word.toLowerCase());
  return docIds ? Array.from(docIds) : [];
}

/**
 * Find candidate documents containing ALL specified words (intersection).
 * Time: O(w × min_posting_size) where w = words, using smallest set first
 *
 * For multi-word queries, intersecting posting lists dramatically reduces
 * the candidate set before expensive content scanning.
 *
 * Example: Query "hello world"
 *   "hello" → Set(["doc-1", "doc-5", "doc-12"]) - 3 docs
 *   "world" → Set(["doc-1", "doc-3"]) - 2 docs
 *   Intersection → ["doc-1"] - only 1 doc to scan
 */
export function findDocumentsByWords(words: string[]): string[] {
  if (words.length === 0) return [];
  if (words.length === 1) return findDocumentsByWord(words[0]);

  // Get posting lists for all words
  const postingLists = words
    .map((word) => wordIndex.get(word.toLowerCase()))
    .filter((set): set is Set<string> => set !== undefined && set.size > 0);

  // If any word has no matches, intersection is empty
  if (postingLists.length !== words.length) {
    return [];
  }

  // Sort by size (smallest first) for efficient intersection
  postingLists.sort((a, b) => a.size - b.size);

  // Intersect starting with smallest set
  let result = new Set(postingLists[0]);
  for (let i = 1; i < postingLists.length && result.size > 0; i++) {
    const nextSet = postingLists[i];
    result = new Set([...result].filter((id) => nextSet.has(id)));
  }

  return Array.from(result);
}

/**
 * Get index statistics for monitoring and debugging.
 */
export function getIndexStats(): { uniqueWords: number; totalPostings: number } {
  let totalPostings = 0;
  for (const docIds of wordIndex.values()) {
    totalPostings += docIds.size;
  }
  return {
    uniqueWords: wordIndex.size,
    totalPostings,
  };
}

// Clear all documents (for testing)
export function clearAllDocuments(): void {
  documents.clear();
  wordIndex.clear();
}

// Get document count (for testing/debugging)
export function getDocumentCount(): number {
  return documents.size;
}
