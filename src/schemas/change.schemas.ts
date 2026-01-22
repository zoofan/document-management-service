import { documentSchema } from './document.schemas';

// Single change schema with targeting options
export const changeSchema = {
  type: 'object',
  properties: {
    searchText: { type: 'string', minLength: 1 },
    replaceText: { type: 'string' },
    matchCase: { type: 'boolean', default: true },
    matchWholeWord: { type: 'boolean', default: false },
    replaceAll: { type: 'boolean', default: true },
    occurrence: {
      type: 'number',
      minimum: 1,
      description: 'Specific occurrence to replace (1-indexed), only used when replaceAll is false',
    },
    startIndex: {
      type: 'number',
      minimum: 0,
      description: 'Start position in document (0-indexed) for character range targeting',
    },
    endIndex: {
      type: 'number',
      minimum: 0,
      description: 'End position in document (exclusive) for character range targeting',
    },
    beforeContext: {
      type: 'string',
      description: 'Text that must appear immediately before the match for contextual validation',
    },
    afterContext: {
      type: 'string',
      description: 'Text that must appear immediately after the match for contextual validation',
    },
  },
  required: ['searchText', 'replaceText'],
} as const;

// Apply changes request body schema
export const applyChangesBodySchema = {
  type: 'object',
  properties: {
    changes: {
      type: 'array',
      items: changeSchema,
      minItems: 1,
      maxItems: 100,
    },
  },
  required: ['changes'],
} as const;

// Apply changes request headers schema
export const applyChangesHeadersSchema = {
  type: 'object',
  properties: {
    'if-match': {
      type: 'string',
      description: 'ETag value for optimistic concurrency control. Returns 412 if document has changed.',
    },
  },
} as const;

// Single change result schema
export const changeResultSchema = {
  type: 'object',
  properties: {
    searchText: { type: 'string' },
    replaceText: { type: 'string' },
    matchesFound: { type: 'number' },
    replacementsMade: { type: 'number' },
    positions: {
      type: 'array',
      items: { type: 'number' },
      description: 'Character positions where replacements were made',
    },
  },
  required: ['searchText', 'replaceText', 'matchesFound', 'replacementsMade'],
} as const;

// Apply changes response schema
export const applyChangesResponseSchema = {
  type: 'object',
  properties: {
    document: documentSchema,
    results: { type: 'array', items: changeResultSchema },
    totalReplacements: { type: 'number' },
    previousVersion: { type: 'number' },
    newVersion: { type: 'number' },
    etag: { type: 'string', description: 'New ETag for the updated document' },
  },
  required: ['document', 'results', 'totalReplacements', 'previousVersion', 'newVersion', 'etag'],
} as const;

// 412 Precondition Failed response schema
export const preconditionFailedSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'number' },
    currentEtag: { type: 'string', description: 'Current ETag of the document' },
  },
  required: ['error', 'code', 'currentEtag'],
} as const;
