export interface DocumentMetadata {
  author?: string;
  tags?: string[];
  wordCount: number;
  characterCount: number;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  metadata: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateDocumentInput {
  title: string;
  content: string;
  author?: string;
  tags?: string[];
}

export interface ListDocumentsQuery {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface PatchDocumentInput {
  title?: string;
  author?: string;
  tags?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Change {
  searchText: string;
  replaceText: string;
  matchCase?: boolean;
  matchWholeWord?: boolean;
  replaceAll?: boolean;
  occurrence?: number;

  startIndex?: number;
  endIndex?: number;

  beforeContext?: string;
  afterContext?: string;
}

export interface CharacterRange {
  start: number;
  end: number;
}

export interface ApplyChangesInput {
  changes: Change[];
  ifMatch?: string;
}

export interface ChangeResult {
  searchText: string;
  replaceText: string;
  matchesFound: number;
  replacementsMade: number;
  positions?: number[];
}

export interface ApplyChangesResponse {
  document: Document;
  results: ChangeResult[];
  totalReplacements: number;
  previousVersion: number;
  newVersion: number;
  etag: string;
}

export interface SearchQuery {
  query: string;
  documentIds?: string[];
  caseSensitive?: boolean;
  contextSize?: number;
  maxResults?: number;
}

export interface SearchMatch {
  documentId: string;
  documentTitle: string;
  position: number;
  context: string;
  matchedText: string;
}

export interface SearchResponse {
  query: string;
  totalMatches: number;
  documentsSearched: number;
  results: SearchMatch[];
}
