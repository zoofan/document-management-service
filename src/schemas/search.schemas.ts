// Search query request body schema
export const searchQueryBodySchema = {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1 },
    documentIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      description: 'Filter to specific documents'
    },
    caseSensitive: { type: 'boolean', default: false },
    contextSize: { type: 'number', minimum: 10, maximum: 500, default: 50 },
    maxResults: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
  },
  required: ['query'],
} as const;

// Single search match schema
export const searchMatchSchema = {
  type: 'object',
  properties: {
    documentId: { type: 'string', format: 'uuid' },
    documentTitle: { type: 'string' },
    position: { type: 'number' },
    context: { type: 'string' },
    matchedText: { type: 'string' },
  },
  required: ['documentId', 'documentTitle', 'position', 'context', 'matchedText'],
} as const;

// Search response schema
export const searchResponseSchema = {
  type: 'object',
  properties: {
    query: { type: 'string' },
    totalMatches: { type: 'number' },
    documentsSearched: { type: 'number' },
    results: { type: 'array', items: searchMatchSchema },
  },
  required: ['query', 'totalMatches', 'documentsSearched', 'results'],
} as const;
