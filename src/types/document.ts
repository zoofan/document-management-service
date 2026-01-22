// Document metadata
export interface DocumentMetadata {
  author?: string;
  tags?: string[];
  wordCount: number;
  characterCount: number;
}

// Core document type
export interface Document {
  id: string;
  title: string;
  content: string;
  metadata: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// Document creation input
export interface CreateDocumentInput {
  title: string;
  content: string;
  author?: string;
  tags?: string[];
}

// Document list query parameters
export interface ListDocumentsQuery {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// Partial update input (PATCH)
// Note: Content changes should use POST /changes endpoint
export interface PatchDocumentInput {
  title?: string;
  author?: string;
  tags?: string[];
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Change request for redlining
export interface Change {
  searchText: string;
  replaceText: string;
  matchCase?: boolean;       // default: true
  matchWholeWord?: boolean;  // default: false
  replaceAll?: boolean;      // default: true
  occurrence?: number;       // specific occurrence (1-indexed), only used when replaceAll is false

  // Character range targeting (takes precedence over occurrence)
  startIndex?: number;       // start position in document (0-indexed)
  endIndex?: number;         // end position in document (exclusive)

  // Contextual matching (additional validation for safety)
  beforeContext?: string;    // text that must appear before the match
  afterContext?: string;     // text that must appear after the match
}

// Character range for precise targeting
export interface CharacterRange {
  start: number;
  end: number;
}

// Change request input (array of changes)
export interface ApplyChangesInput {
  changes: Change[];
  ifMatch?: string;  // ETag for optimistic concurrency control
}

// Change result for a single change operation
export interface ChangeResult {
  searchText: string;
  replaceText: string;
  matchesFound: number;
  replacementsMade: number;
  positions?: number[];      // positions where replacements were made
}

// Response from applying changes
export interface ApplyChangesResponse {
  document: Document;
  results: ChangeResult[];
  totalReplacements: number;
  previousVersion: number;
  newVersion: number;
  etag: string;              // New ETag for the updated document
}

// Search query
export interface SearchQuery {
  query: string;
  documentIds?: string[];    // filter to specific docs
  caseSensitive?: boolean;   // default: false
  contextSize?: number;      // default: 50 chars
  maxResults?: number;       // default: 100
}

// Single search match with context
export interface SearchMatch {
  documentId: string;
  documentTitle: string;
  position: number;
  context: string;
  matchedText: string;
}

// Search response
export interface SearchResponse {
  query: string;
  totalMatches: number;
  documentsSearched: number;
  results: SearchMatch[];
}
