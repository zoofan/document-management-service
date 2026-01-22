// Document metadata schema
export const documentMetadataSchema = {
  type: 'object',
  properties: {
    author: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    wordCount: { type: 'number' },
    characterCount: { type: 'number' },
  },
  required: ['wordCount', 'characterCount'],
} as const;

// Full document schema
export const documentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    content: { type: 'string' },
    metadata: documentMetadataSchema,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    version: { type: 'number' },
  },
  required: ['id', 'title', 'content', 'metadata', 'createdAt', 'updatedAt', 'version'],
} as const;

// Create document request body schema
export const createDocumentBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 500 },
    content: { type: 'string', minLength: 0 },
    author: { type: 'string', maxLength: 200 },
    tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
  },
  required: ['title', 'content'],
} as const;

// List documents query string schema
export const listDocumentsQuerySchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1, default: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
    sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'title'], default: 'createdAt' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
} as const;

// Pagination schema
export const paginationSchema = {
  type: 'object',
  properties: {
    page: { type: 'number' },
    limit: { type: 'number' },
    total: { type: 'number' },
    totalPages: { type: 'number' },
  },
  required: ['page', 'limit', 'total', 'totalPages'],
} as const;

// Paginated documents response schema
export const paginatedDocumentsResponseSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: documentSchema },
    pagination: paginationSchema,
  },
  required: ['data', 'pagination'],
} as const;

// Document ID parameter schema
export const documentIdParamsSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
  required: ['id'],
} as const;

// Delete response schema
export const deleteDocumentResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
  },
  required: ['success', 'message'],
} as const;

// PATCH document request body schema (partial update)
// Allows updating title and metadata fields, but NOT content
// Content changes should go through POST /changes endpoint
export const patchDocumentBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 500 },
    author: { type: 'string', maxLength: 200 },
    tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
  },
  additionalProperties: false,
  minProperties: 1, // At least one field required
} as const;

// PATCH headers schema (If-Match for concurrency)
export const patchDocumentHeadersSchema = {
  type: 'object',
  properties: {
    'if-match': { type: 'string' },
  },
} as const;
