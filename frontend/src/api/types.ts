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

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DocumentListResponse {
  data: Document[];
  pagination: Pagination;
}

export interface DocumentListParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
  author?: string;
  tags?: string[];
}

export interface UpdateDocumentRequest {
  title?: string;
  author?: string;
  tags?: string[];
}

export interface DeleteResponse {
  success: boolean;
  message: string;
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

export interface ChangeResult {
  searchText: string;
  replaceText: string;
  matchesFound: number;
  replacementsMade: number;
  positions?: number[];
}

export interface ApplyChangesRequest {
  changes: Change[];
}

export interface ApplyChangesResponse {
  document: Document;
  results: ChangeResult[];
  totalReplacements: number;
  previousVersion: number;
  newVersion: number;
  etag: string;
}

export interface SearchRequest {
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

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
}

export interface ErrorResponse {
  error: string;
  code: number;
  currentEtag?: string;
}
