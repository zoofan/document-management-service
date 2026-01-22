export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string', description: 'Error message describing what went wrong' },
    code: { type: 'number', description: 'HTTP status code' },
  },
  required: ['error', 'code'],
} as const;

// Error response type
export interface ErrorResponse {
  error: string;
  code: number;
}

// Helper to create error response
export function createErrorResponse(code: number, error: string): ErrorResponse {
  return { error, code };
}

export const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'error'] },
    timestamp: { type: 'string', format: 'date-time' },
    uptime: { type: 'number', description: 'Server uptime in seconds' },
  },
  required: ['status', 'timestamp', 'uptime'],
} as const;
