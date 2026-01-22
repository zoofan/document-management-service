import type {
  Document,
  DocumentListResponse,
  DocumentListParams,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  DeleteResponse,
  ApplyChangesRequest,
  ApplyChangesResponse,
  SearchRequest,
  SearchResponse,
  HealthResponse,
  ErrorResponse,
} from './types';

class ApiError extends Error {
  code: number;
  currentEtag?: string;

  constructor(message: string, code: number, currentEtag?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.currentEtag = currentEtag;
  }
}

async function handleResponse<T>(response: Response): Promise<{ data: T; etag?: string }> {
  const etag = response.headers.get('ETag') || undefined;

  if (!response.ok) {
    const errorData: ErrorResponse = await response.json();
    throw new ApiError(errorData.error, errorData.code, errorData.currentEtag);
  }

  const data = await response.json();
  return { data, etag };
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch('/health');
  const { data } = await handleResponse<HealthResponse>(response);
  return data;
}

export async function listDocuments(params: DocumentListParams = {}): Promise<DocumentListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const url = `/api/documents${searchParams.toString() ? `?${searchParams}` : ''}`;
  const response = await fetch(url);
  const { data } = await handleResponse<DocumentListResponse>(response);
  return data;
}

export async function getDocument(id: string): Promise<{ document: Document; etag: string }> {
  const response = await fetch(`/api/documents/${id}`);
  const { data, etag } = await handleResponse<Document>(response);
  return { document: data, etag: etag || '' };
}

export async function createDocument(request: CreateDocumentRequest): Promise<{ document: Document; etag: string }> {
  const response = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const { data, etag } = await handleResponse<Document>(response);
  return { document: data, etag: etag || '' };
}

export async function updateDocument(
  id: string,
  request: UpdateDocumentRequest,
  ifMatch?: string
): Promise<{ document: Document; etag: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ifMatch) headers['If-Match'] = ifMatch;

  const response = await fetch(`/api/documents/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(request),
  });
  const { data, etag } = await handleResponse<Document>(response);
  return { document: data, etag: etag || '' };
}

export async function deleteDocument(id: string): Promise<DeleteResponse> {
  const response = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
  });
  const { data } = await handleResponse<DeleteResponse>(response);
  return data;
}

export async function applyChanges(
  id: string,
  request: ApplyChangesRequest,
  ifMatch?: string
): Promise<ApplyChangesResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ifMatch) headers['If-Match'] = ifMatch;

  const response = await fetch(`/api/documents/${id}/changes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const { data } = await handleResponse<ApplyChangesResponse>(response);
  return data;
}

export async function searchDocuments(request: SearchRequest): Promise<SearchResponse> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const { data } = await handleResponse<SearchResponse>(response);
  return data;
}

export { ApiError };
