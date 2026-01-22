import { randomUUID } from 'crypto';
import {
  Document,
  CreateDocumentInput,
  ListDocumentsQuery,
  PaginatedResponse,
  PatchDocumentInput,
} from '../types/document';

const documents: Map<string, Document> = new Map();

const wordIndex: Map<string, Set<string>> = new Map();

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function countWords(text: string): number {
  return extractWords(text).length;
}

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

export function getDocument(id: string): Document | undefined {
  return documents.get(id);
}

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

export function updateDocument(
  id: string,
  updates: Partial<Pick<Document, 'title' | 'content'>>
): Document | undefined {
  const doc = documents.get(id);
  if (!doc) return undefined;

  removeFromIndex(doc);

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

  indexDocument(doc);

  return doc;
}

export function deleteDocument(id: string): boolean {
  const doc = documents.get(id);
  if (!doc) return false;

  removeFromIndex(doc);
  documents.delete(id);
  return true;
}

export function patchDocument(
  id: string,
  patch: PatchDocumentInput
): Document | undefined {
  const doc = documents.get(id);
  if (!doc) return undefined;

  const titleChanged = patch.title !== undefined && patch.title !== doc.title;

  if (titleChanged) {
    removeFromIndex(doc);
  }

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

  if (titleChanged) {
    indexDocument(doc);
  }

  return doc;
}

export function getDocumentsByIds(ids: string[]): Document[] {
  return ids
    .map((id) => documents.get(id))
    .filter((doc): doc is Document => doc !== undefined);
}

export function getAllDocuments(): Document[] {
  return Array.from(documents.values());
}

export function findDocumentsByWord(word: string): string[] {
  const docIds = wordIndex.get(word.toLowerCase());
  return docIds ? Array.from(docIds) : [];
}

export function findDocumentsByWords(words: string[]): string[] {
  if (words.length === 0) return [];
  if (words.length === 1) return findDocumentsByWord(words[0]);

  const postingLists = words
    .map((word) => wordIndex.get(word.toLowerCase()))
    .filter((set): set is Set<string> => set !== undefined && set.size > 0);

  if (postingLists.length !== words.length) {
    return [];
  }

  postingLists.sort((a, b) => a.size - b.size);

  let result = new Set(postingLists[0]);
  for (let i = 1; i < postingLists.length && result.size > 0; i++) {
    const nextSet = postingLists[i];
    result = new Set([...result].filter((id) => nextSet.has(id)));
  }

  return Array.from(result);
}

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

export function clearAllDocuments(): void {
  documents.clear();
  wordIndex.clear();
}

export function getDocumentCount(): number {
  return documents.size;
}
